const searchPage = document.querySelector("[data-search-page]");
const searchInput = document.querySelector("[data-search-page-input]");
const resultCount = document.querySelector("[data-search-results-count]");
const emptyState = document.querySelector("[data-search-empty]");
const resultCards = Array.from(document.querySelectorAll("[data-search-result]"));
const presetLinks = Array.from(document.querySelectorAll("[data-search-preset]"));
const questionLinks = Array.from(document.querySelectorAll("[data-search-question]"));
const languageLinks = Array.from(document.querySelectorAll("[data-language-link]"));
const selectedTopicTitle = document.querySelector("[data-selected-topic-title]");
const selectedTopicCopy = document.querySelector("[data-selected-topic-copy]");
const selectedQuestionsTitle = document.querySelector("[data-selected-questions-title]");
const selectedResultsTitle = document.querySelector("[data-selected-results-title]");
const searchIndexScript = document.querySelector("[data-search-index]");

const defaultContext = {
  topicTitle: selectedTopicTitle?.textContent || "",
  topicCopy: selectedTopicCopy?.textContent || "",
  questionsTitle: selectedQuestionsTitle?.textContent || "",
  resultsTitle: selectedResultsTitle?.textContent || ""
};

function readSearchIndex() {
  if (!searchIndexScript?.textContent) return new Map();
  try {
    const entries = JSON.parse(searchIndexScript.textContent);
    return new Map(entries.map((entry) => [entry.slug, entry]));
  } catch {
    return new Map();
  }
}

const searchIndex = readSearchIndex();
const searchIndexHaystacks = new Map(
  [...searchIndex.entries()].map(([slug, entry]) => [
    slug,
    normalizeSearchValue(
      [
        entry.title,
        entry.excerpt,
        ...(entry.topics || []),
        ...(entry.categories || []),
        ...(entry.snippets || []).flatMap((snippet) => [snippet.heading, snippet.text])
      ].join(" ")
    )
  ])
);

const stopWords = new Set([
  "a",
  "and",
  "are",
  "care",
  "dementia",
  "do",
  "does",
  "for",
  "get",
  "help",
  "how",
  "i",
  "is",
  "it",
  "loved",
  "me",
  "mom",
  "mother",
  "my",
  "of",
  "one",
  "the",
  "to",
  "what",
  "why",
  "with",
  "you",
  "como",
  "con",
  "cual",
  "cuales",
  "de",
  "el",
  "en",
  "es",
  "esta",
  "estoy",
  "hace",
  "hago",
  "la",
  "las",
  "lo",
  "los",
  "mama",
  "mi",
  "necesito",
  "para",
  "por",
  "puedo",
  "que",
  "se",
  "su",
  "un",
  "una",
  "y",
  "как",
  "мама",
  "маму",
  "мне",
  "мой",
  "моей",
  "нужно",
  "помочь",
  "принять",
  "с",
  "что",
  "это",
  "я"
]);

const synonyms = {
  "baño": ["baño", "bano", "bañar", "bañarse", "ducha", "ducharse", "shower", "bath", "bathe", "bathing", "душ", "купание"],
  bathing: ["bath", "bathe", "bathing", "shower", "wash", "ducha", "ducharse", "baño", "bañar", "bañarse", "душ", "купание"],
  behavior: ["behavior", "behaviour", "agitation", "aggressive", "refusal", "conducta", "поведение"],
  behaviour: ["behavior", "behaviour", "agitation", "aggressive", "refusal", "conducta", "поведение"],
  ducha: ["ducha", "ducharse", "baño", "bano", "bañar", "bañarse", "shower", "bath", "bathe", "bathing", "душ", "купание"],
  duche: ["ducha", "ducharse", "baño", "bano", "bañar", "bañarse", "shower", "bath", "bathe", "bathing", "душ", "купание"],
  medication: ["medication", "medicine", "meds", "pills", "medicación", "лекарства"],
  refuse: ["refuse", "refuses", "refusal", "resist", "rechaza", "отказывается"],
  refuses: ["refuse", "refuses", "refusal", "resist", "rechaza", "отказывается"],
  shower: ["bath", "bathe", "bathing", "shower", "wash", "ducha", "ducharse", "baño", "bañar", "bañarse", "душ", "купание"],
  sleep: ["sleep", "night", "nighttime", "awake", "sueño", "сон", "ночь"],
  stealing: ["stealing", "stole", "accuse", "accusing", "paranoia", "robo", "украл"],
  "душ": ["душ", "купание", "shower", "bath", "bathe", "bathing", "ducha", "ducharse", "baño", "bañarse"],
  "поведение": ["поведение", "behavior", "behaviour", "conducta"],
  "сон": ["сон", "ночь", "sleep", "night", "sueño"]
};

const highIntentTokens = new Set(["bath", "bathe", "bathing", "bano", "baño", "banarse", "ducha", "ducharse", "duche", "shower", "душ", "купание"]);

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalizeSearchValue(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function escapedRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

function resultCountText(element, count) {
  const dataset = element?.dataset || {};
  const locale = dataset.countLocale || "en";
  const plural = typeof Intl?.PluralRules === "function" ? new Intl.PluralRules(locale).select(count) : count === 1 ? "one" : "other";
  const template =
    dataset[`count${plural.charAt(0).toUpperCase()}${plural.slice(1)}`] ||
    dataset.countOther ||
    dataset.countTemplate;
  return template ? fillTemplate(template, { count }) : `${count} ${count === 1 ? "article" : "articles"}`;
}

function phraseCount(phrase, haystack) {
  const normalized = normalizeSearchValue(phrase);
  if (!normalized) return 0;
  const matches = ` ${haystack} `.match(new RegExp(` ${escapedRegExp(normalized)}(?= )`, "g"));
  return matches?.length ?? 0;
}

function tokenScore(token, { haystack, title, categories }) {
  const candidates = synonyms[token] || [token];
  let score = 0;

  for (const candidate of candidates) {
    const normalized = normalizeSearchValue(candidate);
    if (!normalized) continue;
    const count = phraseCount(normalized, haystack);
    if (count === 0) continue;

    score = Math.max(score, Math.min(count, 6));
    if (phraseCount(normalized, title) > 0) score += 8;
    if (categories.includes(normalized)) score += 5;
  }

  return score;
}

function highIntentTitleMatch(queryTokens, title) {
  const highIntent = queryTokens.filter((token) => highIntentTokens.has(token));
  if (highIntent.length === 0) return true;
  return highIntent.every((token) => {
    const candidates = synonyms[token] || [token];
    return candidates.some((candidate) => {
      const normalized = normalizeSearchValue(candidate);
      return phraseCount(normalized, title) > 0 || (normalized.length >= 4 && title.includes(normalized));
    });
  });
}

function selectedPreset(path) {
  return presetLinks.find((link) => normalizeSearchValue(link.dataset.searchPreset || "") === path);
}

function updateContext(path) {
  const preset = selectedPreset(path);
  if (!preset) {
    if (selectedTopicTitle) selectedTopicTitle.textContent = defaultContext.topicTitle;
    if (selectedTopicCopy) selectedTopicCopy.textContent = defaultContext.topicCopy;
    if (selectedQuestionsTitle) selectedQuestionsTitle.textContent = defaultContext.questionsTitle;
    if (selectedResultsTitle) selectedResultsTitle.textContent = defaultContext.resultsTitle;
    return;
  }

  const label = preset.dataset.guideLabel || preset.textContent.trim();
  if (selectedTopicTitle) {
    selectedTopicTitle.textContent = fillTemplate(selectedTopicTitle.dataset.contextTemplate || "{label}", { label });
  }
  if (selectedTopicCopy) selectedTopicCopy.textContent = preset.dataset.guideDescription || defaultContext.topicCopy;
  if (selectedQuestionsTitle) {
    selectedQuestionsTitle.textContent = fillTemplate(selectedQuestionsTitle.dataset.contextTemplate || "{label}", { label });
  }
  if (selectedResultsTitle) {
    selectedResultsTitle.textContent = fillTemplate(selectedResultsTitle.dataset.contextTemplate || "{label}", { label });
  }
}

function updateQuestionVisibility(path, query) {
  const queryTokens = tokens(query);
  for (const question of questionLinks) {
    const questionPath = normalizeSearchValue(question.dataset.path || "");
    const haystack = normalizeSearchValue(question.dataset.query || "");
    const scores = queryTokens.map((token) =>
      tokenScore(token, { haystack, title: haystack, categories: questionPath ? [questionPath] : [] })
    );
    const pathMatches = !path || questionPath === path;
    const highIntent = queryTokens.filter((token) => highIntentTokens.has(token));
    const queryMatches =
      queryTokens.length === 0 ||
      (highIntent.length > 0
        ? highIntent.every((token) => tokenScore(token, { haystack, title: haystack, categories: questionPath ? [questionPath] : [] }) > 0)
        : scores.some((score) => score > 0));
    const visible = pathMatches && queryMatches;
    question.hidden = !visible;
    if (question.style) question.style.order = String(visible ? -scores.reduce((sum, score) => sum + score, 0) : 0);
  }
}

function bestIndexedSnippet(entry, value) {
  const snippets = entry?.snippets || [];
  if (snippets.length === 0) return null;
  const queryTokens = tokens(value);
  if (queryTokens.length === 0) return snippets[0];

  return snippets.reduce(
    (best, snippet, index) => {
      const haystack = normalizeSearchValue(`${snippet.heading || ""} ${snippet.text || ""} ${snippet.searchText || ""}`);
      const score = queryTokens.reduce(
        (total, token) => total + tokenScore(token, { haystack, title: normalizeSearchValue(snippet.heading || ""), categories: [] }),
        0
      );
      return score > best.score ? { snippet, score, index } : best;
    },
    { snippet: snippets[0], score: -1, index: 0 }
  ).snippet;
}

function updateResultSnippet(card, value) {
  const entry = searchIndex.get(card.dataset.slug || "");
  const snippet = bestIndexedSnippet(entry, value);
  if (!snippet || typeof card.querySelector !== "function") return;
  const heading = card.querySelector("[data-search-snippet-heading]");
  const copy = card.querySelector("[data-search-snippet-text]");
  if (heading) heading.textContent = snippet.heading || entry.title;
  if (copy) copy.textContent = snippet.text || entry.excerpt;
}

function applySearch() {
  if (!searchPage) return;
  const params = new URLSearchParams(window.location.search);
  const path = normalizeSearchValue(params.get("path") || "");
  const query = searchInput?.value || params.get("q") || "";
  const preset = selectedPreset(path);
  const queryTokens = tokens(query);
  const highIntent = queryTokens.filter((token) => highIntentTokens.has(token));
  let visibleCount = 0;
  const scoredCards = [];

  for (const [index, card] of resultCards.entries()) {
    const title = normalizeSearchValue(card.dataset.title || "");
    const categories = (card.dataset.categories || "")
      .split(",")
      .map((value) => normalizeSearchValue(value))
      .filter(Boolean);
    const indexedHaystack = searchIndexHaystacks.get(card.dataset.slug || "");
    const haystack = normalizeSearchValue([card.dataset.title, card.dataset.search, indexedHaystack, categories.join(" ")].join(" "));
    const pathMatches = !path || categories.includes(path);
    const scores = queryTokens.map((token) => tokenScore(token, { haystack, title, categories }));
    const totalScore = scores.reduce((sum, score) => sum + score, 0);
    const matchingTokenCount = scores.filter((score) => score > 0).length;
    const textMatches =
      queryTokens.length === 0 ||
      (highIntent.length > 0
        ? highIntent.every((token) => tokenScore(token, { haystack, title, categories }) > 0) && highIntentTitleMatch(queryTokens, title)
        : matchingTokenCount >= Math.max(1, Math.ceil(queryTokens.length * 0.4)));
    const visible = pathMatches && textMatches;
    card.hidden = !visible;
    updateResultSnippet(card, query || preset?.dataset.guideQuery || "");
    if (card.style) card.style.order = String(visible ? -totalScore : 0);
    scoredCards.push({ card, index, score: totalScore });
    if (visible) visibleCount += 1;
  }

  const resultsList = resultCards[0]?.parentElement;
  if (resultsList && queryTokens.length > 0) {
    scoredCards
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .forEach(({ card }) => resultsList.appendChild(card));
  }

  if (emptyState) emptyState.hidden = visibleCount > 0;
  if (resultCount) {
    resultCount.textContent = resultCountText(resultCount, visibleCount);
  }

  for (const link of presetLinks) {
    link.toggleAttribute("aria-current", normalizeSearchValue(link.dataset.searchPreset || "") === path);
  }
  updateQuestionVisibility(path, query);
  updateContext(path);
}

function initializeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get("q");
  const path = params.get("path");
  if (query && searchInput) searchInput.value = query;
  if (path && !query && searchInput) {
    const preset = presetLinks.find((link) => link.dataset.searchPreset === path);
    if (preset) {
      const label = preset.textContent.trim().toLowerCase();
      searchInput.placeholder = searchInput.dataset?.presetTemplate
        ? fillTemplate(searchInput.dataset.presetTemplate, { label })
        : `Search ${label}...`;
    }
  }
}

function updateUrlForQuery() {
  const params = new URLSearchParams(window.location.search);
  const value = searchInput?.value.trim() || "";
  if (value) {
    params.set("q", value);
  } else {
    params.delete("q");
  }
  const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
  window.history?.replaceState?.({}, "", next);
}

function preserveSearchOnLanguageLinks() {
  const search = window.location?.search || "";
  if (!search) return;
  for (const link of languageLinks) {
    const href = link.getAttribute?.("href");
    if (!href) continue;
    const target = new URL(href, window.location.href);
    target.search = search;
    link.setAttribute?.("href", `${target.pathname}${target.search}`);
  }
}

function initializeSearchPage() {
  if (!searchPage) return;
  preserveSearchOnLanguageLinks();
  initializeFromUrl();
  searchInput?.addEventListener("input", () => {
    updateUrlForQuery();
    applySearch();
  });
  for (const link of questionLinks) {
    link.addEventListener("mouseenter", () => {
      if (searchInput && !searchInput.value) searchInput.placeholder = link.dataset.query || searchInput.placeholder;
    });
  }
  applySearch();
}

initializeSearchPage();
