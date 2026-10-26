import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { discoverArticleUrls, extractArticleFromHtml } from "../src/lib/linkedin-extract.js";

test("discoverArticleUrls finds normalized unique LinkedIn pulse URLs", async () => {
  const html = await fs.readFile(new URL("./fixtures/linkedin-newsletter.html", import.meta.url), "utf8");

  assert.deepEqual(discoverArticleUrls(html), [
    "https://www.linkedin.com/pulse/why-does-eating-become-so-hard-dementia-erik-ilyayev-x1u7e",
    "https://www.linkedin.com/pulse/4pm-reset-preventing-dementia-sundowning-spiral-before-erik-ilyayev-mrp4e"
  ]);
});

test("extractArticleFromHtml extracts LinkedIn article metadata, media, and body sections", async () => {
  const html = await fs.readFile(new URL("./fixtures/linkedin-article.html", import.meta.url), "utf8");
  const article = extractArticleFromHtml(
    html,
    "https://www.linkedin.com/pulse/why-does-eating-become-so-hard-dementia-erik-ilyayev-x1u7e?trackingId=abc"
  );

  assert.equal(article.title, "Why Does Eating Become So Hard in Dementia?");
  assert.equal(article.slug, "why-does-eating-become-so-hard-in-dementia");
  assert.equal(article.issueNumber, 41);
  assert.equal(article.publishedDate, "2026-07-01");
  assert.deepEqual(article.topics, ["Dementia", "Mealtimes", "Hidden Mechanics Of Eating"]);
  assert.equal(
    article.remoteImages[0].src,
    "https://media.licdn.com/dms/image/v2/D4E12AQGiJU00d5BOmg/article-cover_image-shrink_720_1280/cover.jpg"
  );
  assert.equal(
    article.remoteImages[1].src,
    "https://media.licdn.com/dms/image/v2/D4E12AQFlOFAjPOJuvQ/article-inline_image-shrink_1000_1488/slide-1.jpg"
  );
  assert.ok(article.remoteImages.every((image) => !image.src.includes("profile-displayphoto")));
  assert.ok(article.remoteImages.every((image) => !image.src.includes("series-logo")));
  assert.deepEqual(
    article.sections.map((section) => section.type),
    ["paragraph", "heading", "paragraph", "image", "paragraph"]
  );
  assert.equal(article.sections[0].text, "Every week, caregivers ask me some version of the same question:");
  assert.equal(article.sections[1].text, "THE ICEBERG OF REFUSAL");
  assert.equal(article.sections[2].text, "Behavior is communication.");
  assert.equal(article.sections[3].src, article.remoteImages[1].src);
  assert.equal(article.sections[4].text, "This is education, not medical advice.");
  assert.match(article.disclaimer, /education, not medical advice/i);
});

test("extractArticleFromHtml parses current LinkedIn content blocks in source order", () => {
  const html = `
    <article>
      <h1>IS HEARING LOSS LINKED TO DEMENTIA?</h1>
      <section>
        <p>Erik Ilyayev</p>
        <p>Published Apr 22, 2026</p>
      </section>
      <div data-test-id="article-content-blocks">
        <div data-test-id="publishing-text-block"><p>ISSUE NO. 02 · HEARING LOSS &amp; DEMENTIA</p></div>
        <div data-test-id="publishing-text-block"><p>“It’s Just Hearing Loss.” — The 71% Dementia Risk No One Talks About</p></div>
        <div data-test-id="publishing-text-block"><p>Every week I sit with families navigating dementia, and I hear the same thing: “It’s just hearing loss.”</p></div>
        <div data-test-id="publishing-image-block">
          <figure><img data-delayed-url="https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-cover.jpg" alt="Hearing cover"></figure>
        </div>
        <div data-test-id="publishing-text-block"><p>THE SCALE OF THE PROBLEM</p></div>
        <div data-test-id="publishing-text-block"><p>A major study followed people for 15 years.</p></div>
        <div class="inline-articles" data-nosnippet="true">
          <p>Recommended by LinkedIn</p>
          <a href="https://www.linkedin.com/pulse/recommended">
            <img src="https://media.licdn.com/dms/image/v2/recommended/article-cover_image-shrink_600_2000/recommended.jpg" alt="Recommended">
          </a>
        </div>
        <div data-test-id="publishing-image-block">
          <figure><img data-delayed-url="https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-slide.jpg" alt="Hearing slide"></figure>
        </div>
        <div data-test-id="publishing-text-block"><p>Straight Talk With Dr. Erik</p></div>
        <div data-test-id="publishing-image-block">
          <figure><img data-delayed-url="https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_400_744/youtube-banner.jpg" alt="Article content"></figure>
        </div>
        <div data-test-id="publishing-text-block"><p>Thank you for reading The Dementia Times.</p></div>
      </div>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/hearing-loss-linked-dementia-erik-ilyayev-bam5e");

  assert.equal(article.publishedDate, "2026-04-22");
  assert.doesNotMatch(article.excerpt, /^Erik Ilyayev/);
  assert.doesNotMatch(article.excerpt, /Published Apr 22, 2026/);
  assert.equal(article.issueNumber, 2);
  assert.deepEqual(article.topics, ["Hearing Loss & Dementia"]);
  assert.deepEqual(
    article.remoteImages.map((image) => image.src),
    [
      "https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-cover.jpg",
      "https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-slide.jpg"
    ]
  );
  assert.equal(article.youtubeBannerImage.src, "https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_400_744/youtube-banner.jpg");
  assert.deepEqual(
    article.sections.map((section) => section.type),
    ["paragraph", "paragraph", "heading", "paragraph", "image"]
  );
  assert.equal(article.sections[0].text, "“It’s Just Hearing Loss.” — The 71% Dementia Risk No One Talks About");
  assert.equal(article.sections[1].text, "Every week I sit with families navigating dementia, and I hear the same thing: “It’s just hearing loss.”");
  assert.equal(article.sections.at(-1).src, "https://media.licdn.com/dms/image/v2/own/article-inline_image-shrink_1000_1488/hearing-slide.jpg");
  assert.ok(article.remoteImages.every((image) => !image.src.includes("recommended")));
  assert.ok(article.sections.every((section) => section.text !== "Recommended by LinkedIn"));
});

test("extractArticleFromHtml reads LinkedIn image fallback attributes", () => {
  const html = `
    <article>
      <h1>Fallback Image Sources</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 42 · Dementia</p>
      <figure><img data-delayed-url="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/delayed.jpg" alt="Delayed"></figure>
      <p>BODY STARTS HERE</p>
      <p>Opening paragraph.</p>
      <figure><img data-src="https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/data-src.jpg" alt="Data src"></figure>
      <figure><img data-original="https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/original.jpg" alt="Original"></figure>
      <figure>
        <img
          srcset="https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_400_600/small.jpg 400w, https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/large.jpg 1000w"
          alt="Srcset"
        >
      </figure>
      <figure><img currentSrc="https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/current.jpg" alt="Current"></figure>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/fallback-image-sources-erik-ilyayev-123");

  assert.deepEqual(
    article.remoteImages.map((image) => image.src),
    [
      "https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/delayed.jpg",
      "https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/data-src.jpg",
      "https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/original.jpg",
      "https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/large.jpg",
      "https://media.licdn.com/dms/image/v2/abc/article-inline_image-shrink_1000_1488/current.jpg"
    ]
  );
});

test("extractArticleFromHtml prefers LinkedIn lazy article images over placeholder src values", () => {
  const html = `
    <article>
      <h1>Lazy Article Image</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 44 · Dementia</p>
      <figure>
        <img
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
          data-delayed-url="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/lazy-cover.jpg"
          alt="Lazy cover"
        >
      </figure>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/lazy-article-image-erik-ilyayev-123");

  assert.deepEqual(article.remoteImages, [
    {
      src: "https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/lazy-cover.jpg",
      alt: "Lazy cover"
    }
  ]);
});

test("extractArticleFromHtml rejects LinkedIn UI images inside figures", () => {
  const html = `
    <article>
      <h1>Company Logo Is Not The Cover</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 43 · Dementia</p>
      <figure><img src="https://media.licdn.com/dms/image/v2/company-logo_200_200/logo.jpg" alt="Company logo"></figure>
      <figure><img src="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg" alt="Cover"></figure>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/company-logo-is-not-cover-erik-ilyayev-123");

  assert.deepEqual(article.remoteImages, [
    {
      src: "https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg",
      alt: "Cover"
    }
  ]);
});

test("extractArticleFromHtml rejects generic media.licdn.com figure images", () => {
  const html = `
    <article>
      <h1>Generic Figure Is Not Article Media</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 45 · Dementia</p>
      <figure><img src="https://media.licdn.com/traffic-media-feedshare/C4D22AQGeneric/generic.jpg" alt="Generic media"></figure>
      <figure><img src="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg" alt="Cover"></figure>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/generic-figure-not-article-media-erik-ilyayev-123");

  assert.deepEqual(article.remoteImages, [
    {
      src: "https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg",
      alt: "Cover"
    }
  ]);
});

test("extractArticleFromHtml skips decorative divider paragraphs", () => {
  const html = `
    <article>
      <h1>Decorative Divider</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 46 · Dementia</p>
      <figure><img src="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg" alt="Cover"></figure>
      <p>BODY STARTS HERE</p>
      <p>Opening paragraph.</p>
      <p>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</p>
      <p>Closing paragraph.</p>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/decorative-divider-erik-ilyayev-123");

  assert.deepEqual(
    article.sections.map((section) => section.text).filter(Boolean),
    ["BODY STARTS HERE", "Opening paragraph.", "Closing paragraph."]
  );
});

test("extractArticleFromHtml strips healthcare professional outreach notes", () => {
  const html = `
    <article>
      <h1>Professional Note Cleanup</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 47 · Dementia</p>
      <figure><img src="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg" alt="Cover"></figure>
      <p>BODY STARTS HERE</p>
      <p>Helpful caregiver paragraph.</p>
      <p>A NOTE FOR HEALTHCARE &amp; HOME CARE PROFESSIONALS</p>
      <p>If you work in home care, I would love to have you on my podcast.</p>
      <p>Florida Trend Media Company</p>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/professional-note-cleanup-erik-ilyayev-123");
  const text = article.sections.map((section) => section.text).filter(Boolean).join(" ");

  assert.match(text, /Helpful caregiver paragraph/);
  assert.doesNotMatch(text, /A NOTE FOR HEALTHCARE/);
  assert.doesNotMatch(text, /Florida Trend Media Company/);
});

test("extractArticleFromHtml strips repeated newsletter CTA boilerplate", () => {
  const html = `
    <article>
      <h1>CTA Cleanup</h1>
      <p>Published on July 1, 2026</p>
      <p>ISSUE NO. 48 · Dementia</p>
      <figure><img src="https://media.licdn.com/dms/image/v2/abc/article-cover_image-shrink_720_1280/cover.jpg" alt="Cover"></figure>
      <p>BODY STARTS HERE</p>
      <p>Helpful caregiver paragraph.</p>
      <p>THE NEXT STEP FOR YOUR FAMILY</p>
      <p>If you are caring for someone living with dementia in Florida or New York, MedBetter Health may be able to support your family through the GUIDE Model.</p>
      <p>Straight Talk With Dr. Erik</p>
      <p>Learn more about dementia care by watching the full video.</p>
      <p>Thank you for reading The Dementia Times.</p>
    </article>
  `;

  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/cta-cleanup-erik-ilyayev-123");
  const text = article.sections.map((section) => section.text).filter(Boolean).join(" ");

  assert.match(text, /Helpful caregiver paragraph/);
  assert.doesNotMatch(text, /THE NEXT STEP FOR YOUR FAMILY/);
  assert.doesNotMatch(text, /Straight Talk With Dr\. Erik/);
  assert.doesNotMatch(text, /Thank you for reading/);
});

test("discoverArticleUrls keeps duplicate pulse links unique in first-seen order", () => {
  const html = `
    <a href="/pulse/first-article-erik-ilyayev-111?trk=newsletter">First</a>
    <a href="https://www.linkedin.com/pulse/second-article-erik-ilyayev-222/">Second</a>
    <a href="https://www.linkedin.com/pulse/first-article-erik-ilyayev-111?mini=true">First duplicate</a>
  `;

  assert.deepEqual(discoverArticleUrls(html), [
    "https://www.linkedin.com/pulse/first-article-erik-ilyayev-111",
    "https://www.linkedin.com/pulse/second-article-erik-ilyayev-222"
  ]);
});
