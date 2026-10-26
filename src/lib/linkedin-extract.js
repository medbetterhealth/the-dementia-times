import { createExcerpt } from "./content.js";
import { slugifyTitle } from "./slug.js";

const linkedInBaseUrl = "https://www.linkedin.com";
const author = "Dr. Erik Ilyayev, MD";
const monthNumbers = new Map([
  ["jan", "01"],
  ["january", "01"],
  ["feb", "02"],
  ["february", "02"],
  ["mar", "03"],
  ["march", "03"],
  ["apr", "04"],
  ["april", "04"],
  ["may", "05"],
  ["jun", "06"],
  ["june", "06"],
  ["jul", "07"],
  ["july", "07"],
  ["aug", "08"],
  ["august", "08"],
  ["sep", "09"],
  ["sept", "09"],
  ["september", "09"],
  ["oct", "10"],
  ["october", "10"],
  ["nov", "11"],
  ["november", "11"],
  ["dec", "12"],
  ["december", "12"]
]);

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(value) {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attributeValue(markup, name) {
  const match = String(markup).match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function normalizeArticleUrl(href) {
  try {
    const url = new URL(decodeHtml(href), linkedInBaseUrl);
    if (url.hostname !== "www.linkedin.com" || !url.pathname.startsWith("/pulse/")) return "";
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

function publishedDateFromHtml(html) {
  const text = stripTags(html);
  const match = text.match(/Published\s+(?:on\s+)?([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/i);
  if (!match) return "";

  const [, monthName, day, year] = match;
  const month = monthNumbers.get(monthName.toLowerCase());
  if (!month) return "";
  return `${year}-${month}-${day.padStart(2, "0")}`;
}

function issueNumberFromText(text) {
  const match = text.match(/ISSUE\s+NO\.\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function titleCaseTopic(text) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function extractTopicsFromIssueIntro(text) {
  const topicText = String(text)
    .replace(/^.*?\bISSUE\s+NO\.\s*\d+\s*(?:[·:|—-]\s*)?/i, "")
    .trim();
  if (!topicText) return [];

  const topics = [];
  const seen = new Set();
  for (const part of topicText.split(/\s*,\s*/)) {
    const cleaned = part
      .replace(/^(?:and\s+)?(?:the\s+)?/i, "")
      .replace(/[.?!]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || cleaned.length > 60) continue;

    const topic = titleCaseTopic(cleaned);
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    topics.push(topic);
  }

  return topics;
}

function isIssueIntro(text) {
  return /ISSUE\s+NO\.\s*\d+/i.test(text);
}

function isAllCapsHeading(text) {
  const letters = text.match(/[A-Za-z]/g) ?? [];
  return letters.length >= 10 && text === text.toUpperCase() && /[A-Z]/.test(text);
}

function isDecorativeDivider(text) {
  return /^[━─—-]{8,}$/.test(String(text).trim());
}

function isLinkedInMetadataLine(text) {
  const value = String(text).trim();
  return /^Published\s+(?:on\s+)?[A-Za-z]+\s+\d{1,2},\s+\d{4}$/i.test(value) || /^Erik Ilyayev$/i.test(value);
}

function isProfessionalOutreachNote(text) {
  return /A NOTE FOR HEALTHCARE\s*&\s*HOME CARE PROFESSIONALS/i.test(String(text));
}

function stripProfessionalOutreachNote(sections) {
  const noteIndex = sections.findIndex((section) => section.text && isProfessionalOutreachNote(section.text));
  return noteIndex === -1 ? sections : sections.slice(0, noteIndex);
}

function isNewsletterBoilerplateStart(text) {
  const value = String(text).trim();
  return (
    /^The Invisible Epidemic:\s*Caregiver Burnout$/i.test(value) ||
    /^THE NEXT STEP FOR YOUR FAMILY$/i.test(value) ||
    /^THE GUIDE MODEL:\s*MEDICARE/i.test(value) ||
    /^THE GUIDE MODEL:\s*SUPPORT/i.test(value) ||
    /^The GUIDE Model:\s*Medicare/i.test(value) ||
    /^WHERE THE GUIDE MODEL FITS IN$/i.test(value) ||
    /^WHY THE GUIDE MODEL MATTERS$/i.test(value) ||
    /^Straight Talk With Dr\. Erik$/i.test(value) ||
    /^Learn more .*watch/i.test(value) ||
    /^Thank you for reading\b/i.test(value) ||
    /check your eligibility .*GUIDE/i.test(value)
  );
}

export function stripNewsletterBoilerplate(sections) {
  const professionalSections = stripProfessionalOutreachNote(sections);
  const startIndex = professionalSections.findIndex((section, index) => {
    if (!section.text || !isNewsletterBoilerplateStart(section.text)) return false;
    if (/^(?:THE NEXT STEP FOR YOUR FAMILY|Straight Talk With Dr\. Erik|Learn more .*watch|Thank you for reading\b)/i.test(section.text.trim())) return true;
    if (/^WHY THE GUIDE MODEL MATTERS$/i.test(section.text.trim())) return index > professionalSections.length - 20;
    if (/^WHERE THE GUIDE MODEL FITS IN$/i.test(section.text.trim())) return index > professionalSections.length / 2;
    return index > 4;
  });
  return startIndex === -1 ? professionalSections : professionalSections.slice(0, startIndex);
}

function isArticleMedia(src, insideFigure) {
  if (!src || /profile-displayphoto|series-logo|company-logo|logo|header|background-image/i.test(src)) return false;
  return /article-cover_image|article-inline_image/i.test(src);
}

function isYoutubeBannerContext(text) {
  return /^Straight Talk With Dr\. Erik$/i.test(String(text).trim()) || /youtube\.com\/@?ErikIlyayev/i.test(String(text));
}

function articleMarkup(html) {
  const match = String(html).match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  return match ? match[1] : String(html);
}

function imageFromFigure(markup) {
  const imageMatch = markup.match(/<img\b[^>]*>/i);
  if (!imageMatch) return null;

  const img = imageMatch[0];
  const src = imageSourceFromImg(img, true);
  if (!isArticleMedia(src, true)) return null;

  return {
    src,
    alt: attributeValue(img, "alt")
  };
}

function lastIndexOfAny(value, patterns) {
  return Math.max(...patterns.map((pattern) => String(value).lastIndexOf(pattern)));
}

function isInsideLinkedInRecommendation(article, index) {
  const before = String(article).slice(0, index);
  const lastArticleContentContainer = lastIndexOfAny(before, [
    'data-test-id="publishing-text-block"',
    "data-test-id='publishing-text-block'",
    'data-test-id="publishing-image-block"',
    "data-test-id='publishing-image-block'",
    "<figure"
  ]);
  const lastRecommendationContainer = lastIndexOfAny(before, [
    "inline-articles",
    "articles-content-card",
    "aside-article-card",
    "base-aside-card",
    "base-main-card",
    "show-more-less__list"
  ]);
  return lastRecommendationContainer > lastArticleContentContainer;
}

function contentBlockTokens(article) {
  const tokens = [];
  const inlinePattern = /<img\b[^>]*>|<(p|h2|h3|h4)\b[^>]*>[\s\S]*?<\/\1>/gi;
  let match;

  while ((match = inlinePattern.exec(article)) !== null) {
    const markup = match[0];
    const isImage = /^<img\b/i.test(markup);
    if (isInsideLinkedInRecommendation(article, match.index)) continue;
    tokens.push({ type: isImage ? "figure" : "text", markup });
  }

  if (tokens.length > 0) return tokens;

  const legacyTokens = [];
  const legacyPattern = /<p\b[^>]*>[\s\S]*?<\/p>|<figure\b[^>]*>[\s\S]*?<\/figure>/gi;
  while ((match = legacyPattern.exec(article)) !== null) {
    const markup = match[0];
    legacyTokens.push({ type: /^<figure/i.test(markup) ? "figure" : "text", markup });
  }
  return legacyTokens;
}

function lastSrcsetUrl(srcset) {
  const candidates = String(srcset)
    .split(",")
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const lastCandidate = candidates.at(-1);
  return lastCandidate ? lastCandidate.split(/\s+/)[0] : "";
}

function imageSourceFromImg(img, insideFigure = false) {
  const candidates = [
    attributeValue(img, "data-delayed-url"),
    attributeValue(img, "data-src"),
    attributeValue(img, "data-original"),
    attributeValue(img, "currentSrc"),
    lastSrcsetUrl(attributeValue(img, "srcset")),
    attributeValue(img, "src")
  ].filter(Boolean);

  return candidates.find((candidate) => isArticleMedia(candidate, insideFigure)) || candidates[0] || "";
}

export function discoverArticleUrls(html) {
  const urls = [];
  const seen = new Set();
  const linkPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = linkPattern.exec(String(html))) !== null) {
    const url = normalizeArticleUrl(match[1]);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }

  return urls;
}

export function extractArticleFromHtml(html, sourceUrl) {
  const article = articleMarkup(html);
  const title = stripTags(article.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const slug = slugifyTitle(title);
  const publishedDate = publishedDateFromHtml(article);
  const remoteImages = [];
  const remoteImageUrls = new Set();
  const sections = [];
  const paragraphs = [];
  let bodyStarted = false;
  let coverSeen = false;
  let issueIntro = "";
  let youtubeBannerImage = null;
  let afterYoutubeHeading = false;

  for (const token of contentBlockTokens(article)) {
    if (token.type === "figure") {
      const image = imageFromFigure(token.markup);
      if (!image) continue;
      if (remoteImageUrls.has(image.src)) continue;
      remoteImageUrls.add(image.src);
      if (afterYoutubeHeading) {
        youtubeBannerImage ||= image;
        continue;
      }

      remoteImages.push(image);
      if (!coverSeen) {
        coverSeen = true;
        continue;
      }

      sections.push({ type: "image", src: image.src, alt: image.alt });
      bodyStarted = true;
      continue;
    }

    const text = stripTags(token.markup);
    if (!text) continue;
    if (isLinkedInMetadataLine(text)) continue;
    if (isDecorativeDivider(text)) continue;
    if (isIssueIntro(text)) {
      issueIntro ||= text;
      bodyStarted = true;
      continue;
    }
    if (isYoutubeBannerContext(text)) {
      afterYoutubeHeading = true;
    }
    paragraphs.push(text);

    if (isAllCapsHeading(text)) {
      sections.push({ type: "heading", text });
      bodyStarted = true;
      continue;
    }

    if (!bodyStarted) continue;
    sections.push({ type: "paragraph", text });
  }

  const issueNumber = issueNumberFromText(stripTags(article));
  const disclaimer = paragraphs.find((text) => /not medical advice/i.test(text)) ?? "";

  return {
    title,
    slug,
    issueNumber,
    publishedDate,
    sourceUrl: normalizeArticleUrl(sourceUrl) || sourceUrl,
    author,
    excerpt: createExcerpt(paragraphs.filter((text) => text !== disclaimer).join(" ")),
    topics: extractTopicsFromIssueIntro(issueIntro),
    remoteImages,
    sections: stripNewsletterBoilerplate(sections),
    disclaimer,
    youtubeBannerImage
  };
}
