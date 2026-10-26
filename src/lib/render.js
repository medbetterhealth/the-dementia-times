import { assertYoutubeVideoId, youtubeEmbedUrl } from "./youtube.js";
import { LOCALES, localeAlternates, localeConfig, localeNotice, localePathDepth, localizedPagePath } from "./i18n.js";
import {
  SEARCH_GUIDES,
  bestSnippetForIssue,
  buildSearchIndex,
  normalizeSearchValue,
  searchCategoriesForIssue
} from "./search.js";
import { formatUi, ui } from "./ui-text.js";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function attr(value) {
  return escapeHtml(value);
}

const BRAND_IMAGE_DIMENSIONS = {
  publicationMark: { width: 44, height: 44 },
  medBetterLogo: { width: 142, height: 42 },
  headshot: { width: 180, height: 180 },
  youtubeBanner: { width: 1200, height: 200 }
};

const UNIFIED_GUIDE_REPLACED_IMAGE_SRCS = new Set([
  "/assets/issues/what-support-do-dementia-caregivers-actually-need-at-home/image-8.png",
  "/assets/issues/why-does-respite-care-sometimes-fail-for-dementia-caregivers/image-10.png",
  "/assets/issues/how-is-dementia-actually-diagnosed/image-11.png",
  "/assets/issues/how-is-dementia-actually-diagnosed/image-12.png",
  "/assets/issues/why-do-dementia-behaviors-happen-and-what-should-families-do/image-8.png",
  "/assets/issues/what-my-grandmother-taught-me-about-dementia-care/image-8.png",
  "/assets/issues/what-my-grandmother-taught-me-about-dementia-care/image-9.png"
]);

export function imageDimensionAttrs(image = {}) {
  if (!Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)) return "";
  if (image.width <= 0 || image.height <= 0) return "";
  return ` width="${attr(image.width)}" height="${attr(image.height)}"`;
}

function issueCoverDimensions(issue) {
  return imageDimensionAttrs({
    width: issue.coverWidth ?? issue.coverImageWidth,
    height: issue.coverHeight ?? issue.coverImageHeight
  });
}

export function issueSlugSegment(issue) {
  return slugSegment(issue.slug);
}

function slugSegment(value) {
  const slug = String(value);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(`Invalid issue slug: ${slug}`);
  }
  return slug;
}

export function issueUrl(issue) {
  return `/issues/${issueSlugSegment(issue)}/`;
}

function authorUrl() {
  return "/author/dr-erik-ilyayev/";
}

function topicUrl(topic) {
  return `/topics/${slugSegment(topic)}/`;
}

function relativeInternalUrl(pathname, depth = 0) {
  const value = String(pathname);
  if (!value.startsWith("/")) {
    return value;
  }

  const normalized = value.slice(1);
  const prefix = "../".repeat(depth);
  return normalized ? `${prefix}${normalized}` : prefix || "./";
}

function versionedInternalUrl(pathname, depth = 0, version = "") {
  const url = relativeInternalUrl(pathname, depth);
  const normalizedVersion = String(version).trim();
  if (!normalizedVersion) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(normalizedVersion)}`;
}

function relativePageUrl(pathname, depth = 0, locale = "en") {
  return relativeInternalUrl(localizedPagePath(pathname, locale), depth);
}

function relativeIssueUrl(issue, depth = 0, locale = "en") {
  return relativePageUrl(issueUrl(issue), depth, locale);
}

function siteBaseUrl(site) {
  return String(site.siteUrl || "https://thedementiatimes.com").replace(/\/+$/, "");
}

function absoluteUrl(site, value = "/") {
  const url = String(value || "/");
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, `${siteBaseUrl(site)}/`).href;
}

function sourceUrl(issue) {
  const url = new URL(issue.sourceUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.linkedin.com") {
    throw new Error(`Invalid issue sourceUrl: ${issue.sourceUrl}`);
  }
  return url.href;
}

function jsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function renderStructuredData(items = []) {
  return items
    .filter(Boolean)
    .map((item) => `<script type="application/ld+json">${jsonLd(item)}</script>`)
    .join("\n  ");
}

function personSchema(site) {
  return {
    "@type": "Person",
    name: site.author.name,
    url: site.author.linkedinUrl,
    jobTitle: site.author.role,
    image: absoluteUrl(site, site.author.headshot)
  };
}

function organizationSchema(site) {
  return {
    "@type": "Organization",
    name: "MedBetter Health",
    url: site.brand.medBetterUrl,
    logo: absoluteUrl(site, site.brand.logo)
  };
}

function renderHeadMetadata({
  site,
  title,
  description,
  canonicalUrl,
  alternatePathname = "/",
  imageUrl,
  imageAlt,
  type = "website",
  publishedDate = "",
  structuredData = []
}) {
  const socialImage = imageUrl || absoluteUrl(site, site.brand.publicationMark || site.brand.logo);
  const socialImageAlt = imageAlt || site.title;
  const articleMeta = publishedDate
    ? `\n  <meta property="article:published_time" content="${attr(publishedDate)}">\n  <meta property="article:author" content="${attr(site.author.name)}">`
    : "";
  const structured = renderStructuredData(structuredData);
  const alternateLinks = localeAlternates(alternatePathname)
    .map((locale) => `<link rel="alternate" hreflang="${attr(locale.htmlLang)}" href="${attr(absoluteUrl(site, locale.pathname))}">`)
    .join("\n  ");
  const xDefault = `<link rel="alternate" hreflang="x-default" href="${attr(absoluteUrl(site, localizedPagePath(alternatePathname, "en")))}">`;

  return `<link rel="canonical" href="${attr(canonicalUrl)}">
  ${alternateLinks}
  ${xDefault}
  <meta property="og:type" content="${attr(type)}">
  <meta property="og:title" content="${attr(title)}">
  <meta property="og:description" content="${attr(description)}">
  <meta property="og:url" content="${attr(canonicalUrl)}">
  <meta property="og:image" content="${attr(socialImage)}">
  <meta property="og:image:alt" content="${attr(socialImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${attr(title)}">
  <meta name="twitter:description" content="${attr(description)}">
  <meta name="twitter:image" content="${attr(socialImage)}">${articleMeta}${structured ? `\n  ${structured}` : ""}`;
}

function renderFeedLinks(site, pathDepth = 0, locale = "en") {
  return `<link rel="alternate" type="application/rss+xml" title="${attr(`${site.title} RSS`)}" href="${attr(absoluteUrl(site, localizedPagePath("/feed.xml", locale)))}">
  <link rel="alternate" type="application/feed+json" title="${attr(`${site.title} JSON Feed`)}" href="${attr(absoluteUrl(site, localizedPagePath("/feed.json", locale)))}">
  <link rel="alternate" type="text/plain" title="${attr(`${site.title} for AI assistants`)}" href="${attr(absoluteUrl(site, localizedPagePath("/llms.txt", locale)))}">
  <meta name="robots" content="index, follow, max-image-preview:large">`;
}

function renderPreloadLinks(preloads = []) {
  return preloads
    .filter(Boolean)
    .map((preload) => {
      const href = typeof preload === "string" ? preload : preload.href;
      const as = typeof preload === "string" ? "image" : preload.as || "image";
      const type = typeof preload === "string" ? "" : preload.type || "";
      if (!href) return "";
      return `<link rel="preload" href="${attr(href)}" as="${attr(as)}"${type ? ` type="${attr(type)}"` : ""}>`;
    })
    .filter(Boolean)
    .join("\n  ");
}

function renderLanguageSwitcher({ site, pathDepth = 0, locale = "en", pathname = "/" }) {
  const text = ui(locale);
  const links = LOCALES.map((entry) => {
    const href = relativeInternalUrl(localizedPagePath(pathname, entry.code), pathDepth);
    const current = entry.code === locale;
    return `<a href="${attr(href)}" hreflang="${attr(entry.htmlLang)}" lang="${attr(entry.htmlLang)}"${current ? ' aria-current="true"' : ""} data-language-link>${escapeHtml(entry.label)}</a>`;
  }).join("");
  return `<nav class="language-switcher" aria-label="${attr(text.languageLabel)}">${links}</nav>`;
}

function renderAnalyticsScript(site) {
  const plausibleDomain = site.analytics?.plausibleDomain;
  if (!site.analytics?.enabled || !plausibleDomain) return "";
  return `<script defer data-domain="${attr(plausibleDomain)}" src="https://plausible.io/js/script.outbound-links.js"></script>`;
}

function renderTopics(topics = []) {
  return topics.map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`).join("");
}

const defaultGuideScenarios = [
  "Medicare may cover home care services so you can rest, go to your own appointment, or have dinner with family while your loved one is cared for.",
  "A 24/7 support line gives you somewhere to call when Mom is acting different at night and you are not sure what to do.",
  "Care guidance can help you handle shower refusal, medication refusal, agitation, or confusion with calmer steps."
];

function renderGuideCta(site, pathDepth = 0, { compact = false } = {}) {
  const guide = site.guide ?? {};
  const guideUrl = guide.url ?? "https://intakeguide.medbetterhealth.org";
  const cta = guide.cta ?? "Apply for GUIDE";

  if (compact) {
    return `<aside class="guide-box guide-box--compact">
        ${guide.label ? `<p class="guide-label">${escapeHtml(guide.label)}</p>` : ""}
        <h2>${escapeHtml(guide.compactTitle ?? guide.title ?? "Support for families navigating dementia care")}</h2>
        <p>${escapeHtml(guide.compactBody ?? guide.body ?? "MedBetterHealth helps eligible families understand dementia care support through Medicare's GUIDE Model.")}</p>
        <a class="button-link guide-button" href="${attr(guideUrl)}">${escapeHtml(cta)}</a>
      </aside>`;
  }

  const scenarios = (guide.benefitScenarios?.length ? guide.benefitScenarios : defaultGuideScenarios)
    .map(
      (scenario, index) => `<li>
          <span>${String(index + 1).padStart(2, "0")}</span>
          <p>${escapeHtml(scenario)}</p>
        </li>`
    )
    .join("");
  const finePrint = guide.finePrint ? `<p class="guide-fine-print">${escapeHtml(guide.finePrint)}</p>` : "";

  return `<aside class="guide-box guide-box--article guide-box--imagine" aria-label="GUIDE Model family support">
        ${guide.label ? `<p class="guide-label">${escapeHtml(guide.label)}</p>` : ""}
        <h2>${escapeHtml(guide.title ?? "Imagine a world where dementia support shows up before you hit a breaking point.")}</h2>
        <p class="guide-lede">${escapeHtml(guide.body ?? "You do not have to imagine anymore. MedBetterHealth helps eligible families in Florida and New York understand whether Medicare's GUIDE Model can help at home.")}</p>
        <ul class="guide-scenarios">${scenarios}</ul>
        ${guide.secondaryBody ? `<p class="guide-close">${escapeHtml(guide.secondaryBody)}</p>` : ""}
        <a class="button-link guide-button" href="${attr(guideUrl)}">${escapeHtml(cta)}</a>
        ${finePrint}
      </aside>`;
}

function renderSignupModal(site, locale = "en") {
  const text = ui(locale);
  const capture = site.newsletterCapture ?? {};
  const endpointAttr = capture.endpoint ? ` data-capture-endpoint="${attr(capture.endpoint)}"` : "";
  const providerAttr = capture.provider ? ` data-capture-provider="${attr(capture.provider)}"` : "";
  return `<div class="signup-modal" data-newsletter-modal data-signup-saving="${attr(text.signupSaving)}" data-signup-saved="${attr(text.signupSaved)}" data-signup-opening="${attr(text.signupOpening)}" hidden>
    <div class="signup-modal-backdrop" data-newsletter-dismiss></div>
    <section class="signup-dialog" role="dialog" aria-modal="true" aria-labelledby="newsletter-modal-title" aria-describedby="newsletter-modal-copy">
      <button class="signup-close" type="button" data-newsletter-dismiss aria-label="${attr(text.signupClose)}">&times;</button>
      <p class="kicker">${escapeHtml(text.dailyNewsletter)}</p>
      <h2 id="newsletter-modal-title">${escapeHtml(text.signupTitle)}</h2>
      <p id="newsletter-modal-copy">${escapeHtml(text.signupCopy)}</p>
      <form class="signup-form" data-newsletter-signup data-signup-url="${attr(site.newsletterUrl)}"${endpointAttr}${providerAttr}>
        <label for="newsletter-email">${escapeHtml(text.emailAddress)}</label>
        <div>
          <input id="newsletter-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required>
          <button class="button-link" type="submit">${escapeHtml(text.continue)}</button>
        </div>
      </form>
      <p class="signup-note" data-newsletter-message>${escapeHtml(text.signupNote)}</p>
    </section>
  </div>`;
}

function textSummary(value, maxLength = 420) {
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const sliced = clean.slice(0, maxLength);
  const sentenceEnd = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("?"), sliced.lastIndexOf("!"));
  if (sentenceEnd > 120) return sliced.slice(0, sentenceEnd + 1);
  return `${sliced.replace(/\s+\S*$/, "")}...`;
}

function directAnswerText(issue) {
  if (issue.answer?.text) return issue.answer.text;
  const paragraphs = (issue.sections ?? [])
    .filter((section) => section.type === "paragraph" && section.text)
    .map((section) => section.text)
    .filter((text) => !/^This is education, not medical advice/i.test(text));
  return textSummary(paragraphs.slice(0, 3).join(" ") || issue.excerpt);
}

function practicalSteps(issue, max = 3) {
  const listSection = (issue.sections ?? []).find((section) => section.type === "list" && section.items?.length);
  const items = (listSection?.items ?? [])
    .map((item) => String(item).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, max);
  if (items.length > 0) return items;

  return [
    "Write down what changed, when it started, and what was happening right before it.",
    "Reduce noise, slow the conversation down, and use one simple step at a time.",
    "Share the pattern with the family, care team, or clinician so everyone responds consistently."
  ];
}

function clinicalWarningText(locale = "en") {
  return ui(locale).clinicalWarning;
}

function articleFaqs(issue, locale = "en") {
  const text = ui(locale);
  const answer = directAnswerText(issue);
  const steps = practicalSteps(issue, 3);
  return [
    {
      question: issue.answer?.title || issue.title,
      answer
    },
    {
      question: text.whatCaregiversTry,
      answer: steps.join(" ")
    },
    {
      question: text.whenCallClinician,
      answer: clinicalWarningText(locale)
    }
  ].filter((faq) => faq.question && faq.answer);
}

function renderAnswerBox(issue, locale = "en") {
  const text = ui(locale);
  const answer = directAnswerText(issue);
  if (!answer) return "";
  const steps = practicalSteps(issue);
  const stepList = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const videoCount = issueYoutubeVideos(issue).length;
  const videoSection = videoCount > 0
    ? `<section>
            <h3><a class="care-brief-video-link" href="#article-video-heading">${escapeHtml(text.relatedVideo)}</a></h3>
            <p>${escapeHtml(videoCount === 1 ? text.relatedVideoOne : formatUi(text.relatedVideoMany, videoCount))}</p>
          </section>`
    : "";

  return `<aside class="answer-box care-brief" aria-labelledby="short-answer-heading">
        <div class="care-brief-intro">
          <p class="kicker">${escapeHtml(text.quickCareBrief)}</p>
          <h2 id="short-answer-heading">${escapeHtml(issue.answer?.title ?? text.whatFamiliesKnow)}</h2>
          <p>${escapeHtml(answer)}</p>
        </div>
        <div class="care-brief-grid">
          <section>
            <h3>${escapeHtml(text.whatThisMeans)}</h3>
            <p>${escapeHtml(text.whatThisMeansCopy)}</p>
          </section>
          <section>
            <h3>${escapeHtml(text.tryToday)}</h3>
            <ul>${stepList}</ul>
          </section>
          <section>
            <h3>${escapeHtml(text.callDoctorWhen)}</h3>
            <p>${escapeHtml(clinicalWarningText(locale))}</p>
          </section>
          ${videoSection}
        </div>
      </aside>`;
}

function renderArticleTools(site, issue, pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const articleUrl = absoluteUrl(site, localizedPagePath(issueUrl(issue), locale));
  const subject = encodeURIComponent(`${issue.title} | ${text.shareSubjectSuffix}`);
  const body = encodeURIComponent(`${text.emailShareIntro}\n\n${issue.title}\n${articleUrl}`);
  const sharePanelId = `share-${issueSlugSegment(issue)}`;
  const smsBody = `${text.smsShareIntro}\n${issue.title}\n${articleUrl}`;
  const smsUrl = `sms:?body=${encodeURIComponent(smsBody)}`;
  return `<div class="article-actions">
        <nav class="article-tools" aria-label="${attr(text.articleActionsLabel)}">
          <button type="button" data-print-article>${escapeHtml(text.printArticle)}</button>
          <button type="button" data-share-article data-share-target="${attr(sharePanelId)}" aria-expanded="false">${escapeHtml(text.sendToFamily)}</button>
          <a href="${attr(relativePageUrl("/glossary/", pathDepth, locale))}">${escapeHtml(text.glossary)}</a>
        </nav>
        <section class="article-share-panel" id="${attr(sharePanelId)}" data-share-panel hidden>
          <div>
            <p class="kicker">${escapeHtml(text.shareArticle)}</p>
            <h2>${escapeHtml(text.shareHeading)}</h2>
            <p>${escapeHtml(text.shareCopy)}</p>
          </div>
          <div class="share-options">
            <a class="button-link share-option-button" href="mailto:?subject=${subject}&body=${body}">${escapeHtml(text.sendByEmail)}</a>
            <a class="button-link share-option-button" href="${attr(smsUrl)}">${escapeHtml(text.sendText)}</a>
          </div>
        </section>
      </div>`;
}

function renderArticleTrustPanel(site, issue, locale = "en") {
  const text = ui(locale);
  return `<aside class="article-trust" aria-label="${attr(text.articleReviewLabel)}">
        <p><strong>${escapeHtml(text.writtenBy)}</strong> <a href="${attr(relativePageUrl(authorUrl(), localePathDepth(2, locale), locale))}">${escapeHtml(site.author.name)}</a>, ${escapeHtml(site.author.role)}.</p>
        <p><strong>${escapeHtml(text.published)}</strong> <time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time>${issue.updatedDate ? ` · <strong>${escapeHtml(text.updated)}</strong> <time datetime="${attr(issue.updatedDate)}">${escapeHtml(issue.updatedDate)}</time>` : ""}</p>
        <p>${escapeHtml(text.educationalNotice)}</p>
      </aside>`;
}

function renderArticleFaq(issue, locale = "en") {
  const text = ui(locale);
  const faqs = articleFaqs(issue, locale);
  if (faqs.length === 0) return "";
  const items = faqs
    .map((faq) => `<details>
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>`)
    .join("");
  return `<section class="article-faq topic-section" aria-labelledby="article-faq-heading">
        <p class="kicker">${escapeHtml(text.commonQuestions)}</p>
        <h2 id="article-faq-heading">${escapeHtml(text.quickAnswers)}</h2>
        ${items}
      </section>`;
}

function relatedIssuesFor(issue, issues = [], max = 3) {
  const topicSet = new Set((issue.topics ?? []).map(topicValue));
  return issues
    .filter((candidate) => candidate.slug !== issue.slug)
    .map((candidate) => {
      const overlap = (candidate.topics ?? []).filter((topic) => topicSet.has(topicValue(topic))).length;
      return { candidate, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || String(b.candidate.publishedDate).localeCompare(String(a.candidate.publishedDate)))
    .slice(0, max)
    .map((entry) => entry.candidate);
}

function renderRelatedIssues(issue, issues = [], pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const related = relatedIssuesFor(issue, issues);
  if (related.length === 0) return "";
  const items = related
    .map(
      (relatedIssue) => `<li>
          <a href="${attr(relativeIssueUrl(relatedIssue, pathDepth, locale))}">${escapeHtml(relatedIssue.title)}</a>
          <time datetime="${attr(relatedIssue.publishedDate)}">${escapeHtml(relatedIssue.publishedDate)}</time>
        </li>`
    )
    .join("");
  return `<section class="topic-section related-issues" aria-labelledby="related-issues-heading">
        <p class="kicker">${escapeHtml(text.keepReading)}</p>
        <h2 id="related-issues-heading">${escapeHtml(text.relatedArticles)}</h2>
        <ul class="topic-issue-list">${items}</ul>
      </section>`;
}

function renderYoutubeBanner(site, pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const url = site.brand.youtubePlaylistUrl || site.brand.youtubeUrl;
  if (!site.brand.youtubeBanner || !url) return "";
  return `<figure class="article-youtube-figure">
          <a class="article-youtube-link" href="${attr(url)}" aria-label="${attr(text.youtubeBannerAria)}">
            <span class="article-youtube-media"><img src="${attr(relativeInternalUrl(site.brand.youtubeBanner, pathDepth))}" alt="Straight Talk with Dr. Erik" loading="lazy" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.youtubeBanner)}></span>
          </a>
        </figure>`;
}

function issueYoutubeVideos(issue) {
  const videos = [];
  if (issue.youtubeVideo?.id) videos.push(issue.youtubeVideo);
  if (Array.isArray(issue.youtubeVideos)) videos.push(...issue.youtubeVideos.filter((video) => video?.id));

  const seen = new Set();
  return videos.filter((video) => {
    if (seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  });
}

function videoSchema(video, fallbackDescription, fallbackThumbnail) {
  return {
    "@type": "VideoObject",
    name: video.title,
    description: video.description || fallbackDescription,
    thumbnailUrl: video.thumbnailUrl || fallbackThumbnail,
    uploadDate: video.publishedDate,
    embedUrl: video.embedUrl,
    url: video.url
  };
}

function renderYoutubeEmbed(issue, locale = "en") {
  const text = ui(locale);
  const videos = issueYoutubeVideos(issue);
  if (videos.length === 0) return "";
  const multiple = videos.length > 1;
  const videoFrames = videos
    .map((video) => {
      const id = assertYoutubeVideoId(video.id);
      const embedUrl = video.embedUrl || youtubeEmbedUrl(id);
      if (!embedUrl.startsWith("https://www.youtube-nocookie.com/embed/")) {
        throw new Error(`Invalid YouTube embed URL: ${embedUrl}`);
      }

      return `<article class="article-video-item">
            <h3>${escapeHtml(video.title)}</h3>
            <div class="video-frame">
              <iframe src="${attr(embedUrl)}" title="${attr(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
            <p class="video-link"><a href="${attr(video.url)}">${escapeHtml(text.openOnYoutube)}</a></p>
          </article>`;
    })
    .join("");

  return `<section class="article-video" aria-labelledby="article-video-heading">
        <div class="article-video-heading">
          <p class="kicker">${escapeHtml(multiple ? text.companionEpisodes : text.companionEpisode)}</p>
          <h2 id="article-video-heading">${escapeHtml(text.straightTalk)}</h2>
          <p>${multiple ? escapeHtml(formatUi(text.relatedVideoMany, videos.length)) : escapeHtml(videos[0].title)}</p>
        </div>
        <div class="article-video-list">${videoFrames}</div>
      </section>`;
}

function topicValue(topic) {
  return String(topic).trim().toLowerCase();
}

function searchableText(value) {
  return String(value).trim().toLowerCase();
}

const ARCHIVE_FILTER_CATEGORIES = SEARCH_GUIDES.map((guide) => ({
  value: guide.category || guide.id,
  label: guide.label
}));

const ARCHIVE_SEARCH_PHRASES_BY_SLUG = {
  "what-is-dementia": "forgetful repeated questions memory normal aging is this dementia first signs",
  "is-hearing-loss-linked-to-dementia": "hearing aids cannot hear communication brain health risk hearing test",
  "delusions-and-hallucinations": "seeing things hearing things hallucinating delusions false beliefs scared",
  "wandering-and-elopement": "leaving house wandering elopement doors getting lost safety bracelet",
  "sundowning": "late afternoon evening sundowning gets worse at night agitation tired",
  "why-is-mom-being-so-aggressive-what-behavioral-changes-in-dementia-really-mean-and-what-to-do-about-them":
    "mom dad aggressive yelling hitting agitation behavior changed mean refuses help",
  "why-does-my-loved-one-with-dementia-refuse-to-shower-and-what-can-i-actually-do-about-it":
    "mom shower bath bathing hygiene wash clean clothes screams fights wrists refuses shower will not bathe",
  "why-won-t-my-loved-one-with-dementia-take-their-medication":
    "refuses pills medication medicine meds will not take pills hiding pills",
  "when-should-someone-with-dementia-stop-driving": "driving car keys license unsafe stop driving",
  "why-is-my-loved-one-with-dementia-accusing-me-of-stealing":
    "accusing stealing stole money missing purse wallet paranoia accusations",
  "should-medication-be-the-first-answer-for-dementia-agitation": "agitation medication antipsychotic aggressive behavior medicine",
  "why-is-my-loved-one-awake-all-night-the-biological-reason-dementia-destroys-sleep":
    "awake all night sleep nighttime wandering tired insomnia",
  "is-it-normal-to-feel-overwhelmed-caring-for-someone-with-dementia":
    "overwhelmed burnout caregiver burden exhausted stressed alone",
  "why-did-my-loved-one-with-dementia-suddenly-become-confused":
    "suddenly confused delirium infection dehydration sudden change worse overnight",
  "why-do-dementia-care-decisions-tear-families-apart": "family conflict fighting siblings decisions disagree",
  "can-you-still-trust-what-you-hear-in-the-age-of-ai": "scam ai voice cloning fraud phone calls grandparent scam safety",
  "why-does-eating-become-so-hard-in-dementia": "eating meals food swallowing chewing pocketing aspiration won't eat",
  "why-do-dementia-patients-refuse-help": "refuses help says nothing wrong anosognosia no insight thinks fine mom won't accept care",
  "why-is-my-l-o-accusing-me-of-stealing": "false truths accusing stealing money paranoia delusion"
};

function issueSectionSearchText(issue) {
  return (issue.sections ?? [])
    .map((section) => {
      if (section.text) return section.text;
      if (Array.isArray(section.items)) return section.items.join(" ");
      if (section.alt) return section.alt;
      return "";
    })
    .join(" ");
}

function archiveCategoriesForIssue(issue) {
  return searchCategoriesForIssue(issue, SEARCH_GUIDES);
}

function archiveSearchText(issue) {
  const categoryLabels = archiveCategoriesForIssue(issue)
    .map((value) => ARCHIVE_FILTER_CATEGORIES.find((category) => category.value === value)?.label || value)
    .join(" ");
  const text = [
    issue.title,
    issue.excerpt,
    (issue.topics ?? []).join(" "),
    categoryLabels,
    issueYoutubeVideos(issue).map((video) => video.title).join(" "),
    ARCHIVE_SEARCH_PHRASES_BY_SLUG[issue.slug] ?? "",
    issueSectionSearchText(issue)
  ]
    .filter(Boolean)
    .join(" ");

  return searchableText(text.replace(/\s+/g, " ").slice(0, 4200));
}

function renderShell({
  site,
  title,
  description,
  body,
  script = "",
  pathDepth = 0,
  locale = "en",
  pathname = "/",
  canonicalUrl = absoluteUrl(site, "/"),
  imageUrl = "",
  type = "website",
  publishedDate = "",
  imageAlt = "",
  structuredData = [],
  preloads = []
}) {
  const text = ui(locale);
  const currentLocale = localeConfig(locale);
  const switcher = renderLanguageSwitcher({ site, pathDepth, locale, pathname });
  const notice = localeNotice(locale, site.localeStatus);
  const publicationMark = site.brand.publicationMark || site.brand.logo;
  const faviconType = publicationMark.endsWith(".svg") ? "image/svg+xml" : "image/png";
  const publicationMarkUrl = versionedInternalUrl(publicationMark, pathDepth, site.assetsVersion);
  const preloadLinks = renderPreloadLinks(preloads);
  const analyticsScript = renderAnalyticsScript(site);
  return `<!doctype html>
<html lang="${attr(currentLocale.htmlLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${attr(description)}">
  ${renderHeadMetadata({ site, title, description, canonicalUrl, alternatePathname: pathname, imageUrl, imageAlt, type, publishedDate, structuredData })}
  ${renderFeedLinks(site, pathDepth, locale)}
  ${preloadLinks ? `${preloadLinks}\n  ` : ""}${analyticsScript ? `${analyticsScript}\n  ` : ""}<meta name="theme-color" content="#17334a">
  <link rel="icon" type="${attr(faviconType)}" href="${attr(publicationMarkUrl)}">
  <link rel="apple-touch-icon" href="${attr(publicationMarkUrl)}">
  <link rel="stylesheet" href="${attr(versionedInternalUrl("/styles/site.css", pathDepth, site.assetsVersion))}">
</head>
<body>
  <div class="site-shell">
    <header class="topbar">
      <a class="publication-brand" href="${attr(relativePageUrl("/", pathDepth, locale))}" aria-label="${attr(text.publicationHomeLabel(site.title))}">
        <img src="${attr(relativeInternalUrl(publicationMark, pathDepth))}" alt="" aria-hidden="true" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.publicationMark)}>
        <span>
          <strong>${escapeHtml(site.title)}</strong>
          <small>${escapeHtml(text.brandTagline)}</small>
        </span>
      </a>
      <nav class="site-nav" aria-label="${attr(text.primaryNavLabel)}">
        <a href="${attr(relativePageUrl("/", pathDepth, locale))}">${escapeHtml(text.home)}</a>
        <a href="${attr(relativePageUrl("/search/", pathDepth, locale))}">${escapeHtml(text.search)}</a>
        <a href="${attr(relativePageUrl("/topics/", pathDepth, locale))}">${escapeHtml(text.topics)}</a>
        <a href="${attr(relativePageUrl("/subscribe/", pathDepth, locale))}">${escapeHtml(text.subscribe)}</a>
      </nav>
      ${switcher}
      <a class="partner-brand" href="${attr(site.brand.medBetterUrl)}" aria-label="MedBetterHealth">
        <span>${escapeHtml(text.presentedBy)}</span>
        <img src="${attr(relativeInternalUrl(site.brand.logo, pathDepth))}" alt="MedBetter Health" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.medBetterLogo)}>
      </a>
    </header>
    ${notice ? `<p class="translation-notice">${escapeHtml(notice)}</p>` : ""}
    ${body}
    <footer class="site-footer">
      <a class="author-link" href="${attr(site.author.linkedinUrl)}">
        <img src="${attr(relativeInternalUrl(site.author.headshot, pathDepth))}" alt="${attr(site.author.name)}" loading="lazy" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.headshot)}>
        <span>${escapeHtml(site.author.name)}</span>
      </a>
      <p>${escapeHtml(site.description)}</p>
      <nav class="footer-links" aria-label="${attr(text.footerFeeds)}">
        <a href="${attr(relativePageUrl("/subscribe/", pathDepth, locale))}">${escapeHtml(text.subscribe)}</a>
        <a href="${attr(relativePageUrl("/glossary/", pathDepth, locale))}">${escapeHtml(text.glossary)}</a>
        <a href="${attr(relativePageUrl("/feed.xml", pathDepth, locale))}">${escapeHtml(text.rssFeed)}</a>
        <a href="${attr(relativePageUrl("/feed.json", pathDepth, locale))}">${escapeHtml(text.jsonFeed)}</a>
        <a href="${attr(relativePageUrl("/llms.txt", pathDepth, locale))}">${escapeHtml(text.aiGuide)}</a>
      </nav>
    </footer>
  </div>
  ${script}
</body>
</html>`;
}

function guideInsertionIndex(sections = []) {
  if (sections.length === 0) return 0;
  const target = Math.max(1, Math.floor(sections.length * 0.45));
  for (let index = target; index < sections.length - 1; index += 1) {
    if (["paragraph", "list", "quote", "callout"].includes(sections[index].type)) return index + 1;
  }
  const firstParagraph = sections.findIndex((section) => section.type === "paragraph");
  return firstParagraph === -1 ? Math.min(sections.length, target) : Math.min(sections.length, firstParagraph + 1);
}

export function renderIssueBody(issue, { pathDepth = 0, midArticleHtml = "" } = {}) {
  const renderedSections = issue.sections
    .map((section) => {
      if (section.type === "heading") {
        return `<h2>${escapeHtml(section.text)}</h2>`;
      }
      if (section.type === "paragraph") {
        return `<p>${escapeHtml(section.text)}</p>`;
      }
      if (section.type === "image") {
        const image = `<img src="${attr(relativeInternalUrl(section.src, pathDepth))}" alt="${attr(section.alt)}" loading="lazy" decoding="async"${imageDimensionAttrs(section)}>`;
        return `<figure>${image}</figure>`;
      }
      if (section.type === "list") {
        const items = section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
        return `<ul>${items}</ul>`;
      }
      if (section.type === "quote") {
        return `<blockquote>${escapeHtml(section.text)}</blockquote>`;
      }
      if (section.type === "callout") {
        return `<aside class="callout">${escapeHtml(section.text)}</aside>`;
      }
      return "";
    });

  if (midArticleHtml) {
    renderedSections.splice(guideInsertionIndex(issue.sections), 0, midArticleHtml);
  }

  const sections = renderedSections.join("\n");

  const disclaimer = issue.disclaimer
    ? `<aside class="disclaimer">${escapeHtml(issue.disclaimer)}</aside>`
    : "";

  return `${sections}
${disclaimer}`;
}

function renderUnplacedIssueImages(issue, pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const placedSources = new Set(
    (issue.sections ?? [])
      .filter((section) => section.type === "image" && section.src)
      .map((section) => section.src)
  );
  const extras = (issue.images ?? []).filter(
    (image) =>
      image.src &&
      !placedSources.has(image.src) &&
      image.src !== issue.coverImage &&
      !UNIFIED_GUIDE_REPLACED_IMAGE_SRCS.has(image.src)
  );
  if (extras.length === 0) return "";

  const figures = extras
    .map(
      (image, index) => `<figure>
          <img src="${attr(relativeInternalUrl(image.src, pathDepth))}" alt="${attr(image.alt || `${issue.title} slide ${index + 1}`)}" loading="lazy" decoding="async"${imageDimensionAttrs(image)}>
        </figure>`
    )
    .join("");

  return `<section class="article-slide-gallery" aria-labelledby="additional-slides-heading">
          <p class="kicker">${escapeHtml(text.slideDeckNote)}</p>
          <h2 id="additional-slides-heading">${escapeHtml(text.extraVisual)}</h2>
          <div>${figures}</div>
        </section>`;
}

export function renderIssuePage({ site, issue, previousIssue, nextIssue, issues = [], locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(2, locale);
  const pathname = issueUrl(issue);
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const imageUrl = absoluteUrl(site, issue.coverImage);
  const videos = issueYoutubeVideos(issue);
  const video = videos.length === 0 ? null : videos.map((item) => videoSchema(item, issue.excerpt, imageUrl));
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: issue.title,
    description: issue.excerpt,
    datePublished: issue.publishedDate,
    dateModified: issue.updatedDate || issue.publishedDate,
    author: personSchema(site),
    publisher: organizationSchema(site),
    image: [imageUrl],
    keywords: (issue.topics ?? []).join(", "),
    about: (issue.topics ?? []).map((topic) => ({ "@type": "Thing", name: topic })),
    isAccessibleForFree: true,
    mainEntityOfPage: canonicalUrl,
    ...(video ? { video: video.length === 1 ? video[0] : video } : {})
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.title, item: absoluteUrl(site, localizedPagePath("/", locale)) },
      { "@type": "ListItem", position: 2, name: text.issues, item: absoluteUrl(site, localizedPagePath("/#archive", locale)) },
      { "@type": "ListItem", position: 3, name: issue.title, item: canonicalUrl }
    ]
  };
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: articleFaqs(issue, locale).map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer }
    }))
  };
  const navItems = [
    previousIssue
      ? `<a href="${attr(relativeIssueUrl(previousIssue, pathDepth, locale))}"><span>${escapeHtml(text.previousIssue)}</span><strong>${escapeHtml(previousIssue.title)}</strong></a>`
      : "",
    nextIssue
      ? `<a href="${attr(relativeIssueUrl(nextIssue, pathDepth, locale))}"><span>${escapeHtml(text.nextIssue)}</span><strong>${escapeHtml(nextIssue.title)}</strong></a>`
      : ""
  ]
    .filter(Boolean)
    .join("");

  const body = `<main class="article-page">
    <article class="article">
      <a class="back-link" href="${attr(relativePageUrl("/", pathDepth, locale))}">${escapeHtml(text.backToArchive)}</a>
      <header class="article-header">
      <p class="kicker">${escapeHtml(text.issue)} ${escapeHtml(issue.issueNumber ?? "")}</p>
      <h1>${escapeHtml(issue.title)}</h1>
      <p class="issue-meta">${escapeHtml(issue.publishedDate)} ${escapeHtml(text.by)} <a class="author-link" href="${attr(site.author.linkedinUrl)}">${escapeHtml(issue.author)}</a></p>
      <div class="topics">${renderTopics(issue.topics)}</div>
      </header>
      ${renderArticleTools(site, issue, pathDepth, locale)}
      <img class="article-cover" src="${attr(relativeInternalUrl(issue.coverImage, pathDepth))}" alt="${attr(issue.title)}" fetchpriority="high" decoding="async"${issueCoverDimensions(issue)}>
      ${renderAnswerBox(issue, locale)}
      ${renderArticleTrustPanel(site, issue, locale)}
      ${renderYoutubeEmbed(issue, locale)}
      <div class="article-body">
        ${renderIssueBody(issue, { pathDepth, midArticleHtml: renderGuideCta(site, pathDepth) })}
        ${renderUnplacedIssueImages(issue, pathDepth, locale)}
        ${renderYoutubeBanner(site, pathDepth, locale)}
        ${renderArticleFaq(issue, locale)}
        ${renderRelatedIssues(issue, issues, pathDepth, locale)}
        <p><a class="source-link button-link" href="${attr(sourceUrl(issue))}">${escapeHtml(text.viewOriginal)}</a></p>
      </div>
    </article>
    <nav class="issue-nav" aria-label="Issue navigation">${navItems}</nav>
  </main>`;

  return renderShell({
    site: { ...site, localeStatus: issue.localeStatus ?? site.localeStatus },
    title: `${issue.title} | ${site.title}`,
    description: issue.excerpt,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    imageUrl,
    imageAlt: issue.title,
    type: "article",
    publishedDate: issue.publishedDate,
    structuredData: [articleSchema, faqSchema, breadcrumbSchema],
    script: `<script src="${attr(versionedInternalUrl("/client/archive-filter.js", pathDepth, site.assetsVersion))}" defer></script>`,
    preloads: [{ href: relativeInternalUrl(issue.coverImage, pathDepth), as: "image" }]
  });
}

function topicBySlug(issues) {
  const map = new Map();
  for (const issue of issues) map.set(issue.slug, issue);
  return map;
}

export function renderTopicPage({ site, topic, issues, locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(2, locale);
  const issueMap = topicBySlug(issues);
  const linkedIssues = (topic.issueSlugs ?? []).map((slug) => issueMap.get(slug)).filter(Boolean);
  const pathname = topicUrl(topic.slug);
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const title = `${topic.title} | ${text.topicGuide} | ${site.title}`;
  const issueLinks = linkedIssues
    .map(
      (issue) => `<li><a href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">${escapeHtml(issue.title)}</a><time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time></li>`
    )
    .join("");
  const takeaways = (topic.keyTakeaways ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const faqs = (topic.faqs ?? [])
    .map((faq) => `<details><summary>${escapeHtml(faq.question)}</summary><p>${escapeHtml(faq.answer)}</p></details>`)
    .join("");
  const sources = (topic.sources ?? [])
    .map((source) => `<li><a href="${attr(source.url)}">${escapeHtml(source.title)}</a></li>`)
    .join("");
  const faqSchema =
    topic.faqs?.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: topic.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer }
          }))
        }
      : null;
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: site.title, item: absoluteUrl(site, localizedPagePath("/", locale)) },
      { "@type": "ListItem", position: 2, name: text.topics, item: absoluteUrl(site, localizedPagePath("/topics/", locale)) },
      { "@type": "ListItem", position: 3, name: topic.title, item: canonicalUrl }
    ]
  };
  const topicSchema = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: topic.title,
    description: topic.description,
    url: canonicalUrl,
    author: personSchema(site),
    publisher: organizationSchema(site),
    reviewedBy: personSchema(site),
    mainEntity: { "@type": "Question", name: topic.title, acceptedAnswer: { "@type": "Answer", text: topic.directAnswer } }
  };
  const body = `<main class="topic-page">
    <a class="back-link" href="${attr(relativePageUrl("/topics/", pathDepth, locale))}">${escapeHtml(text.backToTopics)}</a>
    <header class="topic-hero">
      <p class="kicker">${escapeHtml(text.topicGuide)}</p>
      <h1>${escapeHtml(topic.title)}</h1>
      <p>${escapeHtml(topic.description)}</p>
    </header>
    <section class="answer-box">
      <p class="kicker">${escapeHtml(text.shortAnswer)}</p>
      <h2>${escapeHtml(text.directAnswer)}</h2>
      <p>${escapeHtml(topic.directAnswer)}</p>
    </section>
    ${takeaways ? `<section class="topic-section"><h2>${escapeHtml(text.keyTakeaways)}</h2><ul>${takeaways}</ul></section>` : ""}
    ${faqs ? `<section class="topic-section"><h2>${escapeHtml(text.commonQuestions)}</h2>${faqs}</section>` : ""}
    ${issueLinks ? `<section class="topic-section"><h2>${escapeHtml(text.relatedIssues)}</h2><ul class="topic-issue-list">${issueLinks}</ul></section>` : ""}
    ${sources ? `<section class="topic-section" id="sources"><h2>${escapeHtml(text.sources)}</h2><ul>${sources}</ul></section>` : ""}
  </main>`;

  return renderShell({
    site,
    title,
    description: topic.description,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    type: "article",
    structuredData: [topicSchema, faqSchema, breadcrumbSchema]
  });
}

export function renderTopicIndexPage({ site, topics, locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(1, locale);
  const pathname = "/topics/";
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const cards = topics
    .map(
      (topic) => `<article class="topic-card">
        <h2><a href="${attr(relativePageUrl(topicUrl(topic.slug), pathDepth, locale))}">${escapeHtml(topic.title)}</a></h2>
        <p>${escapeHtml(topic.description)}</p>
      </article>`
    )
    .join("");
  const body = `<main class="topic-index">
    <header class="topic-hero">
      <p class="kicker">${escapeHtml(text.aiReadableCareGuides)}</p>
      <h1>${escapeHtml(text.topicGuides)}</h1>
      <p>${escapeHtml(text.topicIndexCopy)}</p>
    </header>
    <section class="topic-grid">${cards}</section>
  </main>`;
  return renderShell({
    site,
    title: `${text.topicGuides} | ${site.title}`,
    description: text.topicIndexCopy,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: text.topicGuides,
        url: canonicalUrl,
        author: personSchema(site),
        publisher: organizationSchema(site)
      }
    ]
  });
}

export function renderSubscribePage({ site, issues, locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(1, locale);
  const [latestIssue] = issues;
  const pathname = "/subscribe/";
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const latest = latestIssue
    ? `<aside class="subscribe-latest">
        <p class="kicker">${escapeHtml(text.latestEdition)}</p>
        <h2><a href="${attr(relativeIssueUrl(latestIssue, pathDepth, locale))}">${escapeHtml(latestIssue.title)}</a></h2>
        <p>${escapeHtml(text.issue)} ${escapeHtml(latestIssue.issueNumber ?? "")} · <time datetime="${attr(latestIssue.publishedDate)}">${escapeHtml(latestIssue.publishedDate)}</time></p>
      </aside>`
    : "";
  const body = `<main class="subscribe-page">
    <header class="subscribe-hero">
      <p class="kicker">${escapeHtml(text.dailyBriefing)}</p>
      <h1>${escapeHtml(text.subscribeTitle)}</h1>
      <p>${escapeHtml(text.subscribeCopy)}</p>
      <div class="subscribe-actions">
        <a class="button-link" href="${attr(site.newsletterUrl)}">${escapeHtml(text.subscribeOnLinkedIn)}</a>
        <a class="text-link" href="${attr(relativePageUrl("/feed.xml", pathDepth, locale))}">${escapeHtml(text.rssFeed)}</a>
        <a class="text-link" href="${attr(relativePageUrl("/feed.json", pathDepth, locale))}">${escapeHtml(text.jsonFeed)}</a>
      </div>
    </header>
    <section class="subscribe-options" aria-label="${attr(text.waysToFollow)}">
      <article>
        <p class="kicker">${escapeHtml(text.inbox)}</p>
        <h2>${escapeHtml(text.linkedInNewsletter)}</h2>
        <p>${escapeHtml(text.linkedInNewsletterCopy)}</p>
        <a href="${attr(site.newsletterUrl)}">${escapeHtml(text.openNewsletter)}</a>
      </article>
      <article>
        <p class="kicker">${escapeHtml(text.readers)}</p>
        <h2>${escapeHtml(text.feedReaderLinks)}</h2>
        <p>${escapeHtml(text.feedReaderCopy)}</p>
        <div class="feed-actions">
          <a href="${attr(relativePageUrl("/feed.xml", pathDepth, locale))}">${escapeHtml(text.openRssFeed)}</a>
          <a href="${attr(relativePageUrl("/feed.json", pathDepth, locale))}">${escapeHtml(text.openJsonFeed)}</a>
        </div>
      </article>
      <article>
        <p class="kicker">${escapeHtml(text.video)}</p>
        <h2>${escapeHtml(text.straightTalk)}</h2>
        <p>${escapeHtml(text.videoCopy)}</p>
        <a href="${attr(site.brand.youtubeUrl)}">${escapeHtml(text.openYoutube)}</a>
      </article>
    </section>
    ${latest}
  </main>`;

  return renderShell({
    site,
    title: `${text.subscribe} | ${site.title}`,
    description: text.subscribeCopy,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: `${text.subscribe} ${site.title}`,
        url: canonicalUrl,
        description: text.subscribeCopy,
        publisher: organizationSchema(site),
        author: personSchema(site)
      }
    ]
  });
}

export function renderStartHerePage({ site, issues, topics = [], locale = "en", searchGuides = SEARCH_GUIDES }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(1, locale);
  const pathname = "/start-here/";
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const cards = searchGuides
    .map(
      (guide) => `<a class="path-card" href="${attr(relativePageUrl(`/search/?path=${encodeURIComponent(guide.id)}`, pathDepth, locale))}">
        <span class="kicker">${escapeHtml(guide.label)}</span>
        <strong>${escapeHtml(guide.commonQuestions?.[0]?.question || guide.label)}</strong>
        <span>${escapeHtml(guide.description)}</span>
        <span class="path-action">${escapeHtml(text.seeBestArticles)}</span>
      </a>`
    )
    .join("");
  const topicCards = topics
    .slice(0, 5)
    .map(
      (topic) => `<a href="${attr(relativePageUrl(topicUrl(topic.slug), pathDepth, locale))}">
        <span>${escapeHtml(topic.title)}</span>
        <small>${escapeHtml(topic.description)}</small>
      </a>`
    )
    .join("");
  const body = `<main class="start-page">
    <header class="start-hero">
      <p class="kicker">${escapeHtml(text.startHere)}</p>
      <h1>${escapeHtml(text.startHeroTitle)}</h1>
      <p>${escapeHtml(text.startHeroCopy)}</p>
    </header>
    <section class="pathway-grid pathway-grid--search" aria-label="${attr(text.readerPathwaysLabel)}">${cards}</section>
    <section class="topic-rail" aria-label="${attr(text.topicShortcuts)}">
      <div>
        <p class="kicker">${escapeHtml(text.preferBrowsing)}</p>
        <h2>${escapeHtml(text.topicPagesStillHere)}</h2>
        <p>${escapeHtml(text.topicPagesCopy)}</p>
      </div>
      <div class="topic-rail-links">${topicCards}</div>
    </section>
  </main>`;

  return renderShell({
    site,
    title: `${text.startHere} | ${site.title}`,
    description: text.startHeroCopy,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `${text.startHere} | ${site.title}`,
        url: canonicalUrl,
        description: text.startHeroCopy,
        publisher: organizationSchema(site),
        author: personSchema(site)
      }
    ]
  });
}

function renderSearchQuestionLinks({ guides = SEARCH_GUIDES, issues = [], topics = [], pathDepth = 0, locale = "en" }) {
  const text = ui(locale);
  const issueMap = topicBySlug(issues);
  const topicMap = topicBySlug(topics);
  return guides
    .flatMap((guide) =>
      (guide.commonQuestions ?? []).map((question) => ({
        ...question,
        guide
      }))
    )
    .filter((question) => issueMap.has(question.answerSlug))
    .map((question) => {
      const issue = issueMap.get(question.answerSlug);
      const snippet = bestSnippetForIssue(issue, question.query, guides);
      const topic = question.guide.topicSlug ? topicMap.get(question.guide.topicSlug) : null;
      const sourcesHref = topic
        ? relativePageUrl(`${topicUrl(topic.slug)}#sources`, pathDepth, locale)
        : sourceUrl(issue);
      const sourcesLabel = topic ? text.viewTrustedSources : text.viewOriginalSource;
      return `<article class="question-card" data-search-question data-path="${attr(question.guide.id)}" data-query="${attr(question.query)}">
        <p class="kicker">${escapeHtml(question.guide.label)}</p>
        <h3>${escapeHtml(question.question)}</h3>
        <p>${escapeHtml(textSummary(snippet.text, 300))}</p>
        <div class="question-actions">
          <a class="button-link" href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">${escapeHtml(text.readFullAnswer)}</a>
          <a class="text-link" href="${attr(sourcesHref)}">${escapeHtml(sourcesLabel)}</a>
        </div>
      </article>`;
    })
    .join("");
}

function renderSearchResultCard({ issue, pathDepth = 0, locale = "en", guides = SEARCH_GUIDES }) {
  const text = ui(locale);
  const guideText = searchCategoriesForIssue(issue, guides).join(",");
  const snippet = bestSnippetForIssue(issue, issue.title, guides);
  const issueHref = relativeIssueUrl(issue, pathDepth, locale);
  return `<article class="search-result-card" data-search-result data-slug="${attr(issue.slug)}" data-title="${attr(normalizeSearchValue(issue.title))}" data-categories="${attr(guideText)}">
    <a class="search-result-media" href="${attr(issueHref)}" aria-label="${attr(`${text.readFullArticle}: ${issue.title}`)}">
      <img src="${attr(relativeInternalUrl(issue.coverImage, pathDepth))}" alt="${attr(issue.title)}" loading="lazy" decoding="async"${issueCoverDimensions(issue)}>
    </a>
    <div class="search-result-copy">
      <span class="search-result-meta">${escapeHtml(text.issue)} ${escapeHtml(issue.issueNumber ?? "")} · <time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time></span>
      <h3><a href="${attr(issueHref)}">${escapeHtml(issue.title)}</a></h3>
      <span class="search-result-topics">${escapeHtml((issue.topics ?? []).join(", "))}</span>
      <p class="search-result-snippet"><b>${escapeHtml(text.bestMatchingSection)}: <span data-search-snippet-heading>${escapeHtml(snippet.heading)}</span></b> <span data-search-snippet-text>${escapeHtml(snippet.text)}</span></p>
      <div class="search-result-actions">
        <a class="button-link" href="${attr(issueHref)}">${escapeHtml(text.readFullArticle)}</a>
        <a class="text-link" href="${attr(sourceUrl(issue))}">${escapeHtml(text.viewOriginalSource)}</a>
      </div>
    </div>
  </article>`;
}

export function renderSearchPage({ site, issues, topics = [], locale = "en", searchGuides = SEARCH_GUIDES }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(1, locale);
  const pathname = "/search/";
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const guideOptions = searchGuides
    .map(
      (guide) => `<a class="search-path-chip" href="${attr(relativePageUrl(`/search/?path=${encodeURIComponent(guide.id)}`, pathDepth, locale))}" data-search-preset="${attr(guide.id)}" data-guide-label="${attr(guide.label)}" data-guide-description="${attr(guide.description)}" data-guide-query="${attr(guide.defaultQuery)}">
        <span>${escapeHtml(guide.label)}</span>
      </a>`
    )
    .join("");
  const resultCards = issues.map((issue) => renderSearchResultCard({ issue, pathDepth, locale, guides: searchGuides })).join("");
  const searchIndex = jsonLd(buildSearchIndex(issues, searchGuides));
  const questionLinks = renderSearchQuestionLinks({ guides: searchGuides, issues, topics, pathDepth, locale });
  const body = `<main class="search-page" data-search-page>
    <header class="search-hero">
      <p class="kicker">${escapeHtml(text.findAnswer)}</p>
      <h1 data-selected-topic-title data-context-template="${attr(text.selectedSearchTitle("{label}"))}">${escapeHtml(text.searchHeroTitle)}</h1>
      <p data-selected-topic-copy>${escapeHtml(text.searchHeroCopy)}</p>
      <div class="search-box">
        <label for="site-search">${escapeHtml(text.whatNeedHelp)}</label>
        <input id="site-search" data-search-page-input type="search" placeholder="${attr(text.searchPlaceholder)}" autocomplete="off" data-preset-template="${attr(text.searchPresetPlaceholder("{label}"))}">
      </div>
      <div class="search-paths" aria-label="${attr(text.commonSearchPaths)}">${guideOptions}</div>
    </header>
    <section class="search-questions" aria-labelledby="search-questions-heading">
      <div class="section-heading">
        <p class="kicker">${escapeHtml(text.mostAskedQuestions)}</p>
        <h2 id="search-questions-heading" data-selected-questions-title data-context-template="${attr(text.selectedQuestionsTitle("{label}"))}">${escapeHtml(text.searchQuestionsHeading)}</h2>
      </div>
      <div class="question-link-grid">${questionLinks}</div>
    </section>
    <section class="search-results-section" aria-labelledby="search-results-heading">
      <div class="search-results-heading">
        <div>
          <p class="kicker">${escapeHtml(text.articles)}</p>
          <h2 id="search-results-heading" data-selected-results-title data-context-template="${attr(text.selectedResultsTitle("{label}"))}">${escapeHtml(text.bestMatches)}</h2>
        </div>
        <p data-search-results-count data-count-locale="${attr(locale)}" data-count-one="${attr(text.articlesCount(1).replace("1", "{count}"))}" data-count-few="${attr(text.articlesCount(2).replace("2", "{count}"))}" data-count-many="${attr(text.articlesCount(5).replace("5", "{count}"))}" data-count-other="${attr(text.articlesCount(2).replace("2", "{count}"))}">${escapeHtml(text.articlesCount(issues.length))}</p>
      </div>
      <p class="archive-empty" data-search-empty hidden>${escapeHtml(text.searchEmpty)}</p>
      <div class="search-results-list">${resultCards}</div>
    </section>
    <script type="application/json" data-search-index>${searchIndex}</script>
  </main>`;

  return renderShell({
    site,
    title: `${text.search} | ${site.title}`,
    description: text.searchHeroCopy,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        name: `${text.search} ${site.title}`,
        url: canonicalUrl,
        description: text.searchHeroCopy,
        publisher: organizationSchema(site),
        author: personSchema(site)
      }
    ],
    script: `<script src="${attr(versionedInternalUrl("/client/search-page.js", pathDepth, site.assetsVersion))}" defer></script>`
  });
}

const GLOSSARY_TERMS = [
  {
    term: "Dementia",
    definition:
      "A general term for brain changes that interfere with memory, thinking, communication, behavior, or daily function. Dementia has many possible causes, including Alzheimer’s disease."
  },
  {
    term: "Alzheimer’s disease",
    definition:
      "A common cause of dementia. It usually affects memory first, then thinking, language, behavior, and daily independence over time."
  },
  {
    term: "Delirium",
    definition:
      "A sudden change in attention, alertness, or confusion that can be caused by infection, dehydration, pain, medication changes, hospitalization, or other medical problems."
  },
  {
    term: "Sundowning",
    definition:
      "A pattern where confusion, restlessness, anxiety, or agitation gets worse later in the day or evening."
  },
  {
    term: "Hallucination",
    definition:
      "Seeing, hearing, or sensing something that other people do not perceive."
  },
  {
    term: "Delusion",
    definition:
      "A fixed belief that is not based in reality, such as believing someone stole an item that was misplaced."
  },
  {
    term: "Anosognosia",
    definition:
      "A lack of awareness of one’s own illness or limitations. In dementia, this can make a person believe they do not need help."
  },
  {
    term: "Wandering",
    definition:
      "Walking or leaving a safe area without a clear plan or ability to return safely. It can create safety risks for families and care teams."
  },
  {
    term: "Dysphagia",
    definition:
      "Difficulty swallowing. In dementia care, it can raise concerns about choking, food pocketing, aspiration, and nutrition."
  },
  {
    term: "Respite care",
    definition:
      "Temporary support that gives family caregivers time to rest, attend appointments, work, or recover."
  },
  {
    term: "Care navigator",
    definition:
      "A person who helps families coordinate care, understand next steps, and connect with medical, social, and community resources."
  },
  {
    term: "GUIDE Model",
    definition:
      "A Medicare dementia-care model designed to support eligible people living with dementia and their caregivers through care coordination, education, and support."
  }
];

const GLOSSARY_TERMS_BY_LOCALE = {
  en: GLOSSARY_TERMS,
  es: [
    {
      term: "Demencia",
      definition:
        "Término general para cambios en el cerebro que interfieren con la memoria, el pensamiento, la comunicación, la conducta o las actividades diarias. La demencia puede tener muchas causas, incluida la enfermedad de Alzheimer."
    },
    {
      term: "Enfermedad de Alzheimer",
      definition:
        "Una causa común de demencia. Por lo general afecta primero la memoria y luego el pensamiento, el lenguaje, la conducta y la independencia diaria con el tiempo."
    },
    {
      term: "Delirio agudo",
      definition:
        "Un cambio repentino en la atención, el estado de alerta o la confusión que puede deberse a infección, deshidratación, dolor, cambios de medicamentos, hospitalización u otros problemas médicos."
    },
    {
      term: "Sundowning",
      definition:
        "Patrón en el que la confusión, inquietud, ansiedad o agitación empeora al final del día o por la noche."
    },
    {
      term: "Alucinación",
      definition: "Ver, oír o sentir algo que otras personas no perciben."
    },
    {
      term: "Delirio",
      definition: "Creencia fija que no se basa en la realidad, como creer que alguien robó un objeto que se extravió."
    },
    {
      term: "Anosognosia",
      definition:
        "Falta de conciencia de la propia enfermedad o limitaciones. En la demencia, puede hacer que una persona crea que no necesita ayuda."
    },
    {
      term: "Deambulación",
      definition:
        "Caminar o salir de un lugar seguro sin un plan claro o sin poder regresar con seguridad. Puede crear riesgos para familias y equipos de cuidado."
    },
    {
      term: "Disfagia",
      definition:
        "Dificultad para tragar. En el cuidado de la demencia puede generar preocupación por atragantamiento, comida guardada en la boca, aspiración y nutrición."
    },
    {
      term: "Cuidado de respiro",
      definition: "Apoyo temporal que da a los cuidadores familiares tiempo para descansar, ir a citas, trabajar o recuperarse."
    },
    {
      term: "Navegador de cuidado",
      definition:
        "Persona que ayuda a las familias a coordinar la atención, entender próximos pasos y conectarse con recursos médicos, sociales y comunitarios."
    },
    {
      term: "Modelo GUIDE",
      definition:
        "Modelo de cuidado de demencia de Medicare diseñado para apoyar a personas elegibles que viven con demencia y a sus cuidadores mediante coordinación, educación y apoyo."
    }
  ],
  ru: [
    {
      term: "Деменция",
      definition:
        "Общий термин для изменений мозга, которые мешают памяти, мышлению, общению, поведению или повседневным функциям. У деменции много возможных причин, включая болезнь Альцгеймера."
    },
    {
      term: "Болезнь Альцгеймера",
      definition:
        "Распространенная причина деменции. Обычно сначала страдает память, затем мышление, речь, поведение и ежедневная самостоятельность."
    },
    {
      term: "Делирий",
      definition:
        "Внезапное изменение внимания, бодрствования или спутанности, которое может быть вызвано инфекцией, обезвоживанием, болью, изменением лекарств, госпитализацией или другими медицинскими проблемами."
    },
    {
      term: "Синдром заката",
      definition: "Паттерн, при котором спутанность, беспокойство, тревога или возбуждение усиливаются ближе к вечеру или ночью."
    },
    {
      term: "Галлюцинация",
      definition: "Когда человек видит, слышит или ощущает то, чего другие люди не воспринимают."
    },
    {
      term: "Бред",
      definition: "Устойчивая вера, не основанная на реальности, например убеждение, что кто-то украл вещь, которая была потеряна."
    },
    {
      term: "Анозогнозия",
      definition:
        "Отсутствие осознания собственной болезни или ограничений. При деменции это может заставлять человека думать, что ему не нужна помощь."
    },
    {
      term: "Блуждание",
      definition:
        "Ходьба или уход из безопасного места без ясного плана или способности безопасно вернуться. Это может создавать риски для семьи и команды ухода."
    },
    {
      term: "Дисфагия",
      definition:
        "Трудность глотания. В уходе при деменции это связано с риском удушья, накопления пищи во рту, аспирации и проблем питания."
    },
    {
      term: "Передышка для опекуна",
      definition: "Временная поддержка, которая дает семейным опекунам время отдохнуть, сходить на прием, работать или восстановиться."
    },
    {
      term: "Навигатор ухода",
      definition:
        "Человек, который помогает семьям координировать уход, понимать следующие шаги и подключаться к медицинским, социальным и общественным ресурсам."
    },
    {
      term: "Модель GUIDE",
      definition:
        "Модель ухода при деменции в Medicare, созданная для поддержки подходящих людей с деменцией и их опекунов через координацию ухода, обучение и поддержку."
    }
  ]
};

export function renderGlossaryPage({ site, locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(1, locale);
  const pathname = "/glossary/";
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const glossaryTerms = GLOSSARY_TERMS_BY_LOCALE[locale] || GLOSSARY_TERMS;
  const terms = glossaryTerms.map(
    (item, index) => `<article id="${attr(slugSegment(item.term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `term-${index + 1}`))}">
        <h2>${escapeHtml(item.term)}</h2>
        <p>${escapeHtml(item.definition)}</p>
      </article>`
  ).join("");
  const body = `<main class="glossary-page">
    <header class="topic-hero">
      <p class="kicker">${escapeHtml(text.plainGlossary)}</p>
      <h1>${escapeHtml(text.glossaryTitle)}</h1>
      <p>${escapeHtml(text.glossaryCopy)}</p>
    </header>
    <section class="glossary-list" aria-label="${attr(text.glossary)}">
      ${terms}
    </section>
  </main>`;

  return renderShell({
    site,
    title: `${text.glossary} | ${site.title}`,
    description: text.glossaryCopy,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        name: `${site.title} ${text.glossary}`,
        url: canonicalUrl,
        hasDefinedTerm: glossaryTerms.map((item) => ({
          "@type": "DefinedTerm",
          name: item.term,
          description: item.definition
        })),
        publisher: organizationSchema(site),
        author: personSchema(site)
      }
    ]
  });
}

export function renderAuthorPage({ site, issues, locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(2, locale);
  const pathname = authorUrl();
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const recent = issues
    .slice(0, 8)
    .map(
      (issue) => `<li><a href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">${escapeHtml(issue.title)}</a><time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time></li>`
    )
    .join("");
  const body = `<main class="author-page">
    <header class="author-hero">
      <img src="${attr(relativeInternalUrl(site.author.headshot, pathDepth))}" alt="${attr(site.author.name)}" loading="lazy" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.headshot)}>
      <div>
        <p class="kicker">${escapeHtml(text.author)}</p>
        <h1>${escapeHtml(site.author.name)}</h1>
        <p>${escapeHtml(site.author.role)}</p>
        <p>${escapeHtml(site.description)}</p>
        <a class="button-link" href="${attr(site.author.linkedinUrl)}">${escapeHtml(text.linkedInProfile)}</a>
      </div>
    </header>
    <section class="topic-section"><h2>${escapeHtml(text.recentArticles)}</h2><ul class="topic-issue-list">${recent}</ul></section>
  </main>`;

  return renderShell({
    site,
    title: `${site.author.name} | ${site.title}`,
    description: `${site.author.name}, ${site.author.role}, author of The Dementia Times.`,
    body,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    imageUrl: absoluteUrl(site, site.author.headshot),
    imageAlt: site.author.name,
    structuredData: [{ "@context": "https://schema.org", ...personSchema(site), sameAs: [site.author.linkedinUrl, site.brand.youtubeUrl] }]
  });
}

function renderArchive(issues, pathDepth = 0, locale = "en") {
  return issues
    .map((issue) => {
      const categories = archiveCategoriesForIssue(issue).join(",");
      const searchText = archiveSearchText(issue);
      return `<li class="archive-item" data-archive-item data-title="${attr(searchableText(issue.title))}" data-topics="${attr((issue.topics ?? []).map(topicValue).join(","))}" data-categories="${attr(categories)}" data-search="${attr(searchText)}" data-date="${attr(issue.publishedDate)}">
        <a href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">
          <span>${escapeHtml(issue.title)}</span>
          <span class="archive-topics">${escapeHtml((issue.topics ?? []).join(", "))}</span>
          <time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time>
        </a>
      </li>`;
    })
    .join("");
}

function renderRecentEditions(issues, pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const recentIssues = issues.slice(1, 6);
  if (recentIssues.length === 0) {
    return "";
  }

  const items = recentIssues
    .map(
      (issue) => `<li class="recent-item">
        <a href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">
          <span>${escapeHtml(issue.title)}</span>
          <time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time>
        </a>
      </li>`
    )
    .join("");

  return `<section class="recent-section" aria-labelledby="recent-editions-heading">
        <h2 id="recent-editions-heading">${escapeHtml(text.recentEditions)}</h2>
        <ul class="recent-list">${items}</ul>
      </section>`;
}

function renderFeaturedCarousel(issues, pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const featuredIssues = issues.slice(0, 6);
  if (featuredIssues.length === 0) {
    return "";
  }

  const slides = featuredIssues
    .map((issue, index) => {
      const active = index === 0;
      const loading = active ? "" : ' loading="lazy"';
      const fetchPriority = active ? ' fetchpriority="high"' : "";
      return `<article class="carousel-slide${active ? " is-active" : ""}" data-carousel-slide aria-hidden="${active ? "false" : "true"}"${active ? "" : " hidden"}>
          <a class="carousel-link" href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">
            <img src="${attr(relativeInternalUrl(issue.coverImage, pathDepth))}" alt="${attr(issue.title)}"${loading}${fetchPriority} decoding="async"${issueCoverDimensions(issue)}>
            <span class="carousel-copy">
              <span class="kicker">${escapeHtml(text.topArticle)}</span>
              <strong>${escapeHtml(issue.title)}</strong>
              <span>${escapeHtml(text.issue)} ${escapeHtml(issue.issueNumber ?? "")} · <time datetime="${attr(issue.publishedDate)}">${escapeHtml(issue.publishedDate)}</time></span>
            </span>
          </a>
        </article>`;
    })
    .join("");

  const dots = featuredIssues
    .map(
      (issue, index) =>
        `<button class="carousel-dot" type="button" data-carousel-dot="${index}" aria-label="${attr(text.showFeatured(issue.title))}"${index === 0 ? ' aria-current="true"' : ""}></button>`
    )
    .join("");

  return `<section class="featured-carousel" data-featured-carousel aria-label="${attr(text.topArticles)}">
      <div class="carousel-frame">
        ${slides}
        <div class="carousel-controls" aria-label="${attr(text.carouselControls)}">
          <button class="carousel-button" type="button" data-carousel-prev aria-label="${attr(text.previousFeatured)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"></path></svg>
          </button>
          <button class="carousel-button" type="button" data-carousel-next aria-label="${attr(text.nextFeatured)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>
          </button>
        </div>
      </div>
      <div class="carousel-dots" aria-label="${attr(text.chooseTopArticle)}">${dots}</div>
    </section>`;
}

function renderEditionStrip(site, latestIssue, pathDepth = 0, locale = "en") {
  const text = ui(locale);
  if (!latestIssue) return "";

  return `<section class="edition-strip" aria-label="${attr(text.latestBriefing)}">
      <div>
        <p class="kicker">${escapeHtml(text.latestBriefing)}</p>
        <h2><a href="${attr(relativeIssueUrl(latestIssue, pathDepth, locale))}">${escapeHtml(latestIssue.title)}</a></h2>
        <p>${escapeHtml(text.issue)} ${escapeHtml(latestIssue.issueNumber ?? "")} · <time datetime="${attr(latestIssue.publishedDate)}">${escapeHtml(latestIssue.publishedDate)}</time></p>
      </div>
      <a class="button-link" href="${attr(relativeIssueUrl(latestIssue, pathDepth, locale))}">${escapeHtml(text.readLatest)}</a>
      <a class="text-link" href="${attr(relativePageUrl("/subscribe/", pathDepth, locale))}">${escapeHtml(text.subscribe)}</a>
    </section>`;
}

function renderReaderPathways(pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const pathways = text.startPathways;

  const cards = pathways
    .map(
      (pathway) => `<a class="path-card" href="${attr(relativePageUrl(pathway.href, pathDepth, locale))}">
        <span class="kicker">${escapeHtml(pathway.label)}</span>
        <strong>${escapeHtml(pathway.title)}</strong>
        <span>${escapeHtml(pathway.text)}</span>
        <span class="path-action">${escapeHtml(pathway.action)}</span>
      </a>`
    )
    .join("");

  return `<section class="reader-pathways" aria-label="${attr(text.recommendedStartingPoints)}">
      <div class="section-heading">
        <p class="kicker">${escapeHtml(text.startHere)}</p>
        <h2>${escapeHtml(text.chooseSimplePath)}</h2>
        <p>${escapeHtml(text.chooseSimplePathCopy)}</p>
        <a class="text-link" href="${attr(relativePageUrl("/search/", pathDepth, locale))}">${escapeHtml(text.searchAllCareQuestions)}</a>
      </div>
      <div class="pathway-grid">${cards}</div>
    </section>`;
}

const QUICK_HELP_GROUPS = [
  {
    title: "Dementia is new to us",
    text: "Start with simple explanations before jumping into behavior or medication decisions.",
    issueSlugs: ["what-is-dementia", "normal-aging-vs-dementia", "what-stage-of-dementia-is-my-loved-one-in-and-what-should-i-do-next"]
  },
  {
    title: "They refuse help",
    text: "Use these when someone says they are fine, refuses showers, medications, driving limits, or care.",
    issueSlugs: [
      "why-do-dementia-patients-refuse-help",
      "why-does-my-loved-one-with-dementia-refuse-to-shower-and-what-can-i-actually-do-about-it",
      "why-won-t-my-loved-one-with-dementia-take-their-medication"
    ]
  },
  {
    title: "Accusations or hallucinations",
    text: "Start here for stealing accusations, delusions, hallucinations, paranoia, or confusing beliefs.",
    issueSlugs: ["why-is-my-l-o-accusing-me-of-stealing", "why-is-my-loved-one-with-dementia-accusing-me-of-stealing", "delusions-and-hallucinations"]
  },
  {
    title: "Eating, sleep, or sundowning",
    text: "Find practical articles for meals, swallowing, nighttime wakefulness, and late-day agitation.",
    issueSlugs: [
      "why-does-eating-become-so-hard-in-dementia",
      "why-is-my-loved-one-awake-all-night-the-biological-reason-dementia-destroys-sleep",
      "the-4pm-reset-preventing-the-dementia-sundowning-spiral-before-it-starts"
    ]
  },
  {
    title: "Planning before a crisis",
    text: "Use these when the family needs safer decisions, hospital planning, or advance care conversations.",
    issueSlugs: [
      "what-happens-if-dementia-families-wait-too-long-to-plan",
      "why-does-dementia-care-get-harder-after-a-hospital-stay",
      "why-do-dementia-care-decisions-tear-families-apart"
    ]
  },
  {
    title: "Caregiver support",
    text: "Read these when the caregiver is exhausted, overwhelmed, or unsure what support exists.",
    issueSlugs: [
      "what-support-do-dementia-caregivers-actually-need-at-home",
      "why-does-respite-care-sometimes-fail-for-dementia-caregivers",
      "is-it-normal-to-feel-overwhelmed-caring-for-someone-with-dementia"
    ]
  }
];

function renderQuickHelp(issues = [], pathDepth = 0, locale = "en") {
  const text = ui(locale);
  const issueMap = topicBySlug(issues);
  const cards = text.quickHelpGroups.map((group) => {
    const links = group.issueSlugs
      .map((slug) => issueMap.get(slug))
      .filter(Boolean)
      .map((issue) => `<li><a href="${attr(relativeIssueUrl(issue, pathDepth, locale))}">${escapeHtml(issue.title)}</a></li>`)
      .join("");
    return `<article class="quick-help-card">
        <h3>${escapeHtml(group.title)}</h3>
        <p>${escapeHtml(group.text)}</p>
        <ul>${links}</ul>
      </article>`;
  }).join("");

  return `<section class="quick-help" aria-labelledby="quick-help-heading">
      <div class="section-heading">
        <p class="kicker">${escapeHtml(text.quickHelpKicker)}</p>
        <h2 id="quick-help-heading">${escapeHtml(text.quickHelpHeading)}</h2>
        <p>${escapeHtml(text.quickHelpCopy)}</p>
      </div>
      <div class="quick-help-grid">${cards}</div>
    </section>`;
}

function renderHomeTopics(topics = [], pathDepth = 0, locale = "en") {
  const text = ui(locale);
  if (topics.length === 0) return "";
  const cards = topics
    .slice(0, 4)
    .map(
      (topic) => `<a class="topic-card topic-card--home" href="${attr(relativePageUrl(topicUrl(topic.slug), pathDepth, locale))}">
        <span class="topic-card-label">${escapeHtml(text.topicLabel)}</span>
        <strong>${escapeHtml(topic.title)}</strong>
        <span>${escapeHtml(topic.description)}</span>
        <span class="topic-action">${escapeHtml(text.seeRelatedArticles)}</span>
      </a>`
    )
    .join("");

  return `<section class="home-topics" aria-labelledby="home-topics-heading">
      <div class="section-heading">
        <p class="kicker">${escapeHtml(text.findByTopic)}</p>
        <h2 id="home-topics-heading">${escapeHtml(text.browseBiggerQuestions)}</h2>
        <p>${escapeHtml(text.topicHomeCopy)}</p>
        <a class="text-link" href="${attr(relativePageUrl("/topics/", pathDepth, locale))}">${escapeHtml(text.seeEveryTopic)}</a>
      </div>
      <div class="topic-grid">${cards}</div>
    </section>`;
}

export function renderHomePage({ site, issues, topics = [], locale = "en" }) {
  const text = ui(locale);
  const pathDepth = localePathDepth(0, locale);
  const pathname = "/";
  const [latestIssue] = issues;
  const canonicalUrl = absoluteUrl(site, localizedPagePath(pathname, locale));
  const imageUrl = latestIssue ? absoluteUrl(site, latestIssue.coverImage) : absoluteUrl(site, site.brand.logo);
  const archiveCount = text.archiveCount(issues.length);
  const homeSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    url: canonicalUrl,
    description: site.description,
    publisher: organizationSchema(site),
    author: personSchema(site)
  };
  const topicOptions = ARCHIVE_FILTER_CATEGORIES
    .map((category) => `<option value="${attr(category.value)}">${escapeHtml(text.categoryLabels[category.value] || category.label)}</option>`)
    .join("");
  const latest = latestIssue
    ? `<section class="latest-card">
        <a class="latest-cover" href="${attr(relativeIssueUrl(latestIssue, pathDepth, locale))}" aria-label="${attr(`${text.readIssue}: ${latestIssue.title}`)}">
          <img src="${attr(relativeInternalUrl(latestIssue.coverImage, pathDepth))}" alt="${attr(latestIssue.title)}" loading="eager" decoding="async" fetchpriority="high"${issueCoverDimensions(latestIssue)}>
        </a>
        <div class="latest-copy">
          <div class="latest-meta">
            <p class="kicker">${escapeHtml(text.latestEdition)}</p>
            <span>${escapeHtml(text.issue)} ${escapeHtml(latestIssue.issueNumber ?? "")} · <time datetime="${attr(latestIssue.publishedDate)}">${escapeHtml(latestIssue.publishedDate)}</time></span>
          </div>
          <h2><a href="${attr(relativeIssueUrl(latestIssue, pathDepth, locale))}">${escapeHtml(latestIssue.title)}</a></h2>
          <p>${escapeHtml(latestIssue.excerpt)}</p>
          <div class="latest-actions">
            <a class="button-link" href="${attr(relativeIssueUrl(latestIssue, pathDepth, locale))}">${escapeHtml(text.readIssue)}</a>
            <a class="text-link" href="${attr(sourceUrl(latestIssue))}">${escapeHtml(text.linkedInOriginal)}</a>
          </div>
        </div>
      </section>`
    : "";
  const recentEditions = renderRecentEditions(issues, pathDepth, locale);

  const body = `<main>
    <section class="masthead">
      <p class="presented-by">${escapeHtml(site.presentedBy)}</p>
      <h1>${escapeHtml(site.title)}</h1>
      <p class="dek">${escapeHtml(site.description)}</p>
      <div class="masthead-ledger">
        <a class="masthead-author" href="${attr(site.author.linkedinUrl)}">
          <img src="${attr(relativeInternalUrl(site.author.headshot, pathDepth))}" alt="${attr(site.author.name)}" loading="lazy" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.headshot)}>
          <span>
            <strong>${escapeHtml(site.author.name)}</strong>
            <small>${escapeHtml(site.author.role)}</small>
          </span>
        </a>
        <ul class="edition-stats" aria-label="${attr(text.archiveSummaryLabel)}">
          <li><strong>${escapeHtml(issues.length)}</strong><span>${escapeHtml(text.editions)}</span></li>
          <li><strong>${escapeHtml(text.statDaily)}</strong><span>${escapeHtml(text.linkedInNewsletter)}</span></li>
          <li><strong>${escapeHtml(text.statLocal)}</strong><span>${escapeHtml(text.slideArchive)}</span></li>
        </ul>
      </div>
    </section>
    ${renderEditionStrip(site, latestIssue, pathDepth, locale)}
    ${renderFeaturedCarousel(issues, pathDepth, locale)}
    <div class="home-grid">
      ${latest}
      ${recentEditions}
      ${renderGuideCta(site, pathDepth, { compact: true })}
      <section class="youtube-banner">
        <a href="${attr(site.brand.youtubeUrl)}">
          <img src="${attr(relativeInternalUrl(site.brand.youtubeBanner, pathDepth))}" alt="Straight Talk with Dr. Erik" loading="lazy" decoding="async"${imageDimensionAttrs(BRAND_IMAGE_DIMENSIONS.youtubeBanner)}>
        </a>
      </section>
      ${renderReaderPathways(pathDepth, locale)}
      ${renderQuickHelp(issues, pathDepth, locale)}
      ${renderHomeTopics(topics, pathDepth, locale)}
      <section class="archive-section" id="archive">
        <div class="archive-heading">
          <h2>${escapeHtml(text.archive)}</h2>
          <span>${escapeHtml(`${issues.length} ${issues.length === 1 ? text.edition : text.editions}`)}</span>
        </div>
        <section class="archive-tools" aria-label="${attr(text.archiveFilters)}">
          <div class="archive-field archive-field--search">
            <label for="archive-search">${escapeHtml(text.searchEditions)}</label>
            <input id="archive-search" data-archive-search type="search" placeholder="${attr(text.archivePlaceholder)}" aria-describedby="archive-count">
          </div>
          <div class="archive-field archive-field--topic">
            <label for="archive-topic">${escapeHtml(text.pickCareProblem)}</label>
            <select id="archive-topic" data-topic-filter aria-describedby="archive-count">
              <option value="">${escapeHtml(text.allCareProblems)}</option>
              ${topicOptions}
            </select>
          </div>
        </section>
        <p id="archive-count" class="archive-count" data-archive-count data-count-template="${attr(text.archiveCount(999).replace("999", "{count}"))}" data-hidden-template="${attr(text.archiveCountHidden(999, 888).replace("999", "{visible}").replace("888", "{hidden}"))}">${escapeHtml(archiveCount)}</p>
        <p class="archive-empty" data-archive-empty hidden>${escapeHtml(text.archiveEmpty)}</p>
        <ul class="archive-list">${renderArchive(issues, pathDepth, locale)}</ul>
      </section>
    </div>
  </main>
  ${renderSignupModal(site, locale)}`;

  return renderShell({
    site,
    title: site.title,
    description: site.description,
    body,
    script: `<script src="${attr(versionedInternalUrl("/client/archive-filter.js", pathDepth, site.assetsVersion))}" defer></script>`,
    pathDepth,
    locale,
    pathname,
    canonicalUrl,
    imageUrl,
    imageAlt: latestIssue?.title || site.title,
    type: "website",
    structuredData: [homeSchema],
    preloads: latestIssue ? [{ href: relativeInternalUrl(latestIssue.coverImage, pathDepth), as: "image" }] : []
  });
}
