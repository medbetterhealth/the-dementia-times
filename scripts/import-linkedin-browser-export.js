import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateIssue } from "../src/lib/content.js";
import { downloadIssueImages } from "../src/lib/image-download.js";
import { extractArticleFromHtml } from "../src/lib/linkedin-extract.js";
import { localizeArticleImages, normalizeLinkedInArticleUrl, writeImportedIssue } from "./sync-linkedin.js";

const browserUserAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function fetchImage(url) {
  return fetch(url, {
    headers: {
      "user-agent": browserUserAgent,
      accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    }
  });
}

function looksLikeIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

async function issueFiles(rootDir) {
  try {
    const files = await fs.readdir(path.join(rootDir, "content", "issues"));
    return files.filter((file) => file.endsWith(".json"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function verifiedPublishedDatesBySlug(rootDir) {
  const datesBySlug = new Map();

  try {
    const youtubeReview = await readJson(path.join(rootDir, "content", "youtube-review.json"));
    for (const issue of youtubeReview.issues ?? []) {
      if (issue.slug && looksLikeIsoDate(issue.publishedDate)) {
        datesBySlug.set(issue.slug, issue.publishedDate);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  for (const file of await issueFiles(rootDir)) {
    const issue = await readJson(path.join(rootDir, "content", "issues", file));
    if (issue.slug && looksLikeIsoDate(issue.publishedDate) && !datesBySlug.has(issue.slug)) {
      datesBySlug.set(issue.slug, issue.publishedDate);
    }
  }

  return datesBySlug;
}

function fallbackCoverBySourceUrl(exportData) {
  const map = new Map();
  for (const issue of exportData.newsletter?.issues ?? []) {
    const sourceUrl = normalizeLinkedInArticleUrl(issue.href);
    if (!sourceUrl || !issue.coverImage) continue;
    map.set(sourceUrl, { src: issue.coverImage, alt: issue.coverAlt || "Article cover image" });
  }
  return map;
}

function articleWithVerifiedDate(article, publishedDate) {
  if (article.publishedDate || !publishedDate) return article;
  return { ...article, publishedDate };
}

function isSameImage(left, right) {
  if (!left || !right) return false;
  return String(left).split("?")[0] === String(right).split("?")[0];
}

function articleWithFallbackCover(article, fallbackCover) {
  if (fallbackCover && !article.remoteImages.some((image) => isSameImage(image.src, fallbackCover.src))) {
    return {
      ...article,
      remoteImages: article.remoteImages.length > 0 ? article.remoteImages : [fallbackCover]
    };
  }

  if (!article.remoteImages.length && article.youtubeBannerImage) {
    return { ...article, remoteImages: [article.youtubeBannerImage] };
  }

  return article;
}

async function importBrowserExport({ rootDir = process.cwd(), exportPath = process.env.LINKEDIN_BROWSER_EXPORT } = {}) {
  if (!exportPath) {
    throw new Error("Set LINKEDIN_BROWSER_EXPORT to the browser-export JSON path.");
  }

  const exportData = await readJson(exportPath);
  const fallbackCovers = fallbackCoverBySourceUrl(exportData);
  const verifiedDatesBySlug = await verifiedPublishedDatesBySlug(rootDir);
  const imported = [];
  const failed = [];
  const reviewIssues = [];

  for (const entry of exportData.articles ?? []) {
    const sourceUrl = normalizeLinkedInArticleUrl(entry.sourceUrl);
    if (!sourceUrl) {
      failed.push({ sourceUrl: entry.sourceUrl, error: "Invalid LinkedIn source URL." });
      continue;
    }

    try {
      const parsedArticle = extractArticleFromHtml(entry.html, sourceUrl);
      const datedArticle = articleWithVerifiedDate(parsedArticle, verifiedDatesBySlug.get(parsedArticle.slug));
      const article = articleWithFallbackCover(datedArticle, fallbackCovers.get(sourceUrl));
      if (!article.remoteImages.length) {
        throw new Error("No LinkedIn article images found in browser export.");
      }

      const imageMetadata = await downloadIssueImages({
        rootDir,
        slug: article.slug,
        remoteImages: article.remoteImages,
        fetchImpl: fetchImage
      });
      const issue = validateIssue(localizeArticleImages(article, imageMetadata));

      await writeImportedIssue(rootDir, issue);
      imported.push(issue);
      reviewIssues.push({
        slug: issue.slug,
        issueNumber: issue.issueNumber ?? "",
        title: issue.title,
        sourceUrl,
        status: "browser-imported",
        publishedDate: issue.publishedDate,
        imageCount: issue.images.length + 1,
        sectionImageCount: issue.sections.filter((section) => section.type === "image").length,
        browserArticleImageCount: entry.articleImageCount ?? "",
        browserTokenCount: entry.tokenCount ?? ""
      });
    } catch (error) {
      failed.push({ sourceUrl, error: error.message });
      reviewIssues.push({ sourceUrl, status: "failed", error: error.message });
      console.error(`Failed to import ${sourceUrl}: ${error.message}`);
    }
  }

  await fs.writeFile(
    path.join(rootDir, "content", "linkedin-refresh-review.json"),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        policy:
          "Import browser-verified LinkedIn newsletter issues, preserve article image order, and keep the Straight Talk banner out of article body media.",
        issues: reviewIssues
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return { imported, failed, review: reviewIssues };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  const result = await importBrowserExport().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    return null;
  });

  if (result) {
    console.log(`Imported ${result.imported.length} browser issue(s); failed ${result.failed.length} issue(s).`);
    if (result.failed.length > 0) process.exitCode = 1;
  }
}

export { importBrowserExport };
