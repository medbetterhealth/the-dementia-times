import test from "node:test";
import assert from "node:assert/strict";
import hearingIssue from "../content/issues/is-hearing-loss-linked-to-dementia.json" with { type: "json" };
import firstIssue from "../content/issues/what-is-dementia.json" with { type: "json" };
import dementiaMedicationsIssue from "../content/issues/dementia-medications.json" with { type: "json" };
import adultDayCareIssue from "../content/issues/the-one-resource-most-dementia-caregivers-overlook-and-it-s-not-a-medication.json" with { type: "json" };
import caregiverBurnoutIssue from "../content/issues/is-it-normal-to-feel-overwhelmed-caring-for-someone-with-dementia.json" with { type: "json" };
import patientCenteredIssue from "../content/issues/why-can-t-dementia-care-focus-only-on-the-patient.json" with { type: "json" };
import southFloridaIssue from "../content/issues/what-does-it-really-take-to-fight-alzheimer-s-in-south-florida.json" with { type: "json" };
import storedVideos from "../content/youtube-videos.json" with { type: "json" };
import {
  assertYoutubeVideoId,
  extractCaptionTracksFromWatchHtml,
  matchYoutubeVideoForIssue,
  transcriptTextFromTimedTextJson,
  transcriptTextFromTimedTextXml,
  videoMetadataFromWatchHtml,
  youtubeEmbedUrl
} from "../src/lib/youtube.js";

test("youtube helpers validate IDs and create nocookie embed URLs", () => {
  assert.equal(assertYoutubeVideoId("MEPjHNS3ijE"), "MEPjHNS3ijE");
  assert.equal(youtubeEmbedUrl("MEPjHNS3ijE"), "https://www.youtube-nocookie.com/embed/MEPjHNS3ijE");
  assert.throws(() => assertYoutubeVideoId("../bad"), /Invalid YouTube video ID/);
});

test("videoMetadataFromWatchHtml extracts title and dates", () => {
  const html = `
    <html>
      <head>
        <meta name="title" content="Dementia Eating Problems: Food Pocketing">
        <meta name="description" content="A practical Straight Talk episode about food pocketing, swallowing trouble, aspiration risk, and dementia mealtime care.">
        <script>{"datePublished":"2026-07-01T07:57:19-07:00","uploadDate":"2026-07-01T07:57:19-07:00"}</script>
      </head>
    </html>
  `;

  assert.deepEqual(videoMetadataFromWatchHtml("x66xkz-DDM8", html), {
    id: "x66xkz-DDM8",
    title: "Dementia Eating Problems: Food Pocketing",
    publishedDate: "2026-07-01",
    uploadDate: "2026-07-01",
    description:
      "A practical Straight Talk episode about food pocketing, swallowing trouble, aspiration risk, and dementia mealtime care.",
    url: "https://www.youtube.com/watch?v=x66xkz-DDM8",
    embedUrl: "https://www.youtube-nocookie.com/embed/x66xkz-DDM8",
    thumbnailUrl: "https://i.ytimg.com/vi/x66xkz-DDM8/hqdefault.jpg"
  });
});

test("videoMetadataFromWatchHtml prefers YouTube shortDescription when meta description is generic", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="When Dementia Changes Mealtimes">
        <meta name="description" content="Enjoy the videos and music you love.">
        <script>{"shortDescription":"Food pocketing and aspiration risk at the dinner table.","datePublished":"2026-07-01"}</script>
      </head>
    </html>
  `;

  assert.equal(
    videoMetadataFromWatchHtml("x66xkz-DDM8", html).description,
    "Food pocketing and aspiration risk at the dinner table."
  );
});

test("videoMetadataFromWatchHtml extracts duration and caption availability", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Dementia End-of-Life Planning">
        <script>
          {"datePublished":"2026-07-07","lengthSeconds":"1271","captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=fI7JUxQq6MM\\u0026lang=en","languageCode":"en","kind":"asr","name":{"simpleText":"English (auto-generated)"}}]}}}
        </script>
      </head>
    </html>
  `;

  const metadata = videoMetadataFromWatchHtml("fI7JUxQq6MM", html);

  assert.equal(metadata.durationSeconds, 1271);
  assert.equal(metadata.transcriptAvailable, true);
  assert.equal(extractCaptionTracksFromWatchHtml(html)[0].baseUrl, "https://www.youtube.com/api/timedtext?v=fI7JUxQq6MM&lang=en");
});

test("timed text helpers extract transcript text from JSON and XML captions", () => {
  assert.equal(
    transcriptTextFromTimedTextJson({
      events: [
        { segs: [{ utf8: "Advance care" }, { utf8: " planning" }] },
        { segs: [{ utf8: "\n" }, { utf8: "matters." }] }
      ]
    }),
    "Advance care planning matters."
  );
  assert.equal(
    transcriptTextFromTimedTextXml("<transcript><text start=\"0\">Hearing &amp; dementia</text><text start=\"1\">risk</text></transcript>"),
    "Hearing & dementia risk"
  );
});

test("videoMetadataFromWatchHtml infers a minimum duration from timestamped descriptions", () => {
  const html = `
    <html>
      <head>
        <meta property="og:title" content="Short Dementia Clip">
        <script>{"datePublished":"2026-07-07","shortDescription":"TIMESTAMPS 0:00 Intro 1:12 Takeaway"}</script>
      </head>
    </html>
  `;

  const metadata = videoMetadataFromWatchHtml("shortclip", html);

  assert.equal(metadata.inferredDurationSeconds, 87);
});

test("matchYoutubeVideoForIssue chooses a same-day description match over a generic title match", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "Why Does Eating Become So Hard in Dementia?",
      publishedDate: "2026-07-01",
      topics: ["Mealtimes"],
      excerpt: "Food pocketing, swallowing trouble, appetite changes, and aspiration risk.",
      sections: []
    },
    [
      {
        id: "MEPjHNS3ijE",
        title: "Dementia GUIDE Model: Complete Breakdown for Families",
        description: "Medicare support, care navigation, respite, and caregiver planning.",
        publishedDate: "2026-07-01"
      },
      {
        id: "x66xkz-DDM8",
        title: "When Mealtimes Change in Dementia",
        description: "Food pocketing, swallowing trouble, appetite changes, and aspiration risk.",
        publishedDate: "2026-07-01"
      }
    ]
  );

  assert.equal(match.video.id, "x66xkz-DDM8");
  assert.equal(match.status, "matched");
  assert.match(match.reason, /same-day/i);
});

test("matchYoutubeVideoForIssue hides ambiguous low-confidence videos", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "How Hearing Loss Changes Dementia Care",
      publishedDate: "2026-07-01",
      topics: ["Hearing", "Communication"],
      excerpt: "Listening, hearing aids, background noise, and caregiver communication.",
      sections: []
    },
    [
      {
        id: "guide123",
        title: "Dementia GUIDE Model: Complete Breakdown for Families",
        description: "Medicare care navigation and respite support.",
        publishedDate: "2026-07-01"
      },
      {
        id: "food456",
        title: "Food Pocketing and Swallowing Trouble in Dementia",
        description: "Mealtime support and aspiration risk.",
        publishedDate: "2026-07-02"
      }
    ]
  );

  assert.equal(match, null);
});

test("matchYoutubeVideoForIssue rejects short videos even when title words overlap", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "Why Does Routine Matter So Much in Dementia Care?",
      publishedDate: "2026-06-16",
      topics: ["Routine", "Dementia Care"],
      excerpt: "Daily structure, routine, bathing, meals, safety, and caregiver support.",
      sections: []
    },
    [
      {
        id: "short1",
        title: "Routine in Dementia Care",
        description: "A quick event clip about care routines.",
        publishedDate: "2026-06-16",
        durationSeconds: 58,
        transcriptText: "Routine matters in dementia care."
      }
    ],
    { curated: true }
  );

  assert.equal(match, null);
});

test("matchYoutubeVideoForIssue rejects videos with short inferred timestamp duration", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "Why Does Routine Matter So Much in Dementia Care?",
      publishedDate: "2026-06-16",
      topics: ["Routine", "Dementia Care"],
      excerpt: "Daily structure, routine, bathing, meals, safety, and caregiver support.",
      sections: []
    },
    [
      {
        id: "short2",
        title: "Why Does Routine Matter So Much in Dementia Care?",
        description: "TIMESTAMPS 0:00 Routine 0:48 Caregiver takeaway",
        publishedDate: "2026-06-16"
      }
    ],
    { curated: true }
  );

  assert.equal(match, null);
});

test("matchYoutubeVideoForIssue accepts same-day title matches with moderate topical overlap", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "IS HEARING LOSS LINKED TO DEMENTIA?",
      publishedDate: "2026-04-22",
      topics: ["Hearing Loss & Dementia"],
      excerpt:
        "Every week I sit with families navigating dementia, and I hear the same thing: it's just hearing loss.",
      sections: [
        {
          text:
            "A major study followed people for 15 years and found that individuals with slight or greater hearing loss faced a 71 percent greater risk of developing dementia."
        }
      ]
    },
    [
      {
        id: "NEsTuqSuq90",
        title: "Does Hearing Loss Increase Dementia Risk by 71%? 15-Year Study | Dr. Erik, MedBetter Health",
        description:
          "Hi everyone, Dr. Erik here from MedBetter Health. In my latest video, I review compelling evidence from a major 15-year longitudinal study showing that even mild hearing loss is associated with a 71% higher risk of developing dementia compared to individuals with normal hearing.",
        publishedDate: "2026-04-21"
      }
    ]
  );

  assert.equal(match.video.id, "NEsTuqSuq90");
  assert.equal(match.status, "matched");
  assert.match(match.reason, /same-day/i);
});

test("matchYoutubeVideoForIssue matches refreshed early LinkedIn issues to their curated videos", () => {
  const hearingMatch = matchYoutubeVideoForIssue(hearingIssue, [storedVideos.find((video) => video.id === "NEsTuqSuq90")]);
  const firstMatch = matchYoutubeVideoForIssue(firstIssue, [storedVideos.find((video) => video.id === "P3n0qn7N9b4")]);

  assert.equal(hearingMatch.video.id, "NEsTuqSuq90");
  assert.equal(firstMatch.video.id, "P3n0qn7N9b4");
});

test("matchYoutubeVideoForIssue uses curated date and description context without loosening automatic guesses", () => {
  const adultDayCareVideo = storedVideos.find((video) => video.id === "kPkLJ7csBbQ");
  const automaticMatch = matchYoutubeVideoForIssue(adultDayCareIssue, [adultDayCareVideo]);
  const curatedMatch = matchYoutubeVideoForIssue(adultDayCareIssue, [adultDayCareVideo], { curated: true });

  assert.equal(automaticMatch, null);
  assert.equal(curatedMatch.video.id, "kPkLJ7csBbQ");
  assert.match(curatedMatch.reason, /Curated same-day/i);
});

test("matchYoutubeVideoForIssue hides loose two-week caregiver burnout matches without transcript confidence", () => {
  const burnoutVideo = storedVideos.find((video) => video.id === "66eUaHWjGOA");
  const curatedMatch = matchYoutubeVideoForIssue(caregiverBurnoutIssue, [burnoutVideo], { curated: true });

  assert.equal(curatedMatch, null);
});

test("matchYoutubeVideoForIssue prefers the same-day curated treatment timeline for medication primers", () => {
  const treatmentTimelineVideo = storedVideos.find((video) => video.id === "6TKTjYbL4vE");
  const antipsychoticVideo = storedVideos.find((video) => video.id === "KHR-xnurG_M");
  const curatedMatch = matchYoutubeVideoForIssue(dementiaMedicationsIssue, [treatmentTimelineVideo], { curated: true });
  const automaticMatch = matchYoutubeVideoForIssue(dementiaMedicationsIssue, [treatmentTimelineVideo, antipsychoticVideo]);

  assert.equal(curatedMatch.video.id, "6TKTjYbL4vE");
  assert.equal(automaticMatch.video.id, "6TKTjYbL4vE");
  assert.match(curatedMatch.reason, /Curated same-day/i);
});

test("matchYoutubeVideoForIssue accepts same-day curated caregiver context and rejects weak off-date event matches", () => {
  const guideVideo = storedVideos.find((video) => video.id === "6ZlQDHwb7V8");
  const eventVideo = storedVideos.find((video) => video.id === "iBHbRbnB2ps");
  const patientCenteredMatch = matchYoutubeVideoForIssue(patientCenteredIssue, [guideVideo], { curated: true });
  const southFloridaMatch = matchYoutubeVideoForIssue(southFloridaIssue, [eventVideo], { curated: true });

  assert.equal(patientCenteredMatch.video.id, "6ZlQDHwb7V8");
  assert.match(patientCenteredMatch.reason, /Curated same-day/i);
  assert.equal(southFloridaMatch, null);
});

test("matchYoutubeVideoForIssue allows a nearby one-off only when transcript and description strongly match", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "Why Dementia Gets Worse Later in the Day",
      publishedDate: "2026-05-27",
      topics: ["Sundowning", "Sleep"],
      excerpt: "Sundowning, late-day confusion, sleep disruption, light exposure, and routines.",
      sections: []
    },
    [
      {
        id: "sundown1",
        title: "Why Dementia Gets Worse Later in the Day",
        description: "A one-off episode about sundowning, late-day confusion, sleep disruption, light exposure, and routines.",
        publishedDate: "2026-05-22",
        durationSeconds: 620,
        transcriptText:
          "Sundowning late-day confusion sleep disruption fading light routines caregivers reduce stimulation and support dementia care at night."
      },
      {
        id: "generic1",
        title: "Caregiver Support for Dementia Families",
        description: "General caregiving resources and dementia support.",
        publishedDate: "2026-06-21"
      }
    ]
  );

  assert.equal(match.video.id, "sundown1");
  assert.equal(match.status, "matched");
  assert.match(match.reason, /one-off/i);
});

test("matchYoutubeVideoForIssue rejects distant one-offs that look title-related but are not date-confident", () => {
  const match = matchYoutubeVideoForIssue(
    {
      title: "Why Dementia Gets Worse Later in the Day",
      publishedDate: "2026-06-21",
      topics: ["Sundowning", "Sleep"],
      excerpt: "Sundowning, late-day confusion, sleep disruption, light exposure, and routines.",
      sections: []
    },
    [
      {
        id: "sundown1",
        title: "Why Dementia Gets Worse Later in the Day",
        description: "Sundowning, late-day confusion, sleep disruption, light exposure, and routines.",
        publishedDate: "2026-05-22",
        durationSeconds: 620,
        transcriptText: "Sundowning late-day confusion routines and dementia care."
      }
    ],
    { curated: true }
  );

  assert.equal(match, null);
});
