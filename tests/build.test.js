import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSite, mergeLocalizedSearchGuides } from "../scripts/build-site.js";

const site = {
  title: "The Dementia Times",
  siteUrl: "https://thedementiatimes.com",
  presentedBy: "Dr. Erik Ilyayev presents",
  description: "Evidence-based insights on dementia care.",
  newsletterUrl: "https://www.linkedin.com/newsletters/the-dementia-times-7452443336956899329/",
  author: {
    name: "Dr. Erik Ilyayev, MD",
    role: "CEO, MedBetter Health",
    linkedinUrl: "https://www.linkedin.com/in/erik-ilyayev-b9795084/",
    headshot: "/assets/brand/dr-erik-headshot.jpeg"
  },
  brand: {
    medBetterUrl: "https://medbetterhealth.org",
    logo: "/assets/brand/medbetter-health-logo.png",
    youtubeUrl: "https://www.youtube.com/@ErikIlyayev",
    youtubeBanner: "/assets/brand/straight-talk-with-dr-erik-banner.jpg"
  },
  guide: {
    title: "Support for Families Navigating Dementia Care",
    body: "MedBetter Health supports eligible families.",
    url: "https://medbetterhealth.org/guide"
  }
};

const issue = {
  title: "Example Issue",
  slug: "example-issue",
  issueNumber: "1",
  publishedDate: "2026-07-01",
  sourceUrl: "https://www.linkedin.com/pulse/example",
  author: "Dr. Erik Ilyayev, MD",
  excerpt: "A practical example issue.",
  topics: ["Caregiving"],
  coverImage: "/assets/issues/example/cover.jpg",
  images: [{ src: "/assets/issues/example/slide-1.jpg", alt: "Slide 1" }],
  sections: [{ type: "paragraph", text: "Body text." }],
  disclaimer: "This is education, not medical advice."
};

function pngWithDimensions(width, height) {
  const ihdr = Buffer.alloc(8);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]),
    Buffer.from("IHDR"),
    ihdr,
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]),
    Buffer.from([0x00, 0x00, 0x00, 0x00])
  ]);
}

test("localized search guides preserve source-of-truth routing fields", () => {
  const localized = mergeLocalizedSearchGuides(
    [
      {
        id: "basics",
        label: "Dementia basics",
        category: "basics",
        topicSlug: "dementia-diagnosis-and-stages",
        terms: { en: ["memory"], es: ["memoria"] },
        issueSlugs: ["newly-curated-issue"],
        commonQuestions: [{ question: "What is dementia?", query: "dementia", answerSlug: "what-is-dementia" }]
      }
    ],
    {
      items: [
        {
          id: "basics",
          label: "Conceptos básicos de la demencia",
          category: "incorrect-locale-category",
          topicSlug: "incorrect-locale-topic",
          terms: { es: ["incorrecto"] },
          issueSlugs: ["stale-issue"],
          commonQuestions: [{ question: "¿Qué es la demencia?", query: "demencia", answerSlug: "stale-answer" }]
        }
      ],
      _translation: { sourceHash: "example" }
    }
  );

  assert.equal(localized[0].label, "Conceptos básicos de la demencia");
  assert.equal(localized[0].category, "basics");
  assert.equal(localized[0].topicSlug, "dementia-diagnosis-and-stages");
  assert.deepEqual(localized[0].terms, { en: ["memory"], es: ["memoria"] });
  assert.deepEqual(localized[0].issueSlugs, ["newly-curated-issue"]);
  assert.equal(localized[0].commonQuestions[0].question, "¿Qué es la demencia?");
  assert.equal(localized[0].commonQuestions[0].query, "demencia");
  assert.equal(localized[0].commonQuestions[0].answerSlug, "what-is-dementia");
});

test("buildSite writes the homepage and issue pages into dist", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-build-"));
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "content/topics"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "public/assets/brand"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "src/styles"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "src/client"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "content/locales/es/issues"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "content/site.json"), JSON.stringify(site), "utf8");
  await fs.writeFile(path.join(rootDir, "content/issues/example-issue.json"), JSON.stringify(issue), "utf8");
  await fs.writeFile(
    path.join(rootDir, "content/locales/es/site.json"),
    JSON.stringify({ description: "Información en español sobre el cuidado de la demencia." }),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/locales/es/issues/example-issue.json"),
    JSON.stringify({
      slug: "example-issue",
      title: "Edición de ejemplo",
      excerpt: "Resumen en español.",
      topics: ["Cuidadores"],
      sections: [{ type: "paragraph", text: "Texto del artículo en español." }]
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/topics/hearing-loss-and-dementia.json"),
    JSON.stringify({
      title: "Hearing Loss and Dementia",
      slug: "hearing-loss-and-dementia",
      description: "What families should know about hearing loss and dementia risk.",
      directAnswer: "Untreated hearing loss is associated with a higher risk of cognitive decline, but it does not mean someone will definitely develop dementia.",
      keyTakeaways: ["Get hearing checked.", "Support communication."],
      issueSlugs: ["example-issue"],
      faqs: [{ question: "Does hearing loss cause dementia?", answer: "It is associated with increased risk, not a guaranteed cause." }],
      sources: [{ title: "Source article", url: "https://example.com/source" }]
    }),
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "public/CNAME"), "thedementiatimes.com\n", "utf8");
  await fs.writeFile(path.join(rootDir, "public/assets/brand/logo.txt"), "logo", "utf8");
  await fs.writeFile(path.join(rootDir, "src/styles/site.css"), "body { color: black; }", "utf8");
  await fs.writeFile(path.join(rootDir, "src/client/archive-filter.js"), "export {};", "utf8");

  await buildSite(rootDir);

  const homepage = await fs.readFile(path.join(rootDir, "dist/index.html"), "utf8");
  const issuePage = await fs.readFile(path.join(rootDir, "dist/issues/example-issue/index.html"), "utf8");
  const sitemap = await fs.readFile(path.join(rootDir, "dist/sitemap.xml"), "utf8");
  const robots = await fs.readFile(path.join(rootDir, "dist/robots.txt"), "utf8");
  const llms = await fs.readFile(path.join(rootDir, "dist/llms.txt"), "utf8");
  const rss = await fs.readFile(path.join(rootDir, "dist/feed.xml"), "utf8");
  const jsonFeed = await fs.readFile(path.join(rootDir, "dist/feed.json"), "utf8");
  const mediaAudit = await fs.readFile(path.join(rootDir, "dist/media-audit.json"), "utf8");
  const topicIndex = await fs.readFile(path.join(rootDir, "dist/topics/index.html"), "utf8");
  const topicPage = await fs.readFile(path.join(rootDir, "dist/topics/hearing-loss-and-dementia/index.html"), "utf8");
  const searchPage = await fs.readFile(path.join(rootDir, "dist/search/index.html"), "utf8");
  const startHerePage = await fs.readFile(path.join(rootDir, "dist/start-here/index.html"), "utf8");
  const subscribePage = await fs.readFile(path.join(rootDir, "dist/subscribe/index.html"), "utf8");
  const glossaryPage = await fs.readFile(path.join(rootDir, "dist/glossary/index.html"), "utf8");
  const authorPage = await fs.readFile(path.join(rootDir, "dist/author/dr-erik-ilyayev/index.html"), "utf8");
  const spanishHome = await fs.readFile(path.join(rootDir, "dist/es/index.html"), "utf8");
  const spanishSearch = await fs.readFile(path.join(rootDir, "dist/es/search/index.html"), "utf8");
  const spanishIssue = await fs.readFile(path.join(rootDir, "dist/es/issues/example-issue/index.html"), "utf8");
  const russianHome = await fs.readFile(path.join(rootDir, "dist/ru/index.html"), "utf8");
  const cname = await fs.readFile(path.join(rootDir, "dist/CNAME"), "utf8");
  const copiedPublicAsset = await fs.readFile(path.join(rootDir, "dist/assets/brand/logo.txt"), "utf8");
  const copiedStyles = await fs.readFile(path.join(rootDir, "dist/styles/site.css"), "utf8");
  const copiedClient = await fs.readFile(path.join(rootDir, "dist/client/archive-filter.js"), "utf8");

  assert.match(homepage, /The Dementia Times/);
  assert.match(issuePage, /Example Issue/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/start-here\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/search\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/subscribe\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/es\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/ru\/search\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/glossary\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/llms.txt<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/issues\/example-issue\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/topics\/hearing-loss-and-dementia\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thedementiatimes.com\/author\/dr-erik-ilyayev\/<\/loc>/);
  assert.match(robots, /User-agent: OAI-SearchBot/);
  assert.match(robots, /User-agent: GPTBot/);
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Sitemap: https:\/\/thedementiatimes.com\/sitemap.xml/);
  assert.match(llms, /# The Dementia Times/);
  assert.match(llms, /Glossary: https:\/\/thedementiatimes.com\/glossary\//);
  assert.match(llms, /https:\/\/thedementiatimes.com\/topics\/hearing-loss-and-dementia\//);
  assert.match(rss, /<rss version="2.0"/);
  assert.match(rss, /Example Issue/);
  assert.match(jsonFeed, /"version": "https:\/\/jsonfeed.org\/version\/1.1"/);
  assert.match(jsonFeed, /"image": "https:\/\/thedementiatimes.com\/assets\/issues\/example\/cover.jpg"/);
  assert.match(jsonFeed, /"external_url": "https:\/\/www.linkedin.com\/pulse\/example"/);
  assert.match(mediaAudit, /"totalIssues": 1/);
  assert.match(mediaAudit, /"downloadedImages": 1/);
  assert.match(mediaAudit, /"placedImages": 0/);
  assert.match(topicIndex, /Topic Guides/);
  assert.match(topicPage, /Hearing Loss and Dementia/);
  assert.match(searchPage, /Most asked questions/);
  assert.match(searchPage, /data-search-index/);
  assert.match(startHerePage, /Start Here/);
  assert.match(subscribePage, /Subscribe on LinkedIn/);
  assert.match(glossaryPage, /Dementia care words, explained simply/);
  assert.match(authorPage, /Dr. Erik Ilyayev, MD/);
  assert.match(spanishHome, /<html lang="es">/);
  assert.match(spanishHome, /Información en español/);
  assert.doesNotMatch(spanishHome, /traducción automática/i);
  assert.match(spanishSearch, /href="..\/..\/ru\/search\/"/);
  assert.match(spanishIssue, /Edición de ejemplo/);
  assert.match(spanishIssue, /Texto del artículo en español/);
  assert.match(russianHome, /<html lang="ru">/);
  assert.doesNotMatch(russianHome, /Автоматический перевод/);
  assert.equal(cname, "thedementiatimes.com\n");
  assert.equal(copiedPublicAsset, "logo");
  assert.match(copiedStyles, /color: black/);
  assert.match(copiedClient, /export/);
});

test("buildSite rejects issue slugs that would escape dist", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-build-"));
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "content/site.json"), JSON.stringify(site), "utf8");
  await fs.writeFile(
    path.join(rootDir, "content/issues/malicious.json"),
    JSON.stringify({ ...issue, slug: "../../some-file" }),
    "utf8"
  );

  await assert.rejects(buildSite(rootDir), /Invalid issue slug/);
  await assert.rejects(fs.access(path.join(rootDir, "some-file/index.html")));
});

test("buildSite hydrates local issue image dimensions before rendering", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-build-"));
  const dimensionedIssue = {
    ...issue,
    slug: "dimensioned-issue",
    title: "Dimensioned Issue",
    coverImage: "/assets/issues/dimensioned-issue/cover.png",
    images: [{ src: "/assets/issues/dimensioned-issue/image-1.png", alt: "Slide without dimensions" }],
    sections: [
      { type: "paragraph", text: "Body text." },
      { type: "image", src: "/assets/issues/dimensioned-issue/image-1.png", alt: "Slide without dimensions" }
    ]
  };

  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "content/topics"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "public/assets/issues/dimensioned-issue"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "src/styles"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "src/client"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "content/site.json"), JSON.stringify(site), "utf8");
  await fs.writeFile(path.join(rootDir, "content/issues/dimensioned-issue.json"), JSON.stringify(dimensionedIssue), "utf8");
  await fs.writeFile(path.join(rootDir, "public/assets/issues/dimensioned-issue/cover.png"), pngWithDimensions(320, 240));
  await fs.writeFile(path.join(rootDir, "public/assets/issues/dimensioned-issue/image-1.png"), pngWithDimensions(640, 360));
  await fs.writeFile(path.join(rootDir, "src/styles/site.css"), "body { color: black; }", "utf8");
  await fs.writeFile(path.join(rootDir, "src/client/archive-filter.js"), "export {};", "utf8");

  await buildSite(rootDir);

  const homepage = await fs.readFile(path.join(rootDir, "dist/index.html"), "utf8");
  const searchPage = await fs.readFile(path.join(rootDir, "dist/search/index.html"), "utf8");
  const issuePage = await fs.readFile(path.join(rootDir, "dist/issues/dimensioned-issue/index.html"), "utf8");

  assert.match(homepage, /cover\.png"[^>]*width="320"[^>]*height="240"/);
  assert.match(searchPage, /cover\.png"[^>]*width="320"[^>]*height="240"/);
  assert.match(issuePage, /class="article-cover"[^>]*cover\.png"[^>]*width="320"[^>]*height="240"/);
  assert.match(issuePage, /image-1\.png"[^>]*width="640"[^>]*height="360"/);
});
