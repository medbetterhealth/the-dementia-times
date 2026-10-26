import fs from "node:fs/promises";
import path from "node:path";

const requiredFields = [
  "title",
  "slug",
  "publishedDate",
  "sourceUrl",
  "author",
  "excerpt",
  "topics",
  "coverImage",
  "images",
  "sections"
];

const stringFields = ["title", "slug", "publishedDate", "sourceUrl", "author", "excerpt", "coverImage"];
const arrayFields = ["topics", "images", "sections"];
const supportedSectionTypes = ["heading", "paragraph", "image", "list", "quote", "callout"];
const sentenceOverflowLimit = 40;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertString(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
}

function assertArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
}

function assertOptionalImageDimensions(value, fieldName) {
  for (const dimension of ["width", "height"]) {
    if (!(dimension in value)) continue;
    if (!Number.isSafeInteger(value[dimension]) || value[dimension] <= 0) {
      throw new Error(`${fieldName}.${dimension} must be a positive safe integer`);
    }
  }
}

function assertYoutubeVideo(value, fieldName) {
  if (!isPlainObject(value)) {
    throw new Error(`${fieldName} must be an object`);
  }

  const requiredVideoFields = ["id", "title", "publishedDate", "url", "embedUrl"];
  for (const field of requiredVideoFields) {
    assertString(value[field], `${fieldName}.${field}`);
  }

  if (!/^[A-Za-z0-9_-]{6,32}$/.test(value.id)) {
    throw new Error(`Invalid ${fieldName}.id: ${value.id}`);
  }
  if (!value.url.startsWith("https://www.youtube.com/watch?v=")) {
    throw new Error(`${fieldName}.url must be a YouTube watch URL`);
  }
  if (!value.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/")) {
    throw new Error(`${fieldName}.embedUrl must be a YouTube embed URL`);
  }
  if ("description" in value) {
    assertString(value.description, `${fieldName}.description`);
  }
  if ("thumbnailUrl" in value) {
    assertString(value.thumbnailUrl, `${fieldName}.thumbnailUrl`);
  }
}

function assertOptionalYoutubeVideo(issue) {
  if ("youtubeVideo" in issue && issue.youtubeVideo !== null) {
    assertYoutubeVideo(issue.youtubeVideo, "youtubeVideo");
  }

  if (!("youtubeVideos" in issue) || issue.youtubeVideos === null) return;
  if (!Array.isArray(issue.youtubeVideos)) {
    throw new Error("youtubeVideos must be an array");
  }

  for (const [index, video] of issue.youtubeVideos.entries()) {
    assertYoutubeVideo(video, `youtubeVideos[${index}]`);
  }
}

export function validateIssue(issue) {
  if (!isPlainObject(issue)) {
    throw new Error("Issue must be an object");
  }

  for (const field of requiredFields) {
    if (!(field in issue)) {
      throw new Error(`Issue is missing required field: ${field}`);
    }
  }

  for (const field of stringFields) {
    assertString(issue[field], field);
  }

  for (const field of arrayFields) {
    assertArray(issue[field], field);
  }

  if (!issue.coverImage.startsWith("/assets/issues/")) {
    throw new Error("coverImage must be a local path under /assets/issues/");
  }

  for (const [index, image] of issue.images.entries()) {
    if (!isPlainObject(image)) {
      throw new Error(`images[${index}] must be an object`);
    }
    assertString(image.src, `images[${index}].src`);
    assertString(image.alt, `images[${index}].alt`);

    if (!image.src.startsWith("/assets/issues/")) {
      throw new Error(`image src must be a local path under /assets/issues/: ${image.src}`);
    }
    assertOptionalImageDimensions(image, `images[${index}]`);
  }

  for (const [index, section] of issue.sections.entries()) {
    if (!isPlainObject(section)) {
      throw new Error(`sections[${index}] must be an object`);
    }
    assertString(section.type, `sections[${index}].type`);

    if (!supportedSectionTypes.includes(section.type)) {
      throw new Error(`Unsupported section type: ${section.type}`);
    }

    if ("text" in section) {
      assertString(section.text, `sections[${index}].text`);
    }

    if ("items" in section) {
      assertArray(section.items, `sections[${index}].items`);
    }

    if (section.type === "list" && !("items" in section)) {
      throw new Error(`sections[${index}].items must be an array`);
    }

    if (section.type !== "list" && section.type !== "image" && !("text" in section)) {
      throw new Error(`sections[${index}].text must be a string`);
    }

    if (section.type === "image") {
      assertString(section.src, `sections[${index}].src`);
      assertString(section.alt, `sections[${index}].alt`);
      assertOptionalImageDimensions(section, `sections[${index}]`);
    }
  }

  assertOptionalYoutubeVideo(issue);

  return issue;
}

export function sortIssuesNewestFirst(issues) {
  return [...issues].sort(
    (a, b) =>
      b.publishedDate.localeCompare(a.publishedDate) ||
      Number(b.issueNumber ?? 0) - Number(a.issueNumber ?? 0) ||
      a.title.localeCompare(b.title)
  );
}

export function createExcerpt(text, maxLength = 180) {
  const cleanText = String(text).replace(/\s+/g, " ").trim();
  if (cleanText.length <= maxLength) return cleanText;
  const sliced = cleanText.slice(0, maxLength);
  const sentenceEnd = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("?"), sliced.lastIndexOf("!"));
  if (sentenceEnd > 40) return sliced.slice(0, sentenceEnd + 1);
  const overflowLimit = maxLength + sentenceOverflowLimit;
  const nextSentenceEnd = [".", "?", "!"]
    .map((punctuation) => cleanText.indexOf(punctuation, maxLength))
    .filter((index) => index !== -1 && index <= overflowLimit)
    .sort((a, b) => a - b)[0];
  if (nextSentenceEnd !== undefined) return cleanText.slice(0, nextSentenceEnd + 1);
  return `${sliced.replace(/\s+\S*$/, "")}...`;
}

export async function loadSiteConfig(rootDir = process.cwd()) {
  const filePath = path.join(rootDir, "content/site.json");
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function loadIssues(rootDir = process.cwd()) {
  const issuesDir = path.join(rootDir, "content/issues");
  const entries = await fs.readdir(issuesDir, { withFileTypes: true });
  const issues = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(issuesDir, entry.name);
    let issue;
    try {
      issue = JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch (error) {
      throw new Error(`Failed to parse ${entry.name}: ${error.message}`, { cause: error });
    }
    issues.push(validateIssue(issue));
  }

  return sortIssuesNewestFirst(issues);
}
