export function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function assertYoutubeVideoId(videoId) {
  const value = String(videoId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(value)) {
    throw new Error(`Invalid YouTube video ID: ${videoId}`);
  }
  return value;
}

export function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${assertYoutubeVideoId(videoId)}`;
}

export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${assertYoutubeVideoId(videoId)}`;
}

export function youtubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${assertYoutubeVideoId(videoId)}/hqdefault.jpg`;
}

function extractBalancedJsonValue(html, marker) {
  const start = String(html).indexOf(marker);
  if (start === -1) return null;

  let index = start + marker.length;
  while (index < html.length && !["{", "["].includes(html[index])) index += 1;
  if (index >= html.length) return null;

  const opener = html[index];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opener) depth += 1;
    if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return html.slice(start + marker.length, index + 1).trim();
      }
    }
  }

  return null;
}

function extractBalancedJson(html, marker) {
  const json = extractBalancedJsonValue(html, marker);
  return json?.startsWith("{") ? json : null;
}

export function extractYoutubeInitialData(html) {
  const json = extractBalancedJson(String(html), "var ytInitialData = ");
  return json ? JSON.parse(json) : null;
}

export function extractYoutubeConfig(html) {
  const source = String(html);
  return {
    apiKey: source.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] ?? "",
    clientName: source.match(/"INNERTUBE_CLIENT_NAME":"([^"]+)"/)?.[1] ?? "WEB",
    clientVersion: source.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] ?? "",
    visitorData: source.match(/"VISITOR_DATA":"([^"]+)"/)?.[1] ?? ""
  };
}

export function extractContinuationTokens(data) {
  const tokens = [];
  const seen = new Set();

  function walk(value) {
    if (!value || typeof value !== "object") return;
    const token = value.continuationCommand?.token;
    if (token && !seen.has(token)) {
      seen.add(token);
      tokens.push(token);
    }
    for (const child of Object.values(value)) walk(child);
  }

  walk(data);
  return tokens;
}

export function extractVideosFromYoutubeData(data) {
  const videos = [];
  const seen = new Set();

  function addVideo(video) {
    const id = video?.id || video?.videoId;
    if (!id || seen.has(id)) return;
    seen.add(id);
    videos.push(video);
  }

  function walk(value) {
    if (!value || typeof value !== "object") return;

    if (value.lockupViewModel?.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
      const lockup = value.lockupViewModel;
      const rows = lockup.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows ?? [];
      addVideo({
        id: lockup.contentId,
        title: decodeHtml(lockup.metadata?.lockupMetadataViewModel?.title?.content ?? ""),
        relativeDate: rows
          .flatMap((row) => row.metadataParts ?? [])
          .map((part) => part.text?.accessibilityLabel || part.text?.content || "")
          .find((part) => /\bago\b/i.test(part)) ?? "",
        url: youtubeWatchUrl(lockup.contentId),
        embedUrl: youtubeEmbedUrl(lockup.contentId),
        thumbnailUrl: youtubeThumbnailUrl(lockup.contentId)
      });
    }

    if (value.videoRenderer?.videoId) {
      const renderer = value.videoRenderer;
      addVideo({
        id: renderer.videoId,
        title: decodeHtml(renderer.title?.runs?.map((run) => run.text).join("") ?? renderer.title?.simpleText ?? ""),
        relativeDate: renderer.publishedTimeText?.simpleText ?? "",
        url: youtubeWatchUrl(renderer.videoId),
        embedUrl: youtubeEmbedUrl(renderer.videoId),
        thumbnailUrl: youtubeThumbnailUrl(renderer.videoId)
      });
    }

    for (const child of Object.values(value)) walk(child);
  }

  walk(data);
  return videos;
}

function metaContent(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    String(html).match(new RegExp(`<meta[^>]+(?:name|property|itemprop)=["']${escapedName}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1] ??
    String(html).match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property|itemprop)=["']${escapedName}["']`, "i"))?.[1] ??
    ""
  );
}

function jsonStringValue(html, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html).match(new RegExp(`"${escapedKey}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

function isGenericYoutubeDescription(value) {
  return /enjoy the videos and music you love|upload original content|share it all with friends/i.test(String(value));
}

function cleanDescription(value) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

function durationSecondsFromWatchHtml(html) {
  const lengthSeconds = String(html).match(/"lengthSeconds":"?(\d+)"?/)?.[1];
  if (lengthSeconds) {
    const seconds = Number(lengthSeconds);
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
  }

  const approxDurationMs = String(html).match(/"approxDurationMs":"?(\d+)"?/)?.[1];
  if (!approxDurationMs) return null;
  const seconds = Math.round(Number(approxDurationMs) / 1000);
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}

function durationSecondsFromTimestamps(value) {
  const matches = [
    ...String(value).matchAll(/\b(?:(\d{1,2}):)?([0-5]?\d):([0-5]\d)\b/g)
  ];
  if (matches.length === 0) return null;

  const lastTimestamp = Math.max(
    ...matches.map((match) => Number(match[1] || 0) * 3600 + Number(match[2]) * 60 + Number(match[3]))
  );
  return Number.isSafeInteger(lastTimestamp) && lastTimestamp > 0 ? lastTimestamp + 15 : null;
}

export function extractCaptionTracksFromWatchHtml(html) {
  const json = extractBalancedJsonValue(String(html), '"captionTracks":');
  if (!json?.startsWith("[")) return [];

  try {
    return JSON.parse(json)
      .map((track) => ({
        baseUrl: decodeHtml(track.baseUrl ?? ""),
        languageCode: track.languageCode ?? "",
        kind: track.kind ?? "",
        name: track.name?.simpleText ?? track.name?.runs?.map((run) => run.text).join("") ?? ""
      }))
      .filter((track) => track.baseUrl);
  } catch {
    return [];
  }
}

function cleanTranscriptText(value) {
  return decodeHtml(value).replace(/\s+/g, " ").trim();
}

export function transcriptTextFromTimedTextJson(value) {
  const data = typeof value === "string" ? JSON.parse(value) : value;
  const text = (data?.events ?? [])
    .flatMap((event) => event.segs ?? [])
    .map((segment) => segment.utf8 ?? "")
    .filter((segment) => segment && segment !== "\n")
    .join(" ");
  return cleanTranscriptText(text);
}

export function transcriptTextFromTimedTextXml(value) {
  const text = [...String(value).matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map((match) => match[1])
    .join(" ");
  return cleanTranscriptText(text);
}

export function videoMetadataFromWatchHtml(videoId, html) {
  const id = assertYoutubeVideoId(videoId);
  const title =
    metaContent(html, "title") ||
    metaContent(html, "og:title") ||
    String(html).match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+-\s+YouTube\s*$/i, "") ||
    "";
  const publishedDate =
    String(html).match(/"datePublished":"([^"]+)"/)?.[1] ||
    metaContent(html, "datePublished") ||
    String(html).match(/"publishDate":"([^"]+)"/)?.[1] ||
    "";
  const uploadDate = String(html).match(/"uploadDate":"([^"]+)"/)?.[1] || publishedDate;
  const shortDescription = cleanDescription(jsonStringValue(html, "shortDescription"));
  const metaDescription = cleanDescription(metaContent(html, "description") || metaContent(html, "og:description"));
  const description =
    shortDescription ||
    (metaDescription && !isGenericYoutubeDescription(metaDescription) ? metaDescription : "") ||
    cleanDescription(jsonStringValue(html, "description"));
  const durationSeconds = durationSecondsFromWatchHtml(html);
  const captionTracks = extractCaptionTracksFromWatchHtml(html);

  const metadata = {
    id,
    title: decodeHtml(title),
    publishedDate: publishedDate.slice(0, 10),
    uploadDate: uploadDate.slice(0, 10),
    description,
    url: youtubeWatchUrl(id),
    embedUrl: youtubeEmbedUrl(id),
    thumbnailUrl: youtubeThumbnailUrl(id)
  };
  if (durationSeconds) metadata.durationSeconds = durationSeconds;
  else {
    const inferredDurationSeconds = durationSecondsFromTimestamps(description);
    if (inferredDurationSeconds) metadata.inferredDurationSeconds = inferredDurationSeconds;
  }
  if (captionTracks.length > 0) metadata.transcriptAvailable = true;
  return metadata;
}

const stopWords = new Set(
  "the a an and or of to with in on for my loved one dr erik ilyayev md model guide medbetterhealth it its really actually first someone this that from by at as every your you they them their most more than ever after before new not be have has into get gets got went will won t still if s m i we he she his her our only explained complete breakdown why what when where who how can could would should do does did is are am".split(
    " "
  )
);

const wordMap = new Map([
  ["alzheimers", "alzheimer"],
  ["diagnosed", "diagnose"],
  ["diagnosis", "diagnose"],
  ["doctors", "doctor"],
  ["driving", "drive"],
  ["hallucinations", "hallucination"],
  ["delusions", "delusion"],
  ["behaviors", "behavior"],
  ["behaviour", "behavior"],
  ["changes", "change"],
  ["drug", "medication"],
  ["drugs", "medication"],
  ["medications", "medication"],
  ["antipsychotics", "medication"],
  ["treatment", "medication"],
  ["treatments", "medication"],
  ["therapy", "medication"],
  ["therapies", "medication"],
  ["accusations", "accuse"],
  ["accusing", "accuse"],
  ["confused", "confusion"],
  ["suddenly", "sudden"],
  ["families", "family"],
  ["foods", "food"],
  ["eating", "eat"],
  ["nutrition", "food"],
  ["person", "patient"],
  ["people", "patient"],
  ["caregivers", "caregiver"],
  ["groups", "group"],
  ["treatments", "treatment"],
  ["hearing", "hear"],
  ["sundowning", "sundown"],
  ["awake", "night"],
  ["hospitalization", "hospital"],
  ["hospitalized", "hospital"],
  ["ultraprocessed", "process"],
  ["processed", "process"],
  ["values", "value"],
  ["anosognosia", "refuse"],
  ["refuses", "refuse"],
  ["refused", "refuse"],
  ["meds", "medication"],
  ["decisions", "decide"],
  ["decision", "decide"]
]);

function normalizeWord(word) {
  let value = String(word).replace(/'s$/i, "").toLowerCase();
  if (wordMap.has(value)) return wordMap.get(value);
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("ing") && value.length > 6) return value.slice(0, -3);
  if (value.endsWith("ed") && value.length > 5) return value.slice(0, -2);
  if (value.endsWith("s") && value.length > 4) return value.slice(0, -1);
  return value;
}

function tokens(value) {
  return new Set(
    decodeHtml(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !stopWords.has(word))
      .map(normalizeWord)
      .filter((word) => word.length >= 2 && !stopWords.has(word))
  );
}

export function tokenSet(value) {
  return tokens(value);
}

function similarity(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return overlap / Math.sqrt(Math.max(left.size, 1) * Math.max(right.size, 1));
}

function tokenStats(a, b) {
  const left = tokens(a);
  const right = tokens(b);
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }
  return { leftSize: left.size, rightSize: right.size, overlap };
}

function daysApart(left, right) {
  if (!left || !right) return Infinity;
  return Math.abs((new Date(left) - new Date(right)) / 86400000);
}

function roundedScore(value) {
  return Math.round(value * 1000) / 1000;
}

function matchReason(days, topicalScore, titleScore, curated) {
  const source = curated ? "Curated" : "Companion";
  if (days <= 1) return `${source} same-day candidate with ${roundedScore(topicalScore)} topic overlap.`;
  if (days <= 3) return `${source} nearby-date candidate with ${roundedScore(topicalScore)} topic overlap.`;
  if (days <= 45) return `${source} one-off candidate (${Math.round(days)} day gap, ${roundedScore(titleScore)} title overlap).`;
  return `Companion candidate with ${Math.round(days)} day gap.`;
}

export function matchYoutubeVideoForIssue(
  issue,
  videos,
  { sameDayThreshold = 0.39, nearbyThreshold = 0.42, curated = false, minimumDurationSeconds = 180 } = {}
) {
  let best = null;
  const issueText = [
    issue.title,
    ...(issue.topics ?? []),
    issue.excerpt ?? "",
    ...(issue.sections ?? []).map((section) => section.text || (section.items ?? []).join(" "))
  ].join(" ");

  for (const video of videos) {
    const durationSeconds =
      Number(video.durationSeconds) ||
      Number(video.inferredDurationSeconds) ||
      durationSecondsFromTimestamps(video.description ?? "");
    if (Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds < minimumDurationSeconds) {
      continue;
    }

    const titleScore = similarity(issue.title, video.title);
    const titleStats = tokenStats(issue.title, video.title);
    const videoDescription = video.description ?? "";
    const videoTranscript = video.transcriptText ?? "";
    const videoText = [video.title, videoDescription, videoTranscript].join(" ");
    const bodyScore = similarity(issueText, videoText);
    const descriptionScore = similarity(issueText, videoDescription);
    const transcriptScore = similarity(issueText, videoTranscript);
    const topicalScore = Math.max(bodyScore, descriptionScore, transcriptScore);
    const strongestLongformScore = Math.max(descriptionScore, transcriptScore);
    const distance = daysApart(issue.publishedDate, video.publishedDate || video.uploadDate);
    const dateScore = Number.isFinite(distance) ? Math.max(0, 1 - distance / 45) : 0;
    const score = titleScore * 0.36 + topicalScore * 0.44 + dateScore * 0.2;

    let qualifies = false;
    if (distance <= 1) {
      qualifies =
        topicalScore >= sameDayThreshold ||
        (titleScore >= 0.45 && topicalScore >= 0.24) ||
        (titleStats.overlap >= 3 && topicalScore >= 0.18) ||
        (titleStats.leftSize <= 2 && titleStats.overlap >= 1 && topicalScore >= 0.3) ||
        (titleScore >= 0.6 && titleStats.overlap >= 3);
      if (!qualifies && curated) {
        qualifies =
          topicalScore >= 0.33 ||
          (titleScore >= 0.4 && topicalScore >= 0.24) ||
          (titleStats.overlap >= 2 && topicalScore >= 0.24) ||
          (strongestLongformScore >= 0.265 && topicalScore >= 0.265) ||
          (titleStats.overlap >= 1 && strongestLongformScore >= 0.22 && topicalScore >= 0.22);
      }
    } else if (distance <= 3) {
      qualifies =
        topicalScore >= nearbyThreshold ||
        (titleScore >= 0.55 && topicalScore >= 0.3) ||
        (titleScore >= 0.55 && titleStats.overlap >= 2 && topicalScore >= 0.22) ||
        (titleScore >= 0.6 && titleStats.overlap >= 3);
      if (!qualifies && curated) {
        qualifies =
          topicalScore >= 0.34 ||
          (titleScore >= 0.4 && topicalScore >= 0.24) ||
          (titleStats.overlap >= 2 && topicalScore >= 0.24);
      }
    } else if (curated && distance <= 7) {
      qualifies = titleStats.overlap >= 2 && topicalScore >= 0.42 && strongestLongformScore >= 0.38;
    } else if (distance <= 7) {
      qualifies =
        (titleScore >= 0.7 && strongestLongformScore >= 0.36) ||
        (titleScore >= 0.58 && titleStats.overlap >= 3 && strongestLongformScore >= 0.36) ||
        (topicalScore >= 0.52 && strongestLongformScore >= nearbyThreshold);
    }

    if (qualifies && (!best || score > best.score)) {
      best = {
        video,
        status: "matched",
        score,
        confidence: roundedScore(score),
        titleScore: roundedScore(titleScore),
        bodyScore: roundedScore(bodyScore),
        descriptionScore: roundedScore(descriptionScore),
        transcriptScore: roundedScore(transcriptScore),
        topicalScore: roundedScore(topicalScore),
        titleOverlap: titleStats.overlap,
        daysApart: distance,
        reason: matchReason(distance, topicalScore, titleScore, curated)
      };
    }
  }

  if (!best) return null;
  return best;
}
