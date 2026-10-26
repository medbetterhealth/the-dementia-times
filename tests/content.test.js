import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateIssue, sortIssuesNewestFirst, createExcerpt, loadIssues } from "../src/lib/content.js";

function completeIssue(overrides = {}) {
  return {
    title: "Why Does Eating Become So Hard in Dementia?",
    slug: "why-does-eating-become-so-hard-in-dementia",
    publishedDate: "2026-07-01",
    sourceUrl: "https://www.linkedin.com/pulse/example",
    author: "Dr. Erik Ilyayev, MD",
    excerpt: "A practical look at eating challenges.",
    topics: ["Nutrition"],
    coverImage: "/assets/issues/example/cover.jpg",
    images: [],
    sections: [{ type: "paragraph", text: "Body text." }],
    ...overrides
  };
}

test("validateIssue accepts a complete issue object", () => {
  const issue = completeIssue();

  assert.equal(validateIssue(issue).slug, issue.slug);
});

test("validateIssue accepts optional image dimensions", () => {
  const issue = completeIssue({
    images: [{ src: "/assets/issues/example/slide.jpg", alt: "Slide", width: 640, height: 360 }],
    sections: [
      { type: "image", src: "/assets/issues/example/section.jpg", alt: "Section image", width: 320, height: 240 }
    ]
  });

  assert.equal(validateIssue(issue).images[0].width, 640);
  assert.equal(validateIssue(issue).sections[0].height, 240);
});

test("validateIssue accepts safe YouTube companion metadata", () => {
  const issue = completeIssue({
    youtubeVideo: {
      id: "MEPjHNS3ijE",
      title: "Anosognosia in Dementia",
      publishedDate: "2026-07-02",
      url: "https://www.youtube.com/watch?v=MEPjHNS3ijE",
      embedUrl: "https://www.youtube-nocookie.com/embed/MEPjHNS3ijE"
    }
  });

  assert.equal(validateIssue(issue).youtubeVideo.id, "MEPjHNS3ijE");
});

test("validateIssue accepts multiple safe YouTube companion videos", () => {
  const issue = completeIssue({
    youtubeVideos: [
      {
        id: "X_yt-JEJpWw",
        title: "Why Companies Need to Care About Dementia",
        publishedDate: "2026-05-11",
        url: "https://www.youtube.com/watch?v=X_yt-JEJpWw",
        embedUrl: "https://www.youtube-nocookie.com/embed/X_yt-JEJpWw"
      },
      {
        id: "hO-i7822_kw",
        title: "720,000 Floridians Have Alzheimer's",
        publishedDate: "2026-05-06",
        url: "https://www.youtube.com/watch?v=hO-i7822_kw&t=38s",
        embedUrl: "https://www.youtube-nocookie.com/embed/hO-i7822_kw?start=38"
      }
    ]
  });

  assert.equal(validateIssue(issue).youtubeVideos.length, 2);
});

test("validateIssue rejects unsafe YouTube companion metadata", () => {
  assert.throws(
    () =>
      validateIssue(
        completeIssue({
          youtubeVideo: {
            id: "bad/id",
            title: "Unsafe",
            publishedDate: "2026-07-02",
            url: "javascript:alert(1)",
            embedUrl: "https://example.com/embed/bad"
          }
        })
      ),
    /Invalid youtubeVideo\.id/
  );
});

test("validateIssue rejects unsafe entries in multiple YouTube companion videos", () => {
  assert.throws(
    () =>
      validateIssue(
        completeIssue({
          youtubeVideos: [
            {
              id: "X_yt-JEJpWw",
              title: "Safe",
              publishedDate: "2026-05-11",
              url: "https://www.youtube.com/watch?v=X_yt-JEJpWw",
              embedUrl: "https://www.youtube-nocookie.com/embed/X_yt-JEJpWw"
            },
            {
              id: "bad/id",
              title: "Unsafe",
              publishedDate: "2026-05-11",
              url: "https://www.youtube.com/watch?v=bad",
              embedUrl: "https://www.youtube-nocookie.com/embed/bad"
            }
          ]
        })
      ),
    /Invalid youtubeVideos\[1\]\.id/
  );
});

test("validateIssue rejects an issue without a local cover image path", () => {
  assert.throws(
    () =>
      validateIssue(completeIssue({ coverImage: "https://media.licdn.com/example.jpg" })),
    /coverImage must be a local path/
  );
});

test("validateIssue rejects null and non-object issue values with clear errors", () => {
  assert.throws(() => validateIssue(null), /Issue must be an object/);
  assert.throws(() => validateIssue("not an issue"), /Issue must be an object/);
});

test("validateIssue rejects malformed top-level field shapes with clear errors", () => {
  assert.throws(() => validateIssue(completeIssue({ title: 42 })), /title must be a string/);
  assert.throws(() => validateIssue(completeIssue({ topics: "Nutrition" })), /topics must be an array/);
  assert.throws(() => validateIssue(completeIssue({ images: "not images" })), /images must be an array/);
  assert.throws(() => validateIssue(completeIssue({ sections: "not sections" })), /sections must be an array/);
});

test("validateIssue rejects malformed image shapes with clear errors", () => {
  assert.throws(() => validateIssue(completeIssue({ images: [null] })), /images\[0\] must be an object/);
  assert.throws(
    () => validateIssue(completeIssue({ images: [{ src: 42, alt: "Slide" }] })),
    /images\[0\]\.src must be a string/
  );
  assert.throws(
    () => validateIssue(completeIssue({ images: [{ src: "/assets/issues/example/slide.jpg", alt: 42 }] })),
    /images\[0\]\.alt must be a string/
  );
});

test("validateIssue rejects invalid image dimensions", () => {
  for (const value of [0, -1, 1.5, Number.NaN, "640", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () =>
        validateIssue(
          completeIssue({ images: [{ src: "/assets/issues/example/slide.jpg", alt: "Slide", width: value }] })
        ),
      /images\[0\]\.width must be a positive safe integer/
    );
  }
});

test("validateIssue rejects malformed section shapes with clear errors", () => {
  assert.throws(() => validateIssue(completeIssue({ sections: [null] })), /sections\[0\] must be an object/);
  assert.throws(
    () => validateIssue(completeIssue({ sections: [{ type: 42, text: "Body text." }] })),
    /sections\[0\]\.type must be a string/
  );
  assert.throws(
    () => validateIssue(completeIssue({ sections: [{ type: "paragraph", text: 42 }] })),
    /sections\[0\]\.text must be a string/
  );
  assert.throws(
    () => validateIssue(completeIssue({ sections: [{ type: "list", items: "not items" }] })),
    /sections\[0\]\.items must be an array/
  );
});

test("validateIssue rejects invalid image section dimensions", () => {
  for (const value of [0, -1, 1.5, Number.NaN, "240", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () =>
        validateIssue(
          completeIssue({
            sections: [
              { type: "image", src: "/assets/issues/example/section.jpg", alt: "Section image", height: value }
            ]
          })
        ),
      /sections\[0\]\.height must be a positive safe integer/
    );
  }
});

test("sortIssuesNewestFirst orders by published date descending", () => {
  const issues = [
    { title: "Older", slug: "older", publishedDate: "2026-06-01" },
    { title: "Newer", slug: "newer", publishedDate: "2026-07-01" }
  ];

  assert.deepEqual(sortIssuesNewestFirst(issues).map((issue) => issue.slug), ["newer", "older"]);
});

test("sortIssuesNewestFirst orders tied dates by issue number descending", () => {
  const issues = [
    { title: "Issue 40", slug: "issue-40", publishedDate: "2026-07-01", issueNumber: 40 },
    { title: "Issue 41", slug: "issue-41", publishedDate: "2026-07-01", issueNumber: 41 }
  ];

  assert.deepEqual(sortIssuesNewestFirst(issues).map((issue) => issue.slug), ["issue-41", "issue-40"]);
});

test("createExcerpt trims body text to sentence-friendly excerpt", () => {
  assert.equal(
    createExcerpt("One sentence. Two sentence. Three sentence.", 24),
    "One sentence. Two sentence."
  );
});

test("createExcerpt does not chase a distant sentence terminator past the limit", () => {
  const excerpt = createExcerpt(`${"Longword ".repeat(20)}finally ends.`, 40);

  assert.ok(excerpt.length <= 43);
  assert.match(excerpt, /\.\.\.$/);
});

test("loadIssues includes filename in invalid JSON errors", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-invalid-json-"));
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "content/issues/broken.json"), "{ invalid json", "utf8");

  await assert.rejects(() => loadIssues(rootDir), /broken\.json/);
});
