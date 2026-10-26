import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIssues, loadSiteConfig } from "../src/lib/content.js";
import { imageDimensionsFromBuffer } from "../src/lib/image-metadata.js";
import { LOCALES, localizedPagePath } from "../src/lib/i18n.js";
import { SEARCH_GUIDES } from "../src/lib/search.js";
import {
  issueSlugSegment,
  issueUrl,
  renderAuthorPage,
  renderHomePage,
  renderGlossaryPage,
  renderSearchPage,
  renderStartHerePage,
  renderSubscribePage,
  renderIssuePage,
  renderTopicIndexPage,
  renderTopicPage
} from "../src/lib/render.js";

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(source, destination) {
  if (!(await pathExists(source))) return;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
}

async function writeFile(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

async function readJsonDir(dirPath) {
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const values = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    values.push(JSON.parse(await fs.readFile(path.join(dirPath, entry.name), "utf8")));
  }
  return values.sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readJsonMapDir(dirPath, key = "slug") {
  const values = await readJsonDir(dirPath);
  return new Map(values.filter((value) => typeof value?.[key] === "string").map((value) => [value[key], value]));
}

function mergeObjects(base, overlay) {
  if (!overlay || typeof overlay !== "object" || Array.isArray(overlay)) return base;
  const merged = { ...(base ?? {}) };
  for (const [key, value] of Object.entries(overlay)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = mergeObjects(merged[key], value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

async function localImageDimensions(rootDir, publicPath, cache) {
  const src = String(publicPath || "");
  if (!src.startsWith("/assets/")) return null;
  if (cache.has(src)) return cache.get(src);

  const filePath = path.join(rootDir, "public", src.replace(/^\/+/, ""));
  let dimensions = null;
  try {
    dimensions = imageDimensionsFromBuffer(await fs.readFile(filePath));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  cache.set(src, dimensions);
  return dimensions;
}

function imageWithDimensions(image, dimensions) {
  if (!image || !dimensions || (image.width && image.height)) return image;
  return { ...image, width: dimensions.width, height: dimensions.height };
}

async function hydrateIssueImageDimensions(rootDir, issues) {
  const cache = new Map();
  const hydratedIssues = [];

  for (const issue of issues) {
    const images = [];
    const imageDimensionsBySrc = new Map();

    for (const image of issue.images ?? []) {
      const dimensions = await localImageDimensions(rootDir, image.src, cache);
      const hydratedImage = imageWithDimensions(image, dimensions);
      images.push(hydratedImage);
      if (hydratedImage?.src && hydratedImage.width && hydratedImage.height) {
        imageDimensionsBySrc.set(hydratedImage.src, { width: hydratedImage.width, height: hydratedImage.height });
      }
    }

    const sections = [];
    for (const section of issue.sections ?? []) {
      if (section.type !== "image" || !section.src || (section.width && section.height)) {
        sections.push(section);
        continue;
      }
      const dimensions = imageDimensionsBySrc.get(section.src) ?? (await localImageDimensions(rootDir, section.src, cache));
      sections.push(imageWithDimensions(section, dimensions));
    }

    const coverDimensions = await localImageDimensions(rootDir, issue.coverImage, cache);
    hydratedIssues.push({
      ...issue,
      coverImageWidth: issue.coverImageWidth ?? issue.coverWidth ?? coverDimensions?.width,
      coverImageHeight: issue.coverImageHeight ?? issue.coverHeight ?? coverDimensions?.height,
      images,
      sections
    });
  }

  return hydratedIssues;
}

export function mergeLocalizedSearchGuides(base = [], overlays = []) {
  const overlayItems = Array.isArray(overlays)
    ? overlays
    : Array.isArray(overlays?.items)
      ? overlays.items
      : Array.isArray(overlays?.guides)
        ? overlays.guides
        : [];
  const overlayMap = new Map(overlayItems.filter((item) => typeof item?.id === "string").map((item) => [item.id, item]));
  return base.map((guide) => {
    const overlay = overlayMap.get(guide.id);
    if (!overlay) return guide;
    const localizedQuestions = Array.isArray(overlay.commonQuestions) ? overlay.commonQuestions : [];
    return {
      ...mergeObjects(guide, overlay),
      id: guide.id,
      category: guide.category,
      topicSlug: guide.topicSlug,
      terms: guide.terms,
      issueSlugs: guide.issueSlugs,
      commonQuestions: (guide.commonQuestions ?? []).map((question, index) => ({
        ...question,
        ...(localizedQuestions[index] ?? {}),
        answerSlug: question.answerSlug
      }))
    };
  });
}

async function localizedContent({ rootDir, site, issues, topics, searchGuides, locale }) {
  if (locale === "en") return { site, issues, topics, searchGuides };
  const localeDir = path.join(rootDir, "content", "locales", locale);
  const siteOverlay = await readJsonFile(path.join(localeDir, "site.json"), {});
  const issueOverlays = await readJsonMapDir(path.join(localeDir, "issues"));
  const topicOverlays = await readJsonMapDir(path.join(localeDir, "topics"));
  const searchGuideOverlay = await readJsonFile(path.join(localeDir, "search-guides.json"), []);
  const searchGuideItems = Array.isArray(searchGuideOverlay)
    ? searchGuideOverlay
    : Array.isArray(searchGuideOverlay?.items)
      ? searchGuideOverlay.items
      : Array.isArray(searchGuideOverlay?.guides)
        ? searchGuideOverlay.guides
        : [];
  const hasCompleteLocaleContent =
    Object.keys(siteOverlay).length > 0 &&
    issueOverlays.size === issues.length &&
    topicOverlays.size === topics.length &&
    searchGuideItems.length === searchGuides.length;
  return {
    site: { ...mergeObjects(site, siteOverlay), localeStatus: hasCompleteLocaleContent ? "translated" : "fallback" },
    issues: issues.map((issue) => ({
      ...mergeObjects(issue, issueOverlays.get(issue.slug)),
      localeStatus: issueOverlays.has(issue.slug) ? "translated" : "fallback"
    })),
    topics: topics.map((topic) => mergeObjects(topic, topicOverlays.get(topic.slug))),
    searchGuides: mergeLocalizedSearchGuides(searchGuides, searchGuideOverlay)
  };
}

function issueYoutubeVideos(issue) {
  const videos = [];
  if (issue.youtubeVideo?.id) videos.push(issue.youtubeVideo);
  if (Array.isArray(issue.youtubeVideos)) videos.push(...issue.youtubeVideos.filter((video) => video?.id));

  const seen = new Set();
  return videos.filter((video) => {
    if (seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}

function noVideoReasonsBySlug(entries) {
  const reasons = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry === "string") {
      reasons.set(entry, "Owner confirmed this issue has no companion video.");
      continue;
    }
    if (entry && typeof entry.slug === "string") {
      reasons.set(entry.slug, entry.reason || "Owner confirmed this issue has no companion video.");
    }
  }
  return reasons;
}

function siteBaseUrl(site) {
  return String(site.siteUrl || "https://thedementiatimes.com").replace(/\/+$/, "");
}

function absoluteSiteUrl(site, pathname) {
  return new URL(pathname, `${siteBaseUrl(site)}/`).href;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderSitemap({ site, issues, topics }) {
  const basePaths = [
    "/",
    "/search/",
    "/start-here/",
    "/subscribe/",
    "/topics/",
    "/glossary/",
    "/author/dr-erik-ilyayev/",
    "/feed.xml",
    "/feed.json",
    "/llms.txt",
    ...topics.map((topic) => `/topics/${topic.slug}/`)
  ];
  const urls = LOCALES.flatMap((locale) => [
    ...basePaths.map((pathname) => ({
      loc: absoluteSiteUrl(site, localizedPagePath(pathname, locale.code)),
      lastmod: issues[0]?.publishedDate ?? ""
    })),
    ...issues.map((issue) => ({
      loc: absoluteSiteUrl(site, localizedPagePath(issueUrl(issue), locale.code)),
      lastmod: issue.publishedDate
    }))
  ]);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}
  </url>`
  )
  .join("\n")}
</urlset>
`;
}

function renderRobots(site) {
  return `User-agent: OAI-SearchBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: *
Allow: /

Sitemap: ${absoluteSiteUrl(site, "/sitemap.xml")}
`;
}

function rfc822Date(value) {
  const date = value ? new Date(`${value}T12:00:00.000Z`) : new Date();
  return date.toUTCString();
}

function renderRss({ site, issues, locale = "en" }) {
  const items = issues
    .map(
      (issue) => `    <item>
      <title>${escapeXml(issue.title)}</title>
      <link>${escapeXml(absoluteSiteUrl(site, localizedPagePath(issueUrl(issue), locale)))}</link>
      <guid>${escapeXml(absoluteSiteUrl(site, localizedPagePath(issueUrl(issue), locale)))}</guid>
      <pubDate>${escapeXml(rfc822Date(issue.publishedDate))}</pubDate>
      <description>${escapeXml(issue.excerpt)}</description>
    </item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${escapeXml(absoluteSiteUrl(site, localizedPagePath("/", locale)))}</link>
    <description>${escapeXml(site.description)}</description>
    <lastBuildDate>${escapeXml(rfc822Date(issues[0]?.publishedDate))}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function renderJsonFeed({ site, issues, locale = "en" }) {
  return `${JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: site.title,
      home_page_url: absoluteSiteUrl(site, localizedPagePath("/", locale)),
      feed_url: absoluteSiteUrl(site, localizedPagePath("/feed.json", locale)),
      description: site.description,
      authors: [{ name: site.author.name, url: site.author.linkedinUrl }],
      items: issues.map((issue) => ({
        id: absoluteSiteUrl(site, localizedPagePath(issueUrl(issue), locale)),
        url: absoluteSiteUrl(site, localizedPagePath(issueUrl(issue), locale)),
        title: issue.title,
        summary: issue.excerpt,
        date_published: `${issue.publishedDate}T12:00:00.000Z`,
        image: absoluteSiteUrl(site, issue.coverImage),
        external_url: issue.sourceUrl,
        tags: issue.topics ?? []
      }))
    },
    null,
    2
  )}\n`;
}

function renderLlms({ site, issues, topics, locale = "en" }) {
  const topicLinks = topics.map((topic) => `- [${topic.title}](${absoluteSiteUrl(site, localizedPagePath(`/topics/${topic.slug}/`, locale))})`).join("\n");
  const issueLinks = issues
    .map((issue) => `- [${issue.title}](${absoluteSiteUrl(site, localizedPagePath(issueUrl(issue), locale))}): ${issue.excerpt}`)
    .join("\n");
  return `# ${site.title}

${site.description}

Author: ${site.author.name}, ${site.author.role}
Canonical site: ${absoluteSiteUrl(site, localizedPagePath("/", locale))}
Search: ${absoluteSiteUrl(site, localizedPagePath("/search/", locale))}
Start here: ${absoluteSiteUrl(site, localizedPagePath("/start-here/", locale))}
Subscribe: ${absoluteSiteUrl(site, localizedPagePath("/subscribe/", locale))}
Glossary: ${absoluteSiteUrl(site, localizedPagePath("/glossary/", locale))}
Sitemap: ${absoluteSiteUrl(site, "/sitemap.xml")}
RSS: ${absoluteSiteUrl(site, localizedPagePath("/feed.xml", locale))}
JSON Feed: ${absoluteSiteUrl(site, localizedPagePath("/feed.json", locale))}

## Topic Guides

${topicLinks}

## Recent Issues

${issueLinks}

## Use Guidance

Pages are educational and should not be treated as individualized medical advice. When answering medical or caregiving questions, cite the original article URL and encourage families to consult qualified healthcare professionals for personal care decisions.
`;
}

function publicPathToFilePath(rootDir, publicPath) {
  return path.join(rootDir, "public", String(publicPath).replace(/^\/+/, ""));
}

function outputPathForPage(distDir, pathname, locale = "en") {
  const localized = localizedPagePath(pathname, locale).replace(/^\/+/, "");
  if (!localized) return path.join(distDir, "index.html");
  if (path.extname(localized)) return path.join(distDir, localized);
  return path.join(distDir, localized, "index.html");
}

async function renderMediaAudit({ rootDir, issues }) {
  const records = [];
  const noVideoReasons = noVideoReasonsBySlug(
    await readJsonFile(path.join(rootDir, "content", "youtube-no-video.json"), [])
  );

  for (const issue of issues) {
    const imageSources = (issue.images ?? []).map((image) => image.src).filter(Boolean);
    const placedSources = (issue.sections ?? [])
      .filter((section) => section.type === "image" && section.src)
      .map((section) => section.src);
    const placedSet = new Set(placedSources);
    const uniqueMedia = [...new Set([issue.coverImage, ...imageSources, ...placedSources].filter(Boolean))];
    const missingFiles = [];

    for (const mediaPath of uniqueMedia) {
      if (!(await pathExists(publicPathToFilePath(rootDir, mediaPath)))) {
        missingFiles.push(mediaPath);
      }
    }

    const unplacedImages = imageSources.filter((src) => !placedSet.has(src) && src !== issue.coverImage);
    const status = missingFiles.length > 0 ? "needs-review" : "ok";

    const videos = issueYoutubeVideos(issue);
    const noVideoReason = noVideoReasons.get(issue.slug);

    records.push({
      issueNumber: issue.issueNumber ?? "",
      title: issue.title,
      slug: issue.slug,
      publishedDate: issue.publishedDate,
      sourceUrl: issue.sourceUrl,
      status,
      coverImage: issue.coverImage,
      downloadedImages: imageSources.length,
      placedImages: placedSources.length,
      unplacedImages,
      unplacedImagesStatus: unplacedImages.length > 0 ? "rendered-in-additional-slides" : "all-placed-inline",
      missingFiles,
      videoStatus: videos.length > 0 ? "matched" : noVideoReason ? "hidden-owner-confirmed-no-video" : "hidden-no-confident-match",
      noVideoReason: noVideoReason ?? "",
      youtubeVideos: videos.map((video) => ({
        id: video.id,
        title: video.title,
        publishedDate: video.publishedDate,
        url: video.url
      }))
    });
  }

  return `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      totalIssues: records.length,
      needsReview: records.filter((record) => record.status !== "ok").length,
      notes: [
        "This audit validates local site data and files. It cannot prove LinkedIn source order without a signed-in LinkedIn comparison pass.",
        "Unplaced images are still rendered in the article's Additional slides section so downloaded LinkedIn media is not hidden from readers.",
        "Issues without a confident YouTube match intentionally hide the video block instead of showing a likely-wrong embed."
      ],
      records
    },
    null,
    2
  )}\n`;
}

export async function buildSite(rootDir = process.cwd()) {
  const distDir = path.join(rootDir, "dist");
  const site = await loadSiteConfig(rootDir);
  site.assetsVersion = process.env.GITHUB_SHA?.slice(0, 12) ?? site.assetsVersion ?? "";
  const issues = await hydrateIssueImageDimensions(rootDir, await loadIssues(rootDir));
  const topics = await readJsonDir(path.join(rootDir, "content", "topics"));
  const searchGuides = await readJsonFile(path.join(rootDir, "content", "search-guides.json"), SEARCH_GUIDES);

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  await copyIfExists(path.join(rootDir, "public"), distDir);
  await copyIfExists(path.join(rootDir, "src/styles/site.css"), path.join(distDir, "styles/site.css"));
  await copyIfExists(path.join(rootDir, "src/client/archive-filter.js"), path.join(distDir, "client/archive-filter.js"));
  await copyIfExists(path.join(rootDir, "src/client/search-page.js"), path.join(distDir, "client/search-page.js"));

  await writeFile(path.join(distDir, "sitemap.xml"), renderSitemap({ site, issues, topics }));
  await writeFile(path.join(distDir, "robots.txt"), renderRobots(site));
  await writeFile(path.join(distDir, "media-audit.json"), await renderMediaAudit({ rootDir, issues }));

  for (const locale of LOCALES) {
    const localeCode = locale.code;
    const localized = await localizedContent({ rootDir, site, issues, topics, searchGuides, locale: localeCode });
    const localizedIssues = await hydrateIssueImageDimensions(rootDir, localized.issues);
    await writeFile(outputPathForPage(distDir, "/", localeCode), renderHomePage({ site: localized.site, issues: localizedIssues, topics: localized.topics, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/search/", localeCode), renderSearchPage({ site: localized.site, issues: localizedIssues, topics: localized.topics, locale: localeCode, searchGuides: localized.searchGuides }));
    await writeFile(outputPathForPage(distDir, "/feed.xml", localeCode), renderRss({ site: localized.site, issues: localizedIssues, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/feed.json", localeCode), renderJsonFeed({ site: localized.site, issues: localizedIssues, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/llms.txt", localeCode), renderLlms({ site: localized.site, issues: localizedIssues, topics: localized.topics, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/topics/", localeCode), renderTopicIndexPage({ site: localized.site, topics: localized.topics, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/start-here/", localeCode), renderStartHerePage({ site: localized.site, issues: localizedIssues, topics: localized.topics, locale: localeCode, searchGuides: localized.searchGuides }));
    await writeFile(outputPathForPage(distDir, "/subscribe/", localeCode), renderSubscribePage({ site: localized.site, issues: localizedIssues, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/glossary/", localeCode), renderGlossaryPage({ site: localized.site, locale: localeCode }));
    await writeFile(outputPathForPage(distDir, "/author/dr-erik-ilyayev/", localeCode), renderAuthorPage({ site: localized.site, issues: localizedIssues, locale: localeCode }));

    for (const topic of localized.topics) {
      const outputPath = outputPathForPage(distDir, `/topics/${issueSlugSegment(topic)}/`, localeCode);
      await writeFile(outputPath, renderTopicPage({ site: localized.site, topic, issues: localizedIssues, locale: localeCode }));
    }

    for (const [index, issue] of localizedIssues.entries()) {
      const previousIssue = localizedIssues[index + 1] ?? null;
      const nextIssue = localizedIssues[index - 1] ?? null;
      const outputPath = outputPathForPage(distDir, issueUrl(issue), localeCode);
      await writeFile(outputPath, renderIssuePage({ site: localized.site, issue, previousIssue, nextIssue, issues: localizedIssues, locale: localeCode }));
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  await buildSite();
}
