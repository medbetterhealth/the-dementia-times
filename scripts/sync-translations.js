import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadIssues, loadSiteConfig } from "../src/lib/content.js";
import { LOCALES } from "../src/lib/i18n.js";
import { SEARCH_GUIDES } from "../src/lib/search.js";

const targetLocales = LOCALES.filter((locale) => locale.code !== "en");
const endpoint = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";
const model = process.env.TRANSLATION_MODEL;
const apiKey = process.env.OPENAI_API_KEY;

function sourceHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function payloadFromTranslationOutput(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (!value || typeof value !== "object") return value;
  const { _translation, ...payload } = value;
  return payload;
}

export function validateTranslationPayload(source, translated, location = "payload") {
  if (Array.isArray(source)) {
    if (!Array.isArray(translated)) throw new Error(`${location} must remain an array.`);
    if (translated.length !== source.length) {
      throw new Error(`${location} changed array length from ${source.length} to ${translated.length}.`);
    }
    source.forEach((item, index) => validateTranslationPayload(item, translated[index], `${location}[${index}]`));
    return;
  }

  if (source && typeof source === "object") {
    if (!translated || typeof translated !== "object" || Array.isArray(translated)) {
      throw new Error(`${location} must remain an object.`);
    }
    for (const [key, sourceValue] of Object.entries(source)) {
      if (sourceValue === undefined) continue;
      if (!Object.hasOwn(translated, key)) throw new Error(`${location}.${key} is missing.`);
      const translatedValue = translated[key];
      if (["id", "slug", "src", "type"].includes(key) && translatedValue !== sourceValue) {
        throw new Error(`${location}.${key} must not change.`);
      }
      validateTranslationPayload(sourceValue, translatedValue, `${location}.${key}`);
    }
    return;
  }

  if (typeof translated !== typeof source) {
    throw new Error(`${location} changed value type from ${typeof source} to ${typeof translated}.`);
  }
}

async function readJsonFile(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function translatableIssue(issue) {
  return {
    slug: issue.slug,
    title: issue.title,
    excerpt: issue.excerpt,
    topics: issue.topics,
    answer: issue.answer,
    sections: issue.sections,
    disclaimer: issue.disclaimer ?? ""
  };
}

function translatableTopic(topic) {
  return {
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    directAnswer: topic.directAnswer,
    keyTakeaways: topic.keyTakeaways,
    faqs: topic.faqs
  };
}

function translatableSite(site) {
  return {
    title: site.title,
    presentedBy: site.presentedBy,
    description: site.description,
    author: {
      name: site.author?.name,
      role: site.author?.role
    },
    guide: site.guide
  };
}

function translatableSearchGuides(searchGuides) {
  return searchGuides.map((guide) => ({
    id: guide.id,
    label: guide.label,
    description: guide.description,
    defaultQuery: guide.defaultQuery,
    topic: guide.topic,
    commonQuestions: (guide.commonQuestions ?? []).map((question) => ({
      question: question.question,
      query: question.query
    }))
  }));
}

function systemPrompt(locale) {
  return [
    `Translate The Dementia Times website content into ${locale.label}.`,
    "Return only valid JSON with exactly one top-level key named payload.",
    "The payload value must match the shape of the input payload, including whether it is an object or array.",
    "Preserve slugs, URLs, source URLs, image src values, YouTube metadata, dates, issue numbers, and proper names.",
    "Keep MedBetterHealth, CMS, Medicare, The Dementia Times, Straight Talk with Dr. Erik, and Dr. Erik Ilyayev untranslated.",
    locale.code === "es" ? "Use Modelo GUIDE for GUIDE Model and síndrome del atardecer for sundowning." : "Use модель GUIDE for GUIDE Model and синдром заката for sundowning.",
    "Use clear caregiver-friendly language. Do not add medical claims, citations, or new content."
  ].join(" ");
}

async function translateJson(payload, locale) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt(locale) },
        { role: "user", content: JSON.stringify({ payload }) }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Translation request failed for ${locale.code}: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Translation response for ${locale.code} did not contain message content.`);
  const parsed = JSON.parse(content);
  const translated = Object.hasOwn(parsed, "payload") ? parsed.payload : parsed;
  validateTranslationPayload(payload, translated, `Translation response for ${locale.code}`);
  return translated;
}

export function formatTranslationOutput(translated, metadata) {
  if (Array.isArray(translated)) {
    return { items: translated, _translation: metadata };
  }
  return { ...translated, _translation: metadata };
}

async function maybeTranslateFile({ filePath, payload, locale, label }) {
  const hash = sourceHash(payload);
  const existing = await readJsonFile(filePath, null);
  if (existing?._translation?.sourceHash === hash) return { status: "unchanged", filePath };

  if (existing && !existing?._translation?.sourceHash) {
    const existingPayload = payloadFromTranslationOutput(existing);
    validateTranslationPayload(payload, existingPayload, `Existing translation ${filePath}`);
    const metadata = {
      status: existing?._translation?.status || "reviewed",
      sourceHash: hash,
      sourceLocale: "en",
      locale: locale.code,
      model: existing?._translation?.model || null,
      translatedAt: existing?._translation?.translatedAt || new Date().toISOString()
    };
    await writeJsonFile(filePath, formatTranslationOutput(existingPayload, metadata));
    return { status: "adopted", filePath, label };
  }

  const translated = await translateJson(payload, locale);
  const metadata = {
    status: "machine",
    sourceHash: hash,
    sourceLocale: "en",
    locale: locale.code,
    model,
    translatedAt: new Date().toISOString()
  };
  const output = formatTranslationOutput(translated, metadata);
  await writeJsonFile(filePath, output);
  return { status: "updated", filePath, label };
}

async function readTopics(rootDir) {
  const topicsDir = path.join(rootDir, "content", "topics");
  const entries = await fs.readdir(topicsDir, { withFileTypes: true });
  const topics = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    topics.push(JSON.parse(await fs.readFile(path.join(topicsDir, entry.name), "utf8")));
  }
  return topics;
}

export async function syncTranslations(rootDir = process.cwd()) {
  if (!apiKey || !model) {
    console.log("Translation sync skipped: set OPENAI_API_KEY and TRANSLATION_MODEL to enable automatic locale sidecars.");
    return { skipped: true, updated: 0 };
  }

  const site = await loadSiteConfig(rootDir);
  const issues = await loadIssues(rootDir);
  const topics = await readTopics(rootDir);
  const searchGuides = await readJsonFile(path.join(rootDir, "content", "search-guides.json"), SEARCH_GUIDES);
  const results = [];

  for (const locale of targetLocales) {
    const localeDir = path.join(rootDir, "content", "locales", locale.code);
    results.push(
      await maybeTranslateFile({
        filePath: path.join(localeDir, "site.json"),
        payload: translatableSite(site),
        locale,
        label: `${locale.code} site`
      })
    );

    results.push(
      await maybeTranslateFile({
        filePath: path.join(localeDir, "search-guides.json"),
        payload: translatableSearchGuides(searchGuides),
        locale,
        label: `${locale.code} search guides`
      })
    );

    for (const topic of topics) {
      results.push(
        await maybeTranslateFile({
          filePath: path.join(localeDir, "topics", `${topic.slug}.json`),
          payload: translatableTopic(topic),
          locale,
          label: `${locale.code} topic ${topic.slug}`
        })
      );
    }

    for (const issue of issues) {
      results.push(
        await maybeTranslateFile({
          filePath: path.join(localeDir, "issues", `${issue.slug}.json`),
          payload: translatableIssue(issue),
          locale,
          label: `${locale.code} issue ${issue.slug}`
        })
      );
    }
  }

  const updated = results.filter((result) => result.status === "updated");
  console.log(JSON.stringify({ skipped: false, updated: updated.length, files: updated.map((result) => result.filePath) }, null, 2));
  return { skipped: false, updated: updated.length };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  await syncTranslations();
}
