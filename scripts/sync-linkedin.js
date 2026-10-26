import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateIssue, loadIssues, loadSiteConfig } from "../src/lib/content.js";
import { downloadIssueImages } from "../src/lib/image-download.js";
import { discoverArticleUrls, extractArticleFromHtml } from "../src/lib/linkedin-extract.js";

const linkedInBaseUrl = "https://www.linkedin.com";
const browserUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const issueDateAnchor = {
  issueNumber: 41,
  publishedDate: "2026-07-01"
};

export function normalizeLinkedInArticleUrl(value) {
  try {
    const url = new URL(String(value).trim(), linkedInBaseUrl);
    if (url.protocol !== "https:" || url.hostname !== "www.linkedin.com" || !url.pathname.startsWith("/pulse/")) {
      return "";
    }
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

export function parseArticleUrls(value = "") {
  const trimmed = String(value).trim();
  if (!trimmed) return [];

  let entries;
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error("LINKEDIN_ARTICLE_URLS JSON must be an array");
    }
    entries = parsed;
  } else {
    entries = trimmed.split(/[\n,]+/);
  }

  const seen = new Set();
  const urls = [];
  for (const entry of entries) {
    const url = normalizeLinkedInArticleUrl(entry);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function fallbackPublishedDateFromIssueNumber(issueNumber) {
  const numericIssueNumber = Number(issueNumber);
  if (!Number.isFinite(numericIssueNumber)) return "";

  const date = new Date(`${issueDateAnchor.publishedDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + numericIssueNumber - issueDateAnchor.issueNumber);
  return date.toISOString().slice(0, 10);
}

function localImageByRemoteUrl(remoteImages, imageMetadata) {
  const map = new Map();
  for (const [index, remoteImage] of remoteImages.entries()) {
    const localImage = index === 0 ? null : imageMetadata.images[index - 1];
    if (localImage) {
      map.set(remoteImage.src, localImage);
    }
  }
  return map;
}

export function localizeArticleImages(article, imageMetadata) {
  const remoteImages = article.remoteImages ?? [];
  const localByRemoteUrl = localImageByRemoteUrl(remoteImages, imageMetadata);
  const sections = article.sections.map((section) => {
    if (section.type !== "image") return section;
    const localImage = localByRemoteUrl.get(section.src);
    return localImage ? { ...section, src: localImage.src, alt: localImage.alt || section.alt } : section;
  });

  return validateIssue({
    title: article.title,
    slug: article.slug,
    issueNumber: article.issueNumber,
    publishedDate: article.publishedDate || fallbackPublishedDateFromIssueNumber(article.issueNumber),
    sourceUrl: normalizeLinkedInArticleUrl(article.sourceUrl) || article.sourceUrl,
    author: article.author,
    excerpt: article.excerpt,
    topics: article.topics,
    coverImage: imageMetadata.coverImage,
    images: imageMetadata.images,
    sections,
    disclaimer: article.disclaimer ?? ""
  });
}

async function issueFilePath(rootDir, slug) {
  return path.join(rootDir, "content", "issues", `${slug}.json`);
}

export async function writeImportedIssue(rootDir, issue) {
  const validIssue = validateIssue(issue);
  const filePath = await issueFilePath(rootDir, validIssue.slug);

  try {
    const existing = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (normalizeLinkedInArticleUrl(existing.sourceUrl) !== normalizeLinkedInArticleUrl(validIssue.sourceUrl)) {
      throw new Error(`Refusing to overwrite existing issue with a different source URL: ${validIssue.slug}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT" && !error.message.startsWith("Refusing to overwrite")) {
      throw error;
    }
    if (error.message.startsWith("Refusing to overwrite")) {
      throw error;
    }
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(validIssue, null, 2)}\n`, "utf8");
  return filePath;
}

export async function importedSourceUrls(rootDir) {
  const urls = new Set();
  let issues = [];

  try {
    issues = await loadIssues(rootDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const issue of issues) {
    const url = normalizeLinkedInArticleUrl(issue.sourceUrl);
    if (url) urls.add(url);
  }

  return urls;
}

export async function importedIssuesBySourceUrl(rootDir) {
  const issues = await loadIssues(rootDir).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const map = new Map();
  for (const issue of issues) {
    const url = normalizeLinkedInArticleUrl(issue.sourceUrl);
    if (url) map.set(url, issue);
  }
  return map;
}

export async function articleAlreadyImported(rootDir, sourceUrl) {
  return (await importedSourceUrls(rootDir)).has(normalizeLinkedInArticleUrl(sourceUrl));
}

function storageStateFromJson(storageStateJson) {
  const value = String(storageStateJson ?? "").trim();
  if (!value) return undefined;
  if (value.startsWith("{")) return JSON.parse(value);
  return value;
}

async function waitForQuietPage(page) {
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
}

async function clickShowMoreUntilDone(page, { maxArticles }) {
  let previousCount = 0;
  let stablePasses = 0;

  for (let attempts = 0; attempts < 25; attempts += 1) {
    const currentCount = discoverArticleUrls(await page.content()).length;
    if (currentCount >= maxArticles) break;

    const buttons = page.locator("button", { hasText: /show more results/i });
    const buttonCount = await buttons.count();
    if (buttonCount === 0) break;

    await buttons.nth(buttonCount - 1).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    await waitForQuietPage(page);

    const nextCount = discoverArticleUrls(await page.content()).length;
    stablePasses = nextCount <= previousCount ? stablePasses + 1 : 0;
    previousCount = nextCount;
    if (stablePasses >= 2) break;
  }
}

async function openLinkedInBrowser({ storageStateJson }) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: browserUserAgent,
    storageState: storageStateFromJson(storageStateJson)
  });
  const page = await context.newPage();
  return { browser, page };
}

async function discoverWithBrowser({ newsletterUrl, storageStateJson, maxArticles }) {
  const browserSession = await openLinkedInBrowser({ storageStateJson });
  const { page } = browserSession;
  await page.goto(newsletterUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForQuietPage(page);
  await clickShowMoreUntilDone(page, { maxArticles });

  return {
    ...browserSession,
    urls: discoverArticleUrls(await page.content()).slice(0, maxArticles),
    coverImagesByUrl: await articleCoverImagesFromPage(page)
  };
}

async function articleCoverImagesFromPage(page) {
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="/pulse/"]')]
      .map((link) => {
        const card = link.closest(".share-article, .base-card, li, article") || link.parentElement;
        const image = card?.querySelector?.(
          'img[src*="article-cover_image"], img[currentSrc*="article-cover_image"], img[data-delayed-url*="article-cover_image"]'
        );
        return {
          href: link.href,
          src: image?.currentSrc || image?.src || image?.getAttribute("data-delayed-url") || "",
          alt: image?.alt || "Article cover image"
        };
      })
      .filter((card) => card.href && card.src)
  );
  const coverImagesByUrl = new Map();
  for (const card of cards) {
    const sourceUrl = normalizeLinkedInArticleUrl(card.href);
    if (!sourceUrl || coverImagesByUrl.has(sourceUrl)) continue;
    coverImagesByUrl.set(sourceUrl, { src: card.src, alt: card.alt || "Article cover image" });
  }
  return coverImagesByUrl;
}

async function newsletterCoverImages({ page, newsletterUrl, maxArticles }) {
  await page.goto(newsletterUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForQuietPage(page);
  await clickShowMoreUntilDone(page, { maxArticles });
  return articleCoverImagesFromPage(page);
}

async function fetchArticleHtml(sourceUrl, fetchImpl = fetch) {
  const response = await fetchImpl(sourceUrl, {
    headers: {
      "user-agent": browserUserAgent,
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch article ${sourceUrl}: ${response.status}`);
  }
  return response.text();
}

async function pageArticleHtml(page, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await waitForQuietPage(page);
  return page.content();
}

async function importArticle({ rootDir, sourceUrl, html, fallbackCoverImage, fetchImpl }) {
  const article = extractArticleFromHtml(html, sourceUrl);
  if (!article.remoteImages.length && fallbackCoverImage) {
    article.remoteImages = [fallbackCoverImage];
  }
  if (!article.remoteImages.length && article.youtubeBannerImage) {
    article.remoteImages = [article.youtubeBannerImage];
  }
  if (!article.remoteImages.length) {
    throw new Error(`No LinkedIn article images found for ${sourceUrl}`);
  }

  const imageMetadata = await downloadIssueImages({
    rootDir,
    slug: article.slug,
    remoteImages: article.remoteImages,
    fetchImpl
  });
  const issue = localizeArticleImages(article, imageMetadata);

  await writeImportedIssue(rootDir, issue);
  return issue;
}

async function writeLinkedInReview(rootDir, reviewIssues) {
  const reviewPath = path.join(rootDir, "content", "linkedin-refresh-review.json");
  await fs.writeFile(
    reviewPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        policy:
          "Refresh existing LinkedIn newsletter issues from source URLs, preserve article image order, and keep the Straight Talk banner out of article body media.",
        issues: reviewIssues
      },
      null,
      2
    )}\n`,
    "utf8"
  );
}

export async function syncLinkedIn({
  rootDir = process.cwd(),
  storageStateJson = process.env.LINKEDIN_STORAGE_STATE,
  articleUrls = parseArticleUrls(process.env.LINKEDIN_ARTICLE_URLS ?? ""),
  maxArticles = Number(process.env.MAX_ARTICLES || Infinity),
  refreshExisting = process.env.REFRESH_EXISTING === "1",
  renderArticles = process.env.LINKEDIN_RENDER_ARTICLES === "1" || process.env.REFRESH_EXISTING === "1",
  fallbackCoverImagesByUrl = new Map(),
  fetchImpl = fetch
} = {}) {
  const site = await loadSiteConfig(rootDir);
  const importedIssues = await importedIssuesBySourceUrl(rootDir);
  const importedSources = new Set(importedIssues.keys());
  const imported = [];
  const skipped = [];
  const failed = [];
  const reviewIssues = [];
  const coverImagesByUrl = new Map(fallbackCoverImagesByUrl);
  let browserSession = null;

  try {
    let urls = articleUrls.map(normalizeLinkedInArticleUrl).filter(Boolean);
    if (urls.length === 0 && refreshExisting) {
      urls = [...importedSources];
    }
    if (urls.length === 0) {
      browserSession = await discoverWithBrowser({
        newsletterUrl: site.newsletterUrl,
        storageStateJson,
        maxArticles
      });
      urls = browserSession.urls;
      for (const [sourceUrl, image] of browserSession.coverImagesByUrl) {
        coverImagesByUrl.set(sourceUrl, image);
      }
    }
    if (renderArticles && !browserSession) {
      browserSession = await openLinkedInBrowser({ storageStateJson });
      for (const [sourceUrl, image] of await newsletterCoverImages({
        page: browserSession.page,
        newsletterUrl: site.newsletterUrl,
        maxArticles
      })) {
        coverImagesByUrl.set(sourceUrl, image);
      }
    }

    for (const sourceUrl of urls.slice(0, maxArticles)) {
      if (importedSources.has(sourceUrl) && !refreshExisting) {
        skipped.push(sourceUrl);
        const existing = importedIssues.get(sourceUrl);
        if (existing) {
          reviewIssues.push({
            slug: existing.slug,
            issueNumber: existing.issueNumber ?? "",
            title: existing.title,
            sourceUrl,
            status: "skipped",
            publishedDate: existing.publishedDate,
            imageCount: existing.images.length + 1,
            sectionImageCount: existing.sections.filter((section) => section.type === "image").length
          });
        }
        continue;
      }

      try {
        const html = browserSession
          ? await pageArticleHtml(browserSession.page, sourceUrl)
          : await fetchArticleHtml(sourceUrl, fetchImpl);
        const issue = await importArticle({
          rootDir,
          sourceUrl,
          html,
          fallbackCoverImage: coverImagesByUrl.get(sourceUrl),
          fetchImpl
        });
        imported.push(issue);
        importedSources.add(sourceUrl);
        reviewIssues.push({
          slug: issue.slug,
          issueNumber: issue.issueNumber ?? "",
          title: issue.title,
          sourceUrl,
          status: refreshExisting ? "refreshed" : "imported",
          publishedDate: issue.publishedDate,
          imageCount: issue.images.length + 1,
          sectionImageCount: issue.sections.filter((section) => section.type === "image").length
        });
      } catch (error) {
        const cause = error.cause?.message ? ` (${error.cause.message})` : "";
        failed.push({ sourceUrl, error: `${error.message}${cause}` });
        reviewIssues.push({ sourceUrl, status: "failed", error: `${error.message}${cause}` });
        console.error(`Failed to import ${sourceUrl}: ${error.message}${cause}`);
      }
    }
  } finally {
    await browserSession?.browser.close();
  }

  await writeLinkedInReview(rootDir, reviewIssues);
  return { imported, skipped, failed };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  const result = await syncLinkedIn().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    return null;
  });

  if (result) {
    console.log(
      `Imported ${result.imported.length} issue(s); skipped ${result.skipped.length} existing issue(s); failed ${result.failed.length} issue(s).`
    );
    if (result.failed.length > 0) {
      process.exitCode = 1;
    }
  }
}
