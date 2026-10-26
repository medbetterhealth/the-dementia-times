import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = path.join(process.env.RUNNER_TEMP || process.env.TMPDIR || "/tmp", "tdt-audit-current.json");

export function summarizeAudit(audit) {
  const llmsIssueLinks = audit.llms?.issueLinks ?? 0;
  const llmsTotalIssues = audit.llms?.totalIssues ?? 0;

  return {
    pages: audit.pages?.length ?? 0,
    brokenLinks: audit.brokenLinks?.length ?? 0,
    brokenImages: audit.brokenImages?.length ?? 0,
    missingVisibleLabels: audit.missingVisibleLabels?.length ?? 0,
    smallTouchTargets: audit.smallTouchTargets?.length ?? 0,
    mediaTotalIssues: audit.mediaAudit?.totalIssues ?? 0,
    mediaNeedsReview: audit.mediaAudit?.needsReview ?? 0,
    llmsIssueLinks,
    llmsTotalIssues,
    llmsMissingIssueLinks: Math.max(0, llmsTotalIssues - llmsIssueLinks),
    imagesMissingDimensions: audit.imagesMissingDimensions?.length ?? 0
  };
}

export function classifyAudit(summary) {
  const failures = [];

  if (summary.brokenLinks > 0) failures.push("brokenLinks");
  if (summary.brokenImages > 0) failures.push("brokenImages");
  if (summary.missingVisibleLabels > 0) failures.push("missingVisibleLabels");
  if (summary.mediaNeedsReview > 0) failures.push("mediaNeedsReview");
  if (summary.llmsMissingIssueLinks > 0) failures.push("llmsMissingIssueLinks");
  if (summary.imagesMissingDimensions > 0) failures.push("imagesMissingDimensions");

  return {
    status: failures.length > 0 ? "fail" : "pass",
    failures
  };
}

async function listFiles(dir, predicate) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath, predicate);
      return predicate(fullPath) ? [fullPath] : [];
    })
  );

  return files.flat();
}

function extractAttributes(html, tagName, attributeName) {
  const matches = [];
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  let match;

  while ((match = tagPattern.exec(html))) {
    const tag = match[0];
    const value = getAttribute(tag, attributeName);
    if (value !== null) {
      matches.push({
        tag,
        value
      });
    }
  }

  return matches;
}

function extractTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function getAttribute(tag, attributeName) {
  const attrPattern = new RegExp(`\\s${attributeName}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const attr = attrPattern.exec(tag);
  return attr ? attr[2] ?? attr[3] ?? attr[4] ?? "" : null;
}

function isExternalOrSpecialUrl(value) {
  return (
    value === "" ||
    value.startsWith("#") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("//") ||
    value.startsWith("mailto:") ||
    value.startsWith("sms:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:")
  );
}

function stripUrlDecorations(value) {
  return value.split("#")[0].split("?")[0];
}

function toPosixRelative(rootDir, filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function pageDirectory(distDir, pagePath) {
  return path.dirname(path.join(distDir, pagePath));
}

function localTargetPath(distDir, pagePath, value) {
  const rawValue = stripUrlDecorations(value);
  let cleanValue;
  try {
    cleanValue = decodeURIComponent(rawValue);
  } catch {
    return path.join(distDir, "__invalid-url__");
  }

  if (!cleanValue) return null;

  const rawTarget = cleanValue.startsWith("/")
    ? path.join(distDir, cleanValue)
    : path.resolve(pageDirectory(distDir, pagePath), cleanValue);
  const target = path.normalize(rawTarget);

  if (target !== distDir && !target.startsWith(`${distDir}${path.sep}`)) {
    return null;
  }

  return target;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function linkResolves(targetPath) {
  if (!targetPath) return true;
  if (await pathExists(targetPath)) return true;
  return path.extname(targetPath) === "" && pathExists(path.join(targetPath, "index.html"));
}

function missingDimensionsFromImages(html, page) {
  return extractAttributes(html, "img", "src")
    .filter(({ tag }) => !/\swidth\s*=/i.test(tag) || !/\sheight\s*=/i.test(tag))
    .map(({ value }) => ({ page, src: value }));
}

function unlabeledHomepageFields(html, page) {
  const labels = new Set(
    extractAttributes(html, "label", "for")
      .map(({ value }) => value.trim())
      .filter(Boolean)
  );
  const fields = [
    ...extractTags(html, "input"),
    ...extractTags(html, "select"),
    ...extractTags(html, "textarea")
  ];

  return fields
    .filter((tag) => {
      const id = getAttribute(tag, "id");
      if (id && labels.has(id)) return false;
      if (/\stype\s*=\s*["']?hidden["']?/i.test(tag)) return false;
      return true;
    })
    .map((tag) => {
      const id = getAttribute(tag, "id");
      return {
        page,
        id,
        identifier:
          id ||
          getAttribute(tag, "name") ||
          getAttribute(tag, "aria-label") ||
          getAttribute(tag, "placeholder") ||
          tag.match(/^<([a-z0-9-]+)/i)?.[1] ||
          "control",
        tag
      };
    });
}

async function readMediaAudit(distDir) {
  const mediaAuditPath = path.join(distDir, "media-audit.json");
  if (!(await pathExists(mediaAuditPath))) {
    return { totalIssues: 0, needsReview: 0 };
  }

  const mediaAudit = JSON.parse(await fs.readFile(mediaAuditPath, "utf8"));
  return {
    totalIssues: mediaAudit.totalIssues ?? 0,
    needsReview: mediaAudit.needsReview ?? 0
  };
}

async function countContentIssues(rootDir) {
  const issuesDir = path.join(rootDir, "content/issues");
  if (!(await pathExists(issuesDir))) return 0;
  return (await listFiles(issuesDir, (filePath) => filePath.endsWith(".json"))).length;
}

async function readLlmsAudit(rootDir, distDir) {
  const llmsPath = path.join(distDir, "llms.txt");
  const totalIssues = await countContentIssues(rootDir);
  if (!(await pathExists(llmsPath))) {
    return { issueLinks: 0, totalIssues };
  }

  const llms = await fs.readFile(llmsPath, "utf8");
  const issueLinks = new Set([...llms.matchAll(/(?:https?:\/\/[^\s)"'<]+)?\/issues\/([^/\s)"'<]+)\//g)].map((match) => match[1]));

  return {
    issueLinks: issueLinks.size,
    totalIssues
  };
}

async function crawlDist(rootDir) {
  const distDir = path.join(rootDir, "dist");
  const htmlFiles = await listFiles(distDir, (filePath) => filePath.endsWith(".html"));
  const audit = {
    generatedAt: new Date().toISOString(),
    rootDir,
    distDir,
    pages: [],
    brokenLinks: [],
    brokenImages: [],
    missingVisibleLabels: [],
    smallTouchTargets: [],
    imagesMissingDimensions: [],
    mediaAudit: await readMediaAudit(distDir),
    llms: await readLlmsAudit(rootDir, distDir)
  };

  for (const htmlPath of htmlFiles) {
    const page = toPosixRelative(distDir, htmlPath);
    const html = await fs.readFile(htmlPath, "utf8");
    audit.pages.push(page);
    audit.imagesMissingDimensions.push(...missingDimensionsFromImages(html, page));

    for (const { value: href } of extractAttributes(html, "a", "href")) {
      if (isExternalOrSpecialUrl(href)) continue;
      const target = localTargetPath(distDir, page, href);
      if (!(await linkResolves(target))) {
        audit.brokenLinks.push({ page, href });
      }
    }

    for (const { value: src } of extractAttributes(html, "img", "src")) {
      if (isExternalOrSpecialUrl(src)) continue;
      const target = localTargetPath(distDir, page, src);
      if (!(await linkResolves(target))) {
        audit.brokenImages.push({ page, src });
      }
    }

    if (page === "index.html") {
      audit.missingVisibleLabels.push(...unlabeledHomepageFields(html, page));
    }
  }

  audit.pages.sort();
  return audit;
}

function parseArgs(args) {
  const options = {
    rootDir: process.cwd(),
    output: DEFAULT_OUTPUT,
    strict: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--output") {
      options.output = args[index + 1];
      index += 1;
    } else if (arg === "--root") {
      options.rootDir = args[index + 1];
      index += 1;
    }
  }

  return options;
}

async function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(options.rootDir);
  const output = path.resolve(options.output);
  const audit = await crawlDist(rootDir);
  const summary = summarizeAudit(audit);
  const classification = classifyAudit(summary);

  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify({ audit, summary, classification }, null, 2), "utf8");
  console.log(JSON.stringify({ ...summary, status: classification.status, output }));

  if (options.strict && classification.status === "fail") {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
