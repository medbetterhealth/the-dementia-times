import fs from "node:fs/promises";
import path from "node:path";

const translatableKeys = new Set(["title", "excerpt", "text", "alt", "description", "disclaimer"]);

function usage() {
  throw new Error("Usage: node scripts/translate-static-issue.js <issue-slug> <es|ru>");
}

function collectStrings(value, entries = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, entries));
    return entries;
  }
  if (!value || typeof value !== "object") return entries;

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && translatableKeys.has(key) && child.trim()) {
      entries.push({ parent: value, key, source: child });
    } else if (Array.isArray(child) && key === "topics") {
      child.forEach((topic, index) => {
        if (typeof topic === "string" && topic.trim()) entries.push({ parent: child, key: index, source: topic });
      });
    } else {
      collectStrings(child, entries);
    }
  }
  return entries;
}

function batches(entries, maxLength = 1200) {
  const groups = [];
  let current = [];
  let length = 0;
  for (const entry of entries) {
    const nextLength = entry.source.length + 36;
    if (current.length && length + nextLength > maxLength) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(entry);
    length += nextLength;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function translateBatch(entries, target) {
  const marked = entries.map((entry, index) => `[[TDT${index}]]\n${entry.source}`).join("\n\n");
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", target);
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", marked);
  const response = await fetch(url, { headers: { "user-agent": "TheDementiaTimesStaticTranslator/1.0" } });
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const translated = (payload?.[0] ?? []).map((part) => part?.[0] ?? "").join("");
  const sections = translated.split(/\[\[\s*[TТ][DД][TТ]\s*(\d+)\s*\]\]\s*/i);
  const values = new Map();
  for (let index = 1; index < sections.length; index += 2) values.set(Number(sections[index]), sections[index + 1]?.trim() ?? "");
  if (values.size !== entries.length || entries.some((_, index) => !values.get(index))) {
    throw new Error("Translation response lost one or more protected markers.");
  }
  entries.forEach((entry, index) => {
    entry.parent[entry.key] = values.get(index);
  });
}

async function main() {
  const [slug, locale] = process.argv.slice(2);
  if (!slug || !["es", "ru"].includes(locale)) usage();

  const rootDir = process.cwd();
  const sourcePath = path.join(rootDir, "content", "issues", `${slug}.json`);
  const outputPath = path.join(rootDir, "content", "locales", locale, "issues", `${slug}.json`);
  const issue = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const entries = collectStrings(issue);
  for (const group of batches(entries)) await translateBatch(group, locale);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(issue, null, 2)}\n`, "utf8");
  console.log(`Wrote ${locale} static translation for ${slug} (${entries.length} strings).`);
}

await main();
