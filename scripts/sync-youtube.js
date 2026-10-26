import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadIssues, validateIssue } from "../src/lib/content.js";
import {
  assertYoutubeVideoId,
  extractContinuationTokens,
  extractCaptionTracksFromWatchHtml,
  extractVideosFromYoutubeData,
  extractYoutubeConfig,
  extractYoutubeInitialData,
  matchYoutubeVideoForIssue,
  transcriptTextFromTimedTextJson,
  transcriptTextFromTimedTextXml,
  videoMetadataFromWatchHtml
} from "../src/lib/youtube.js";

const channelVideosUrl = "https://www.youtube.com/@erikilyayev/videos";
const youtubeBrowseUrl = "https://www.youtube.com/youtubei/v1/browse";
const userAgent =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function fetchText(url, { fetchImpl = fetch, ...options } = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml,application/json",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function fetchYoutubeContinuation({ config, token, fetchImpl }) {
  if (!config.apiKey || !config.clientVersion) return null;
  const response = await fetchImpl(`${youtubeBrowseUrl}?key=${config.apiKey}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": userAgent
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: config.clientName || "WEB",
          clientVersion: config.clientVersion,
          visitorData: config.visitorData
        }
      },
      continuation: token
    })
  });
  if (!response.ok) return null;
  return response.json();
}

function mergeVideos(...videoGroups) {
  const byId = new Map();
  for (const video of videoGroups.flat()) {
    if (!video?.id) continue;
    byId.set(video.id, { ...(byId.get(video.id) ?? {}), ...video });
  }
  return [...byId.values()];
}

function mergeVideoMetadata(video, metadata) {
  const merged = { ...video };
  for (const [key, value] of Object.entries(metadata)) {
    if (value === "" || value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    merged[key] = value;
  }
  return merged;
}

async function discoverChannelVideos({ fetchImpl = fetch, maxContinuationPages = 2 } = {}) {
  const html = await fetchText(channelVideosUrl, { fetchImpl });
  const config = extractYoutubeConfig(html);
  const initialData = extractYoutubeInitialData(html);
  if (!initialData) {
    throw new Error("Could not parse YouTube channel data");
  }

  let videos = extractVideosFromYoutubeData(initialData);
  let tokens = extractContinuationTokens(initialData);
  const seenTokens = new Set(tokens);

  for (let page = 0; page < maxContinuationPages && tokens.length > 0; page += 1) {
    const token = tokens.shift();
    const continuationData = await fetchYoutubeContinuation({ config, token, fetchImpl });
    if (!continuationData) continue;
    videos = mergeVideos(videos, extractVideosFromYoutubeData(continuationData));
    for (const nextToken of extractContinuationTokens(continuationData)) {
      if (seenTokens.has(nextToken)) continue;
      seenTokens.add(nextToken);
      tokens.push(nextToken);
    }
  }

  return videos;
}

async function fetchTranscriptFromWatchHtml(html, { fetchImpl = fetch } = {}) {
  const tracks = extractCaptionTracksFromWatchHtml(html);
  const englishTrack =
    tracks.find((track) => track.languageCode === "en" && track.kind !== "asr") ??
    tracks.find((track) => track.languageCode === "en") ??
    tracks[0];
  if (!englishTrack?.baseUrl) return { transcriptAvailable: tracks.length > 0 };

  const jsonUrl = englishTrack.baseUrl.includes("fmt=") ? englishTrack.baseUrl : `${englishTrack.baseUrl}&fmt=json3`;
  try {
    const transcriptJson = await fetchText(jsonUrl, {
      fetchImpl,
      headers: { accept: "application/json,text/xml,*/*" }
    });
    const transcriptText = transcriptTextFromTimedTextJson(transcriptJson);
    if (transcriptText) {
      return {
        transcriptAvailable: true,
        transcriptSource: englishTrack.kind === "asr" ? "youtube-auto-captions" : "youtube-captions",
        transcriptText
      };
    }
  } catch {
    // Fall back to XML timed text below.
  }

  try {
    const transcriptXml = await fetchText(englishTrack.baseUrl, {
      fetchImpl,
      headers: { accept: "text/xml,*/*" }
    });
    const transcriptText = transcriptTextFromTimedTextXml(transcriptXml);
    if (transcriptText) {
      return {
        transcriptAvailable: true,
        transcriptSource: englishTrack.kind === "asr" ? "youtube-auto-captions" : "youtube-captions",
        transcriptText
      };
    }
  } catch {
    // Leave transcript text absent if YouTube refuses the caption request.
  }

  return { transcriptAvailable: tracks.length > 0 };
}

function videoNeedsHydration(video, hydrateTranscripts) {
  if (!video.publishedDate || !video.url || !video.embedUrl || !video.thumbnailUrl || !video.description) return true;
  if (!hydrateTranscripts) return false;
  if (!Number.isSafeInteger(video.durationSeconds)) return true;
  return video.transcriptAvailable !== false && !video.transcriptText;
}

async function hydrateVideoMetadata(videos, { fetchImpl = fetch, hydrateTranscripts = true } = {}) {
  const hydrated = [];
  for (const video of videos) {
    if (!videoNeedsHydration(video, hydrateTranscripts)) {
      hydrated.push(video);
      continue;
    }

    const html = await fetchText(`https://www.youtube.com/watch?v=${video.id}`, { fetchImpl });
    const metadata = videoMetadataFromWatchHtml(video.id, html);
    const transcript = hydrateTranscripts ? await fetchTranscriptFromWatchHtml(html, { fetchImpl }) : {};
    hydrated.push(mergeVideoMetadata(video, { ...metadata, ...transcript }));
  }
  return hydrated.sort((a, b) => String(b.publishedDate).localeCompare(String(a.publishedDate)) || a.title.localeCompare(b.title));
}

function issueYoutubeVideo(video) {
  return {
    id: video.id,
    title: video.title,
    publishedDate: video.publishedDate,
    description: video.description ?? "",
    thumbnailUrl: video.thumbnailUrl ?? "",
    url: video.url,
    embedUrl: video.embedUrl
  };
}

function withoutYoutubeVideo(issue) {
  const { youtubeVideo, ...rest } = issue;
  return rest;
}

function withoutYoutubeCompanions(issue) {
  const { youtubeVideo, youtubeVideos, ...rest } = issue;
  return rest;
}

function noVideoReasonsBySlug(entries) {
  const reasons = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry === "string") {
      reasons.set(entry, "Owner confirmed this issue has no companion video.");
      continue;
    }
    if (entry && typeof entry.slug === "string") {
      reasons.set(entry.slug, entry.reason || "Owner confirmed this issue has no companion video.");
    }
  }
  return reasons;
}

function curatedMatchEntries(value) {
  if (!value) return [];
  if (typeof value === "string") return [{ id: value }];
  if (Array.isArray(value)) return value.flatMap(curatedMatchEntries);
  if (typeof value === "object" && typeof value.id === "string") return [value];
  return [];
}

function curatedMatchValues(value) {
  return curatedMatchEntries(value).map((entry) => entry.id);
}

function curatedVideoFromEntry(video, entry) {
  return {
    ...video,
    ...entry,
    id: video.id
  };
}

function curatedVideoStubs(curatedMatches) {
  const seen = new Set();
  const stubs = [];
  for (const value of Object.values(curatedMatches)) {
    for (const rawId of curatedMatchValues(value)) {
      if (!rawId || seen.has(rawId)) continue;
      try {
        const id = assertYoutubeVideoId(rawId);
        seen.add(id);
        stubs.push({ id });
      } catch {
        // Invalid curated IDs are ignored here and caught by issue validation if used elsewhere.
      }
    }
  }
  return stubs;
}

function reviewEntryForMatch(issue, match, source) {
  return {
    slug: issue.slug,
    issueNumber: issue.issueNumber ?? "",
    title: issue.title,
    publishedDate: issue.publishedDate,
    dateSource: issue.publishedDateSource ?? "issue",
    status: "matched",
    source,
    confidence: match.confidence,
    daysApart: Number.isFinite(match.daysApart) ? Math.round(match.daysApart) : null,
    reason: match.reason,
    scores: {
      title: match.titleScore,
      topic: match.topicalScore,
      description: match.descriptionScore,
      transcript: match.transcriptScore
    },
    video: {
      id: match.video.id,
      title: match.video.title,
      publishedDate: match.video.publishedDate ?? match.video.uploadDate ?? "",
      url: match.video.url,
      durationSeconds: match.video.durationSeconds ?? null,
      transcriptAvailable: Boolean(match.video.transcriptText || match.video.transcriptAvailable)
    }
  };
}

function reviewEntryForOwnerCuratedVideo(issue, video, match) {
  return {
    slug: issue.slug,
    issueNumber: issue.issueNumber ?? "",
    title: issue.title,
    publishedDate: issue.publishedDate,
    dateSource: issue.publishedDateSource ?? "issue",
    status: "matched",
    source: "curated",
    confidence: match?.confidence ?? 1,
    daysApart: Number.isFinite(match?.daysApart) ? Math.round(match.daysApart) : null,
    reason: match?.reason ?? "Owner-curated YouTube URL supplied; automatic scoring was not allowed to remove it.",
    scores: {
      title: match?.titleScore ?? null,
      topic: match?.topicalScore ?? null,
      description: match?.descriptionScore ?? null,
      transcript: match?.transcriptScore ?? null
    },
    video: {
      id: video.id,
      title: video.title,
      publishedDate: video.publishedDate ?? video.uploadDate ?? "",
      url: video.url,
      durationSeconds: video.durationSeconds ?? null,
      transcriptAvailable: Boolean(video.transcriptText || video.transcriptAvailable)
    }
  };
}

function reviewEntryForCuratedVideos(issue, videos) {
  return {
    slug: issue.slug,
    issueNumber: issue.issueNumber ?? "",
    title: issue.title,
    publishedDate: issue.publishedDate,
    dateSource: issue.publishedDateSource ?? "issue",
    status: "matched",
    source: "curated-multiple",
    confidence: 1,
    daysApart: null,
    reason: "Multiple owner-curated companion videos were supplied for this event issue.",
    videos: videos.map((video) => ({
      id: video.id,
      title: video.title,
      publishedDate: video.publishedDate ?? video.uploadDate ?? "",
      url: video.url,
      durationSeconds: video.durationSeconds ?? null,
      transcriptAvailable: Boolean(video.transcriptText || video.transcriptAvailable)
    }))
  };
}

function reviewEntryForHidden(issue, reason) {
  return {
    slug: issue.slug,
    issueNumber: issue.issueNumber ?? "",
    title: issue.title,
    publishedDate: issue.publishedDate,
    dateSource: issue.publishedDateSource ?? "issue",
    status: "hidden",
    reason
  };
}

function youtubeReviewPayload(existingReview, reviewIssues) {
  const policy =
    "Show a companion YouTube episode only when date and long-form title, description, transcript, and duration signals make a confident match. Short videos and loose one-off guesses stay hidden.";
  const reviewChanged =
    !existingReview ||
    existingReview.policy !== policy ||
    JSON.stringify(existingReview.issues ?? []) !== JSON.stringify(reviewIssues);
  return {
    generatedAt: reviewChanged ? new Date().toISOString() : existingReview.generatedAt,
    policy,
    issues: reviewIssues
  };
}

async function writeIssue(rootDir, issue) {
  const validIssue = validateIssue(issue);
  const filePath = path.join(rootDir, "content", "issues", `${validIssue.slug}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(validIssue, null, 2)}\n`, "utf8");
}

export async function syncYoutube({
  rootDir = process.cwd(),
  fetchImpl = fetch,
  maxContinuationPages = Number(process.env.YOUTUBE_CONTINUATION_PAGES || 2),
  offline = process.env.YOUTUBE_OFFLINE === "1",
  hydrateTranscripts = process.env.YOUTUBE_HYDRATE_TRANSCRIPTS !== "0" && !offline
} = {}) {
  const videosPath = path.join(rootDir, "content", "youtube-videos.json");
  const matchesPath = path.join(rootDir, "content", "youtube-matches.json");
  const noVideoPath = path.join(rootDir, "content", "youtube-no-video.json");
  const reviewPath = path.join(rootDir, "content", "youtube-review.json");
  const existingVideos = await readJson(videosPath, []);
  const curatedMatches = await readJson(matchesPath, {});
  const noVideoReasons = noVideoReasonsBySlug(await readJson(noVideoPath, []));
  const existingReview = await readJson(reviewPath, null);

  const discoveredVideos = offline ? [] : await discoverChannelVideos({ fetchImpl, maxContinuationPages });
  const videos = await hydrateVideoMetadata(mergeVideos(existingVideos, discoveredVideos, curatedVideoStubs(curatedMatches)), {
    fetchImpl,
    hydrateTranscripts
  });
  const videoById = new Map(videos.map((video) => [video.id, video]));
  const issues = await loadIssues(rootDir);
  const curatedVideoOwners = new Map();
  for (const [slug, value] of Object.entries(curatedMatches)) {
    for (const entry of curatedMatchEntries(value)) {
      if (!entry.id) continue;
      if (!curatedVideoOwners.has(entry.id)) curatedVideoOwners.set(entry.id, new Set());
      curatedVideoOwners.get(entry.id).add(slug);
    }
  }
  const updated = [];
  const unmatched = [];
  const reviewIssues = [];

  for (const issue of issues) {
    const noVideoReason = noVideoReasons.get(issue.slug);
    if (noVideoReason) {
      reviewIssues.push(reviewEntryForHidden(issue, noVideoReason));
      if ("youtubeVideo" in issue || "youtubeVideos" in issue) {
        await writeIssue(rootDir, withoutYoutubeCompanions(issue));
        updated.push(issue.slug);
      }
      continue;
    }

    const curatedEntries = curatedMatchEntries(curatedMatches[issue.slug]);
    const curatedVideoIds = curatedEntries.map((entry) => entry.id);
    const curatedVideos = curatedEntries
      .map((entry) => {
        const video = videoById.get(entry.id);
        return video ? curatedVideoFromEntry(video, entry) : null;
      })
      .filter(Boolean);

    if (curatedVideoIds.length > 1 && curatedVideos.length === curatedVideoIds.length) {
      const nextIssue = {
        ...withoutYoutubeVideo(issue),
        youtubeVideos: curatedVideos.map(issueYoutubeVideo)
      };
      reviewIssues.push(reviewEntryForCuratedVideos(issue, curatedVideos));
      if (
        "youtubeVideo" in issue ||
        JSON.stringify(issue.youtubeVideos ?? []) !== JSON.stringify(nextIssue.youtubeVideos)
      ) {
        await writeIssue(rootDir, nextIssue);
        updated.push(issue.slug);
      }
      continue;
    }

    const curatedEntry = curatedEntries[0] ?? null;
    const curatedVideoId = curatedEntry?.id ?? "";
    const curatedVideo = curatedEntry && videoById.has(curatedVideoId)
      ? curatedVideoFromEntry(videoById.get(curatedVideoId), curatedEntry)
      : null;
    const curatedMatch = curatedVideo ? matchYoutubeVideoForIssue(issue, [curatedVideo], { curated: true }) : null;
    if (curatedVideo) {
      const nextIssue = {
        ...issue,
        youtubeVideo: issueYoutubeVideo(curatedVideo)
      };
      reviewIssues.push(reviewEntryForOwnerCuratedVideo(issue, curatedVideo, curatedMatch));
      if (JSON.stringify(issue.youtubeVideo ?? null) !== JSON.stringify(nextIssue.youtubeVideo)) {
        await writeIssue(rootDir, nextIssue);
        updated.push(issue.slug);
      }
      continue;
    }

    const automaticVideos = videos.filter((video) => {
      const owners = curatedVideoOwners.get(video.id);
      return !owners || owners.has(issue.slug);
    });
    const automaticMatch = matchYoutubeVideoForIssue(issue, automaticVideos);
    const match = automaticMatch;
    const source = "automatic";

    if (!match) {
      unmatched.push(issue.slug);
      reviewIssues.push(reviewEntryForHidden(issue, "No confident date, title, transcript, duration, and description match found."));
      if (issue.youtubeVideo) {
        await writeIssue(rootDir, withoutYoutubeVideo(issue));
        updated.push(issue.slug);
      }
      continue;
    }

    const nextIssue = {
      ...issue,
      youtubeVideo: issueYoutubeVideo(match.video)
    };
    reviewIssues.push(reviewEntryForMatch(issue, match, source));
    if (JSON.stringify(issue.youtubeVideo ?? null) !== JSON.stringify(nextIssue.youtubeVideo)) {
      await writeIssue(rootDir, nextIssue);
      updated.push(issue.slug);
    }
  }

  await fs.writeFile(videosPath, `${JSON.stringify(videos, null, 2)}\n`, "utf8");
  await fs.writeFile(reviewPath, `${JSON.stringify(youtubeReviewPayload(existingReview, reviewIssues), null, 2)}\n`, "utf8");
  return { videos, updated, unmatched, review: reviewIssues };
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  const result = await syncYoutube().catch((error) => {
    console.error(error);
    process.exitCode = 1;
    return null;
  });

  if (result) {
    console.log(
      `Synced ${result.videos.length} YouTube video(s); updated ${result.updated.length} issue(s); unmatched ${result.unmatched.length} issue(s).`
    );
    if (result.unmatched.length > 0) {
      console.log(`Unmatched issue(s): ${result.unmatched.join(", ")}`);
    }
  }
}
