import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { syncYoutube } from "../scripts/sync-youtube.js";

function completeIssue(overrides = {}) {
  return {
    title: "How Hearing Loss Changes Dementia Care",
    slug: "hearing-loss-dementia-care",
    issueNumber: "2",
    publishedDate: "2026-07-01",
    sourceUrl: "https://www.linkedin.com/pulse/hearing-loss-dementia-care-erik-ilyayev-123",
    author: "Dr. Erik Ilyayev, MD",
    excerpt: "Listening, hearing aids, background noise, and caregiver communication.",
    topics: ["Hearing", "Communication"],
    coverImage: "/assets/issues/hearing-loss-dementia-care/cover.jpg",
    images: [],
    sections: [{ type: "paragraph", text: "Hearing aids and background noise can change dementia care." }],
    disclaimer: "",
    ...overrides
  };
}

async function tempYoutubeRoot() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-youtube-"));
  await fs.mkdir(path.join(rootDir, "content/issues"), { recursive: true });
  await fs.writeFile(path.join(rootDir, "content/site.json"), "{}\n", "utf8");
  await fs.writeFile(path.join(rootDir, "content/youtube-matches.json"), "{}\n", "utf8");
  return rootDir;
}

test("syncYoutube removes low-confidence existing videos and writes a review report", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/hearing-loss-dementia-care.json"),
    `${JSON.stringify(
      completeIssue({
        youtubeVideo: {
          id: "guide1",
          title: "Dementia GUIDE Model: Complete Breakdown for Families",
          publishedDate: "2026-07-01",
          description: "Medicare care navigation and caregiver support.",
          thumbnailUrl: "https://i.ytimg.com/vi/guide1/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=guide1",
          embedUrl: "https://www.youtube-nocookie.com/embed/guide1"
        }
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/youtube-videos.json"),
    `${JSON.stringify(
      [
        {
          id: "guide1",
          title: "Dementia GUIDE Model: Complete Breakdown for Families",
          description: "Medicare care navigation and caregiver support.",
          publishedDate: "2026-07-01",
          uploadDate: "2026-07-01",
          thumbnailUrl: "https://i.ytimg.com/vi/guide1/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=guide1",
          embedUrl: "https://www.youtube-nocookie.com/embed/guide1"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<script>var ytInitialData = {};</script>"
    })
  });

  const updatedIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/hearing-loss-dementia-care.json"), "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));

  assert.equal("youtubeVideo" in updatedIssue, false);
  assert.deepEqual(result.unmatched, ["hearing-loss-dementia-care"]);
  assert.equal(review.issues[0].slug, "hearing-loss-dementia-care");
  assert.equal(review.issues[0].status, "hidden");
  assert.match(review.issues[0].reason, /no confident/i);
});

test("syncYoutube respects owner-confirmed no-video issues", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/no-video-event.json"),
    `${JSON.stringify(
      completeIssue({
        title: "Why Does Healthcare Innovation Fail Before It Reaches Dementia Families?",
        slug: "no-video-event",
        issueNumber: "33",
        publishedDate: "2026-06-18",
        excerpt: "World Health Expo in Miami and healthcare innovation.",
        topics: ["Healthcare Innovation"],
        youtubeVideo: {
          id: "wrongvideo1",
          title: "Wrong Video",
          publishedDate: "2026-06-18",
          description: "This should be removed.",
          thumbnailUrl: "https://i.ytimg.com/vi/wrongvideo1/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=wrongvideo1",
          embedUrl: "https://www.youtube-nocookie.com/embed/wrongvideo1"
        }
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/youtube-no-video.json"),
    JSON.stringify([{ slug: "no-video-event", reason: "Owner confirmed this event issue has no video." }]),
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "content/youtube-videos.json"), "[]\n", "utf8");

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<script>var ytInitialData = {};</script>"
    })
  });

  const updatedIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/no-video-event.json"), "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));

  assert.equal("youtubeVideo" in updatedIssue, false);
  assert.equal("youtubeVideos" in updatedIssue, false);
  assert.deepEqual(result.unmatched, []);
  assert.equal(review.issues[0].status, "hidden");
  assert.match(review.issues[0].reason, /owner confirmed/i);
});

test("syncYoutube accepts curated same-week matches when title and date are plausible", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/what-is-dementia.json"),
    `${JSON.stringify(
      completeIssue({
        title: "What is Dementia?",
        slug: "what-is-dementia",
        issueNumber: "1",
        publishedDate: "2026-04-21",
        sourceUrl: "https://www.linkedin.com/pulse/what-dementia-erik-ilyayev-3yhye",
        excerpt: "What dementia actually is, why it is underdiagnosed, and what families can do.",
        topics: ["Dementia Awareness"],
        sections: [{ type: "paragraph", text: "Dementia is not one disease." }]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "content/youtube-matches.json"), JSON.stringify({ "what-is-dementia": "P3n0qn7N9b4" }), "utf8");
  await fs.writeFile(
    path.join(rootDir, "content/youtube-videos.json"),
    `${JSON.stringify(
      [
        {
          id: "P3n0qn7N9b4",
          title: "What Is Dementia Really? (It's Not Just Forgetfulness) | Dr. Erik Ilyayev Explains",
          description: "Dr. Erik explains what dementia is, how it differs from normal forgetfulness, and why families should recognize functional decline.",
          publishedDate: "2026-04-20",
          uploadDate: "2026-04-20",
          thumbnailUrl: "https://i.ytimg.com/vi/P3n0qn7N9b4/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=P3n0qn7N9b4",
          embedUrl: "https://www.youtube-nocookie.com/embed/P3n0qn7N9b4"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<script>var ytInitialData = {};</script>"
    })
  });

  const updatedIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/what-is-dementia.json"), "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));

  assert.equal(updatedIssue.youtubeVideo.id, "P3n0qn7N9b4");
  assert.equal(result.unmatched.length, 0);
  assert.equal(review.issues[0].status, "matched");
  assert.equal(review.issues[0].source, "curated");
});

test("syncYoutube accepts multiple owner-curated event videos for one issue", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/south-florida-event.json"),
    `${JSON.stringify(
      completeIssue({
        title: "What Does It Really Take to Fight Alzheimer's in South Florida?",
        slug: "south-florida-event",
        issueNumber: "10",
        publishedDate: "2026-05-07",
        excerpt: "Corporate leaders, Alzheimer's Association, caregiver burden, and brain health at work.",
        topics: ["Events", "Caregiver Support"]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/youtube-matches.json"),
    JSON.stringify({
      "south-florida-event": [
        "X_yt-JEJpWw",
        {
          id: "hO-i7822_kw",
          url: "https://www.youtube.com/watch?v=hO-i7822_kw&t=38s",
          embedUrl: "https://www.youtube-nocookie.com/embed/hO-i7822_kw?start=38"
        }
      ]
    }),
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/youtube-videos.json"),
    `${JSON.stringify(
      [
        {
          id: "X_yt-JEJpWw",
          title: "Why Companies Need to Care About Dementia | Dr. Erik at the Alzheimer's Association",
          description: "Caregiver exhaustion, corporate leaders, and brain health at work.",
          publishedDate: "2026-05-11",
          uploadDate: "2026-05-11",
          thumbnailUrl: "https://i.ytimg.com/vi/X_yt-JEJpWw/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=X_yt-JEJpWw",
          embedUrl: "https://www.youtube-nocookie.com/embed/X_yt-JEJpWw"
        },
        {
          id: "hO-i7822_kw",
          title: "720,000 Floridians Have Alzheimer's. Most Doctors Aren't Equipped to Diagnose It. | Dr. Erik Ilyayev",
          description: "Alzheimer's Association event, Florida dementia numbers, diagnosis gaps, and the GUIDE Model.",
          publishedDate: "2026-05-06",
          uploadDate: "2026-05-06",
          thumbnailUrl: "https://i.ytimg.com/vi/hO-i7822_kw/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=hO-i7822_kw",
          embedUrl: "https://www.youtube-nocookie.com/embed/hO-i7822_kw"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<script>var ytInitialData = {};</script>"
    })
  });

  const updatedIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/south-florida-event.json"), "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));

  assert.deepEqual(
    updatedIssue.youtubeVideos.map((video) => video.id),
    ["X_yt-JEJpWw", "hO-i7822_kw"]
  );
  assert.equal(updatedIssue.youtubeVideos[1].url, "https://www.youtube.com/watch?v=hO-i7822_kw&t=38s");
  assert.equal(updatedIssue.youtubeVideos[1].embedUrl, "https://www.youtube-nocookie.com/embed/hO-i7822_kw?start=38");
  assert.equal("youtubeVideo" in updatedIssue, false);
  assert.equal(result.unmatched.length, 0);
  assert.equal(review.issues[0].status, "matched");
  assert.equal(review.issues[0].source, "curated-multiple");
});

test("syncYoutube honors owner-curated single videos even when automatic scoring is too conservative", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/early-diagnosis-event.json"),
    `${JSON.stringify(
      completeIssue({
        title: "Why Is Early Dementia Diagnosis So Important for Families?",
        slug: "early-diagnosis-event",
        issueNumber: "32",
        publishedDate: "2026-06-17",
        excerpt: "Early diagnosis, treatment innovation, caregiver support, and family planning.",
        topics: ["Diagnosis", "Caregiver Support"]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "content/youtube-matches.json"), JSON.stringify({ "early-diagnosis-event": "7ff9nImsWKo" }), "utf8");
  await fs.writeFile(
    path.join(rootDir, "content/youtube-videos.json"),
    `${JSON.stringify(
      [
        {
          id: "7ff9nImsWKo",
          title: "Advancing Dementia Care: Early Detection, Treatment Innovation, and Caregiver Support",
          description: "Early detection, comprehensive dementia evaluations, new infusion therapies, and caregiver support.",
          publishedDate: "2026-02-25",
          uploadDate: "2026-02-25",
          thumbnailUrl: "https://i.ytimg.com/vi/7ff9nImsWKo/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=7ff9nImsWKo",
          embedUrl: "https://www.youtube-nocookie.com/embed/7ff9nImsWKo"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<script>var ytInitialData = {};</script>"
    })
  });

  const updatedIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/early-diagnosis-event.json"), "utf8"));
  const review = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));

  assert.equal(updatedIssue.youtubeVideo.id, "7ff9nImsWKo");
  assert.equal(result.unmatched.length, 0);
  assert.equal(review.issues[0].status, "matched");
  assert.equal(review.issues[0].source, "curated");
  assert.match(review.issues[0].reason, /owner-curated/i);
});

test("syncYoutube hydrates curated video IDs missing from the channel feed", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/what-is-dementia.json"),
    `${JSON.stringify(
      completeIssue({
        title: "What is Dementia?",
        slug: "what-is-dementia",
        issueNumber: "1",
        publishedDate: "2026-04-21",
        sourceUrl: "https://www.linkedin.com/pulse/what-dementia-erik-ilyayev-3yhye",
        excerpt: "What dementia actually is, why it is underdiagnosed, and what families can do.",
        topics: ["Dementia Awareness"],
        sections: [{ type: "paragraph", text: "Dementia is not one disease. Families often notice functional decline first." }]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "content/youtube-matches.json"), JSON.stringify({ "what-is-dementia": "P3n0qn7N9b4" }), "utf8");
  await fs.writeFile(path.join(rootDir, "content/youtube-videos.json"), "[]\n", "utf8");

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      text: async () =>
        String(url).includes("watch?v=P3n0qn7N9b4")
          ? `<html><head>
              <meta name="title" content="What Is Dementia Really? (It's Not Just Forgetfulness) | Dr. Erik Ilyayev Explains">
              <meta itemprop="datePublished" content="2026-04-20">
              <script>{"shortDescription":"Dr. Erik explains what dementia is, how it differs from normal forgetfulness, and why families should recognize functional decline."}</script>
            </head></html>`
          : "<script>var ytInitialData = {};</script>"
    })
  });

  const updatedIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/what-is-dementia.json"), "utf8"));
  const videos = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-videos.json"), "utf8"));

  assert.equal(updatedIssue.youtubeVideo.id, "P3n0qn7N9b4");
  assert.equal(result.unmatched.length, 0);
  assert.equal(videos[0].id, "P3n0qn7N9b4");
  assert.match(videos[0].description, /functional decline/i);
});

test("syncYoutube does not automatically reuse a video curated for a different issue", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/core-values.json"),
    `${JSON.stringify(
      completeIssue({
        title: "Why Do Core Values Matter in Dementia Care?",
        slug: "core-values",
        issueNumber: "36",
        publishedDate: "2026-06-23",
        excerpt: "Core values, GUIDE Model growth, care navigation, and caregiver trust.",
        topics: ["Core Values", "GUIDE Model"]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "content/issues/more-than-medication.json"),
    `${JSON.stringify(
      completeIssue({
        title: "Why Is Dementia Care More Than Medication?",
        slug: "more-than-medication",
        issueNumber: "37",
        publishedDate: "2026-06-24",
        excerpt: "Medication is only one part of dementia care. Families need planning, support, and community resources.",
        topics: ["Medication", "Dementia Care"]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "content/youtube-matches.json"), JSON.stringify({ "core-values": "values1" }), "utf8");
  await fs.writeFile(
    path.join(rootDir, "content/youtube-videos.json"),
    `${JSON.stringify(
      [
        {
          id: "values1",
          title: "Why MedBetterHealth Is Growing in the GUIDE Model | Dr. Erik on Core Values and Dementia Care",
          description:
            "Core values guide how MedBetterHealth hires, trains, supports caregivers, and grows in the GUIDE Model.",
          publishedDate: "2026-06-23",
          uploadDate: "2026-06-23",
          thumbnailUrl: "https://i.ytimg.com/vi/values1/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=values1",
          embedUrl: "https://www.youtube-nocookie.com/embed/values1"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const result = await syncYoutube({
    rootDir,
    maxContinuationPages: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<script>var ytInitialData = {};</script>"
    })
  });

  const coreIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/core-values.json"), "utf8"));
  const medicationIssue = JSON.parse(await fs.readFile(path.join(rootDir, "content/issues/more-than-medication.json"), "utf8"));

  assert.equal(coreIssue.youtubeVideo.id, "values1");
  assert.equal("youtubeVideo" in medicationIssue, false);
  assert.deepEqual(result.unmatched, ["more-than-medication"]);
});

test("syncYoutube preserves review timestamp when match decisions are unchanged", async () => {
  const rootDir = await tempYoutubeRoot();
  await fs.writeFile(
    path.join(rootDir, "content/issues/what-is-dementia.json"),
    `${JSON.stringify(
      completeIssue({
        title: "What is Dementia?",
        slug: "what-is-dementia",
        issueNumber: "1",
        publishedDate: "2026-04-21",
        sourceUrl: "https://www.linkedin.com/pulse/what-dementia-erik-ilyayev-3yhye",
        excerpt: "What dementia actually is, why it is underdiagnosed, and what families can do.",
        topics: ["Dementia Awareness"],
        sections: [{ type: "paragraph", text: "Dementia is not one disease." }]
      }),
      null,
      2
    )}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(rootDir, "content/youtube-matches.json"), JSON.stringify({ "what-is-dementia": "P3n0qn7N9b4" }), "utf8");
  await fs.writeFile(
    path.join(rootDir, "content/youtube-videos.json"),
    `${JSON.stringify(
      [
        {
          id: "P3n0qn7N9b4",
          title: "What Is Dementia Really? (It's Not Just Forgetfulness) | Dr. Erik Ilyayev Explains",
          description: "Dr. Erik explains what dementia is, how it differs from normal forgetfulness, and why families should recognize functional decline.",
          publishedDate: "2026-04-20",
          uploadDate: "2026-04-20",
          thumbnailUrl: "https://i.ytimg.com/vi/P3n0qn7N9b4/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=P3n0qn7N9b4",
          embedUrl: "https://www.youtube-nocookie.com/embed/P3n0qn7N9b4"
        }
      ],
      null,
      2
    )}\n`,
    "utf8"
  );

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    text: async () => "<script>var ytInitialData = {};</script>"
  });
  await syncYoutube({ rootDir, maxContinuationPages: 0, fetchImpl });
  const firstReview = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));
  const fixedTimestamp = "2026-01-01T00:00:00.000Z";
  await fs.writeFile(
    path.join(rootDir, "content/youtube-review.json"),
    `${JSON.stringify({ ...firstReview, generatedAt: fixedTimestamp }, null, 2)}\n`,
    "utf8"
  );

  await syncYoutube({ rootDir, maxContinuationPages: 0, fetchImpl });
  const secondReview = JSON.parse(await fs.readFile(path.join(rootDir, "content/youtube-review.json"), "utf8"));

  assert.equal(secondReview.generatedAt, fixedTimestamp);
});
