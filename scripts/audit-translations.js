import fs from "node:fs/promises";
import path from "node:path";
import { loadIssues } from "../src/lib/content.js";
import { LOCALES } from "../src/lib/i18n.js";

async function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripMeta(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value;
  const copy = { ...value };
  delete copy._translation;
  return copy;
}

function unwrapPayload(value) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.items)) return value.items;
  if (value && Array.isArray(value.guides)) return value.guides;
  return stripMeta(value);
}

function issueShapeProblems(source, overlay) {
  const problems = [];
  if (!overlay) return ["missing file"];
  const translated = stripMeta(overlay);

  if (translated.slug && translated.slug !== source.slug) problems.push("slug changed");
  if (!translated.title || translated.title === source.title) problems.push("title missing or untranslated");
  if (!translated.excerpt || translated.excerpt === source.excerpt) problems.push("excerpt missing or untranslated");
  if (source.disclaimer && (!translated.disclaimer || translated.disclaimer === source.disclaimer)) {
    problems.push("disclaimer missing or untranslated");
  }
  if (Array.isArray(translated.sections)) {
    if (translated.sections.length !== source.sections.length) {
      problems.push(`section count ${translated.sections.length} != ${source.sections.length}`);
    }
    translated.sections.forEach((section, index) => {
      const original = source.sections[index];
      if (!original) return;
      if (section.type !== original.type) problems.push(`section ${index + 1} type changed`);
      if (original.src && section.src !== original.src) problems.push(`section ${index + 1} image src changed`);
      if (Array.isArray(original.items) && Array.isArray(section.items) && section.items.length !== original.items.length) {
        problems.push(`section ${index + 1} list item count changed`);
      }
    });
  } else {
    problems.push("sections missing");
  }

  return problems;
}

async function auditTranslations(rootDir = process.cwd()) {
  const issues = await loadIssues(rootDir);
  const targetLocales = LOCALES.filter((locale) => locale.code !== "en");
  const report = {
    locales: {},
    ok: true
  };

  for (const locale of targetLocales) {
    const localeDir = path.join(rootDir, "content", "locales", locale.code);
    const missing = [];
    const shapeProblems = [];
    const site = await readJsonFile(path.join(localeDir, "site.json"), null);
    const searchGuides = await readJsonFile(path.join(localeDir, "search-guides.json"), null);

    if (!site) missing.push("site.json");
    if (!searchGuides) missing.push("search-guides.json");
    if (searchGuides && !Array.isArray(unwrapPayload(searchGuides))) shapeProblems.push("search-guides.json is not an array");

    for (const issue of issues) {
      const overlayPath = path.join(localeDir, "issues", `${issue.slug}.json`);
      const overlay = await readJsonFile(overlayPath, null);
      const problems = issueShapeProblems(issue, overlay);
      if (problems.length > 0) {
        shapeProblems.push({ issue: issue.issueNumber, slug: issue.slug, problems });
      }
    }

    const localizedHome = locale.code === "es" ? "es/index.html" : "ru/index.html";
    const localizedSearch = `${locale.code}/search/index.html`;
    const buildFiles = [];
    if (!(await pathExists(path.join(rootDir, "dist", localizedHome)))) buildFiles.push(localizedHome);
    if (!(await pathExists(path.join(rootDir, "dist", localizedSearch)))) buildFiles.push(localizedSearch);

    report.locales[locale.code] = {
      missing,
      shapeProblems,
      missingBuildFiles: buildFiles
    };
    if (missing.length || shapeProblems.length || buildFiles.length) report.ok = false;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  return report;
}

await auditTranslations();
