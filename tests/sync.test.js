import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  articleAlreadyImported,
  fallbackPublishedDateFromIssueNumber,
  localizeArticleImages,
  normalizeLinkedInArticleUrl,
  parseArticleUrls,
  syncLinkedIn,
  writeImportedIssue
} from "../scripts/sync-linkedin.js";

const articleUrl = "https://www.linkedin.com/pulse/why-does-eating-become-so-hard-dementia-erik-ilyayev-x1u7e";

function completeIssue(overrides = {}) {
  return {
    title: "Existing Issue",
    slug: "existing-issue",
    issueNumber: 1,
    publishedDate: "2026-06-01",
    sourceUrl: "https://www.linkedin.com/pulse/existing-issue-erik-ilyayev-123",
    author: "Dr. Erik Ilyayev, MD",
    excerpt: "Existing excerpt.",
    topics: ["Dementia"],
    coverImage: "/assets/issues/existing-issue/cover.jpg",
    images: [],
    sections: [{ type: "paragraph", text: "Existing body." }],
    disclaimer: "",
    ...overrides
  };
}

async function tempSiteRoot() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-sync-"));
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "content/site.json"),
    `${JSON.stringify(
      {
        newsletterUrl: "https://www.linkedin.com/newsletters/the-dementia-times-7452443336956899329/"
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return rootDir;
}

test("normalizeLinkedInArticleUrl strips query strings and rejects non-pulse URLs", () => {
  assert.equal(
    normalizeLinkedInArticleUrl(`${articleUrl}?trackingId=abc#comments`),
    articleUrl
  );
  assert.equal(normalizeLinkedInArticleUrl("https://example.com/pulse/nope"), "");
});

test("parseArticleUrls accepts JSON arrays and newline lists", () => {
  assert.deepEqual(parseArticleUrls(JSON.stringify([`${articleUrl}?trk=one`, articleUrl])), [articleUrl]);
  assert.deepEqual(parseArticleUrls(`${articleUrl}?trk=one\nhttps://example.com/nope`), [articleUrl]);
});

test("fallbackPublishedDateFromIssueNumber derives daily dates from the issue sequence", () => {
  assert.equal(fallbackPublishedDateFromIssueNumber(41), "2026-07-01");
  assert.equal(fallbackPublishedDateFromIssueNumber(40), "2026-06-30");
  assert.equal(fallbackPublishedDateFromIssueNumber(1), "2026-05-22");
});

test("articleAlreadyImported detects existing source URLs", async () => {
  const rootDir = await tempSiteRoot();
  await writeImportedIssue(rootDir, completeIssue());

  assert.equal(await articleAlreadyImported(rootDir, "https://www.linkedin.com/pulse/existing-issue-erik-ilyayev-123?trk=feed"), true);
  assert.equal(await articleAlreadyImported(rootDir, articleUrl), false);
});

test("localizeArticleImages replaces inline LinkedIn image sources with local paths", () => {
  const issue = localizeArticleImages(
    {
      title: "Localized Images",
      slug: "localized-images",
      issueNumber: 2,
      publishedDate: "2026-07-01",
      sourceUrl: "https://www.linkedin.com/pulse/localized-images-erik-ilyayev-123",
      author: "Dr. Erik Ilyayev, MD",
      excerpt: "Image localization.",
      topics: ["Dementia"],
      remoteImages: [
        { src: "https://media.licdn.com/dms/image/article-cover_image/cover.jpg", alt: "Cover" },
        { src: "https://media.licdn.com/dms/image/article-inline_image/slide.jpg", alt: "Slide" }
      ],
      sections: [
        { type: "paragraph", text: "Body." },
        { type: "image", src: "https://media.licdn.com/dms/image/article-inline_image/slide.jpg", alt: "Remote slide" }
      ],
      disclaimer: ""
    },
    {
      coverImage: "/assets/issues/localized-images/cover.jpg",
      images: [{ src: "/assets/issues/localized-images/image-1.jpg", alt: "Slide" }]
    }
  );

  assert.equal(issue.coverImage, "/assets/issues/localized-images/cover.jpg");
  assert.equal(issue.sections[1].src, "/assets/issues/localized-images/image-1.jpg");
  assert.equal("remoteImages" in issue, false);
});

test("writeImportedIssue writes stable JSON with a trailing newline", async () => {
  const rootDir = await tempSiteRoot();
  const filePath = await writeImportedIssue(rootDir, completeIssue());
  const contents = await fs.readFile(filePath, "utf8");

  assert.match(contents, /"slug": "existing-issue"/);
  assert.equal(contents.endsWith("\n"), true);
});

test("syncLinkedIn imports supplied article URLs without loading browser discovery", async () => {
  const rootDir = await tempSiteRoot();
  const html = await fs.readFile(new URL("./fixtures/linkedin-article.html", import.meta.url), "utf8");
  const imageResponses = new Map([
    [
      "https://media.licdn.com/dms/image/v2/D4E12AQGiJU00d5BOmg/article-cover_image-shrink_720_1280/cover.jpg",
      Buffer.from("cover")
    ],
    [
      "https://media.licdn.com/dms/image/v2/D4E12AQFlOFAjPOJuvQ/article-inline_image-shrink_1000_1488/slide-1.jpg",
      Buffer.from("slide")
    ]
  ]);

  const result = await syncLinkedIn({
    rootDir,
    articleUrls: [articleUrl],
    fetchImpl: async (url) => {
      const stringUrl = String(url);
      if (stringUrl === articleUrl) {
        return {
          ok: true,
          status: 200,
          text: async () => html
        };
      }
      const body = imageResponses.get(stringUrl);
      return {
        ok: Boolean(body),
        status: body ? 200 : 404,
        headers: {
          get: () => "image/jpeg"
        },
        arrayBuffer: async () => body
      };
    }
  });

  assert.equal(result.imported.length, 1);
  assert.equal(result.skipped.length, 0);

  const issuePath = path.join(rootDir, "content/issues/why-does-eating-become-so-hard-in-dementia.json");
  const issue = JSON.parse(await fs.readFile(issuePath, "utf8"));
  assert.equal(issue.coverImage, "/assets/issues/why-does-eating-become-so-hard-in-dementia/cover.jpg");
  assert.equal(
    issue.sections.find((section) => section.type === "image").src,
    "/assets/issues/why-does-eating-become-so-hard-in-dementia/image-1.jpg"
  );

  const secondResult = await syncLinkedIn({
    rootDir,
    articleUrls: [articleUrl],
    fetchImpl: async () => {
      throw new Error("duplicate import should not fetch");
    }
  });
  assert.equal(secondResult.imported.length, 0);
  assert.equal(secondResult.skipped.length, 1);
});

test("syncLinkedIn can refresh an existing issue and writes a review report", async () => {
  const rootDir = await tempSiteRoot();
  await writeImportedIssue(
    rootDir,
    completeIssue({
      title: "IS HEARING LOSS LINKED TO DEMENTIA?",
      slug: "is-hearing-loss-linked-to-dementia",
      issueNumber: 2,
      publishedDate: "2026-05-23",
      sourceUrl: "https://www.linkedin.com/pulse/hearing-loss-linked-dementia-erik-ilyayev-bam5e",
      coverImage: "/assets/issues/is-hearing-loss-linked-to-dementia/cover.jpg",
      images: [],
      sections: [{ type: "paragraph", text: "Old body." }]
    })
  );

  const html = `
    <article>
      <h1>IS HEARING LOSS LINKED TO DEMENTIA?</h1>
      <p>Published Apr 22, 2026</p>
      <div data-test-id="article-content-blocks">
        <div data-test-id="publishing-text-block"><p>ISSUE NO. 02 · HEARING LOSS &amp; DEMENTIA</p></div>
        <div data-test-id="publishing-text-block"><p>Every week I sit with families navigating dementia.</p></div>
        <div data-test-id="publishing-image-block"><figure><img data-delayed-url="https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-cover.jpg" alt="Cover"></figure></div>
        <div data-test-id="publishing-text-block"><p>THE SCALE OF THE PROBLEM</p></div>
        <div data-test-id="publishing-image-block"><figure><img data-delayed-url="https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-slide.jpg" alt="Slide"></figure></div>
      </div>
    </article>
  `;

  const result = await syncLinkedIn({
    rootDir,
    articleUrls: ["https://www.linkedin.com/pulse/hearing-loss-linked-dementia-erik-ilyayev-bam5e"],
    refreshExisting: true,
    renderArticles: false,
    fetchImpl: async (url) => {
      const stringUrl = String(url);
      if (stringUrl.includes("linkedin.com/pulse/hearing-loss-linked-dementia")) {
        return { ok: true, status: 200, text: async () => html };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => Buffer.from(stringUrl.includes("cover") ? "cover" : "slide")
      };
    }
  });

  assert.equal(result.imported.length, 1);
  assert.equal(result.skipped.length, 0);

  const issuePath = path.join(rootDir, "content/issues/is-hearing-loss-linked-to-dementia.json");
  const issue = JSON.parse(await fs.readFile(issuePath, "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(rootDir, "content/linkedin-refresh-review.json"), "utf8"));

  assert.equal(issue.publishedDate, "2026-04-22");
  assert.equal(issue.coverImage, "/assets/issues/is-hearing-loss-linked-to-dementia/cover.jpg");
  assert.equal(issue.sections.find((section) => section.type === "image").src, "/assets/issues/is-hearing-loss-linked-to-dementia/image-1.jpg");
  assert.equal(review.issues[0].slug, "is-hearing-loss-linked-to-dementia");
  assert.equal(review.issues[0].publishedDate, "2026-04-22");
  assert.equal(review.issues[0].imageCount, 2);
});

test("syncLinkedIn prefers newsletter card covers when article body only exposes the YouTube banner", async () => {
  const rootDir = await tempSiteRoot();
  const sourceUrl = "https://www.linkedin.com/pulse/hearing-loss-linked-dementia-erik-ilyayev-bam5e";
  const newsletterCover =
    "https://media.licdn.com/dms/image/v2/card/article-cover_image-shrink_720_1280/hearing-card.jpg";
  const youtubeBanner =
    "https://media.licdn.com/dms/image/v2/banner/article-inline_image-shrink_400_744/youtube-banner.jpg";
  const html = `
    <article>
      <h1>IS HEARING LOSS LINKED TO DEMENTIA?</h1>
      <p>Published Apr 22, 2026</p>
      <p>ISSUE NO. 02 · HEARING LOSS &amp; DEMENTIA</p>
      <p>Every week I sit with families navigating dementia.</p>
      <p>Straight Talk With Dr. Erik</p>
      <figure><img data-delayed-url="${youtubeBanner}" alt="Article content"></figure>
    </article>
  `;

  const result = await syncLinkedIn({
    rootDir,
    articleUrls: [sourceUrl],
    renderArticles: false,
    fallbackCoverImagesByUrl: new Map([[sourceUrl, { src: newsletterCover, alt: "Article cover image" }]]),
    fetchImpl: async (url) => {
      const stringUrl = String(url);
      if (stringUrl === sourceUrl) {
        return { ok: true, status: 200, text: async () => html };
      }
      return {
        ok: stringUrl === newsletterCover,
        status: stringUrl === newsletterCover ? 200 : 404,
        headers: { get: () => "image/jpeg" },
        arrayBuffer: async () => Buffer.from("cover")
      };
    }
  });

  assert.equal(result.imported.length, 1);

  const issue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/is-hearing-loss-linked-to-dementia.json"), "utf8"));
  assert.equal(issue.coverImage, "/assets/issues/is-hearing-loss-linked-to-dementia/cover.jpg");
  assert.equal(issue.images.length, 0);
});
