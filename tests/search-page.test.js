import test from "node:test";
import assert from "node:assert/strict";

function searchInputControl(value = "") {
  const listeners = {};
  return {
    value,
    placeholder: "",
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type) {
      listeners[type]?.({ type });
    }
  };
}

function resultCard({ slug = "", title, search, categories = "" }) {
  const snippetHeading = { textContent: "" };
  const snippetText = { textContent: "" };
  return {
    dataset: { slug, title, search, categories },
    hidden: false,
    style: {},
    querySelector(selector) {
      if (selector === "[data-search-snippet-heading]") return snippetHeading;
      if (selector === "[data-search-snippet-text]") return snippetText;
      return null;
    },
    snippetHeading,
    snippetText
  };
}

function presetLink({ id, label, description = "", defaultQuery = "" }) {
  const attributes = new Set();
  return {
    textContent: label,
    dataset: { searchPreset: id, guideLabel: label, guideDescription: description, guideQuery: defaultQuery },
    toggleAttribute(name, force) {
      if (force) attributes.add(name);
      else attributes.delete(name);
    },
    hasAttribute(name) {
      return attributes.has(name);
    }
  };
}

function questionCard(path, query = `${path} question`) {
  return {
    dataset: { path, query },
    hidden: false,
    style: {},
    addEventListener() {}
  };
}

function languageLink(href) {
  const attributes = { href };
  return {
    getAttribute(name) {
      return attributes[name] || null;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    href() {
      return attributes.href;
    }
  };
}

function setupSearchPage({ windowSearch = "", cards = [], presets = [], questions = [], searchIndex = [], countDataset = {}, languageLinks = [] } = {}) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const input = searchInputControl();
  const count = { textContent: "", dataset: countDataset };
  const empty = { hidden: true };
  const selectedTitle = { textContent: "", dataset: { contextTemplate: "{label}: direct answers and newsletters" } };
  const selectedCopy = { textContent: "" };
  const selectedQuestionsTitle = { textContent: "", dataset: { contextTemplate: "Common questions about {label}" } };
  const selectedResultsTitle = { textContent: "", dataset: { contextTemplate: "Newsletters about {label}" } };
  const resultsList = {
    children: [...cards],
    appendChild(card) {
      this.children = this.children.filter((child) => child !== card);
      this.children.push(card);
      card.parentElement = this;
    }
  };
  for (const card of cards) {
    card.parentElement = resultsList;
  }

  globalThis.document = {
    querySelector(selector) {
      if (selector === "[data-search-page]") return {};
      if (selector === "[data-search-page-input]") return input;
      if (selector === "[data-search-results-count]") return count;
      if (selector === "[data-search-empty]") return empty;
      if (selector === "[data-selected-topic-title]") return selectedTitle;
      if (selector === "[data-selected-topic-copy]") return selectedCopy;
      if (selector === "[data-selected-questions-title]") return selectedQuestionsTitle;
      if (selector === "[data-selected-results-title]") return selectedResultsTitle;
      if (selector === "[data-search-index]") return { textContent: JSON.stringify(searchIndex) };
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-search-result]") return cards;
      if (selector === "[data-search-preset]") return presets;
      if (selector === "[data-search-question]") return questions;
      if (selector === "[data-language-link]") return languageLinks;
      return [];
    }
  };

  globalThis.window = {
    location: { pathname: "/search/", search: windowSearch, href: `https://thedementiatimes.com/search/${windowSearch}` },
    history: {
      replaceState() {}
    }
  };

  return {
    input,
    count,
    empty,
    selectedTitle,
    selectedCopy,
    selectedQuestionsTitle,
    selectedResultsTitle,
    resultsList,
    restore() {
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
    }
  };
}

test("search page keeps one-word shower searches focused on strongly relevant articles", async () => {
  const cards = [
    resultCard({
      title: "Why Does Bathing Become a Battle in Dementia?",
      search: "bathing shower refusal bath water privacy bathroom dignity"
    }),
    resultCard({
      title: "Why Does My Loved One With Dementia Refuse to Shower?",
      search: "mom shower bathing bath hygiene refuses screams"
    }),
    resultCard({
      title: "What Support Do Dementia Caregivers Actually Need at Home?",
      search: "caregiver support includes shower shower shower shower shower shower as repeated examples"
    }),
    resultCard({
      title: "How Is Dementia Actually Diagnosed?",
      search: "activities of daily living hygiene and diagnosis"
    })
  ];
  const setup = setupSearchPage({ windowSearch: "?q=ducha", cards });

  try {
    await import(`../src/client/search-page.js?focusedShowerTest=${Date.now()}`);

    assert.deepEqual(cards.map((card) => card.hidden), [false, false, true, true]);
    assert.equal(setup.count.textContent, "2 articles");
    assert.equal(setup.empty.hidden, true);
    assert.ok(Number(cards[0].style.order) < Number(cards[2].style.order));
    assert.deepEqual(
      setup.resultsList.children.filter((card) => !card.hidden).map((card) => card.dataset.title),
      [
        "Why Does Bathing Become a Battle in Dementia?",
        "Why Does My Loved One With Dementia Refuse to Shower?"
      ]
    );
  } finally {
    setup.restore();
  }
});

test("a homepage topic path immediately shows only that topic's direct answers and newsletters", async () => {
  const cards = [
    resultCard({ title: "What Is Dementia?", search: "dementia basics", categories: "basics" }),
    resultCard({ title: "Why Is Mom Aggressive?", search: "behavior aggression", categories: "behavior" })
  ];
  const presets = [
    presetLink({ id: "basics", label: "Dementia basics", description: "Plain-language explanations.", defaultQuery: "normal aging diagnosis" }),
    presetLink({ id: "behavior", label: "Behavior problems", description: "Help with behavior changes.", defaultQuery: "agitation aggression" })
  ];
  const questions = [questionCard("basics"), questionCard("behavior")];
  const setup = setupSearchPage({ windowSearch: "?path=basics", cards, presets, questions });

  try {
    await import(`../src/client/search-page.js?directPathTest=${Date.now()}`);

    assert.deepEqual(cards.map((card) => card.hidden), [false, true]);
    assert.deepEqual(questions.map((question) => question.hidden), [false, true]);
    assert.equal(setup.selectedTitle.textContent, "Dementia basics: direct answers and newsletters");
    assert.equal(setup.selectedCopy.textContent, "Plain-language explanations.");
    assert.equal(setup.selectedQuestionsTitle.textContent, "Common questions about Dementia basics");
    assert.equal(setup.selectedResultsTitle.textContent, "Newsletters about Dementia basics");
    assert.equal(presets[0].hasAttribute("aria-current"), true);
    assert.equal(presets[1].hasAttribute("aria-current"), false);
  } finally {
    setup.restore();
  }
});

test("search page treats Russian shower searches with the same focused relevance", async () => {
  const cards = [
    resultCard({
      title: "Why Does Bathing Become a Battle in Dementia?",
      search: "bathing shower refusal bath water privacy bathroom dignity"
    }),
    resultCard({
      title: "General caregiver stress",
      search: "caregiver stress mentions shower once"
    })
  ];
  const setup = setupSearchPage({ windowSearch: "?q=душ", cards });

  try {
    await import(`../src/client/search-page.js?focusedRussianShowerTest=${Date.now()}`);

    assert.deepEqual(cards.map((card) => card.hidden), [false, true]);
    assert.equal(setup.count.textContent, "1 article");
  } finally {
    setup.restore();
  }
});

test("search page previews a matching section that appears late in an article", async () => {
  const cards = [
    resultCard({
      slug: "caregiver-guide",
      title: "Shower Help for Dementia Caregivers",
      search: "caregiver shower bathing privacy"
    })
  ];
  const searchIndex = [
    {
      slug: "caregiver-guide",
      title: "Shower Help for Dementia Caregivers",
      excerpt: "A caregiver guide.",
      snippets: [
        { heading: "Introduction", text: "Start by observing the daily routine.", searchText: "introduction daily routine" },
        { heading: "Make bathing feel safer", text: "Warm the room and offer a towel before the shower.", searchText: "make bathing feel safer warm room towel shower" }
      ]
    }
  ];
  const setup = setupSearchPage({ windowSearch: "?q=shower", cards, searchIndex });

  try {
    await import(`../src/client/search-page.js?lateSnippetTest=${Date.now()}`);

    assert.equal(cards[0].hidden, false);
    assert.equal(cards[0].snippetHeading.textContent, "Make bathing feel safer");
    assert.equal(cards[0].snippetText.textContent, "Warm the room and offer a towel before the shower.");
  } finally {
    setup.restore();
  }
});

test("search filtering uses the embedded section index without duplicating full article text on result cards", async () => {
  const cards = [resultCard({ slug: "indexed-shower", title: "Caregiver guide", search: "" })];
  const searchIndex = [
    {
      slug: "indexed-shower",
      title: "Caregiver guide",
      excerpt: "A practical caregiver guide.",
      topics: ["Bathing refusal"],
      snippets: [{ heading: "Shower refusal", text: "Offer a warm towel before the shower." }]
    }
  ];
  const setup = setupSearchPage({ windowSearch: "?q=towel", cards, searchIndex });

  try {
    await import(`../src/client/search-page.js?embeddedIndexSearchTest=${Date.now()}`);
    assert.equal(cards[0].hidden, false);
  } finally {
    setup.restore();
  }
});

test("typed searches hide unrelated common questions and keep the matching answer visible", async () => {
  const cards = [
    resultCard({
      title: "Why Does My Loved One Refuse to Shower?",
      search: "shower bathing hygiene refusal"
    })
  ];
  const questions = [
    questionCard("refusing-help", "mom shower bath hygiene refuses"),
    questionCard("diagnosis-planning", "early diagnosis stages planning"),
    questionCard("medication-treatment", "dementia medication pills treatment")
  ];
  const setup = setupSearchPage({ windowSearch: "?q=how%20do%20I%20get%20mom%20to%20shower", cards, questions });

  try {
    await import(`../src/client/search-page.js?questionFilterTest=${Date.now()}`);

    assert.deepEqual(questions.map((question) => question.hidden), [false, true, true]);
  } finally {
    setup.restore();
  }
});

test("Spanish shower searches accept translated title forms such as ducharse and bañarse", async () => {
  const cards = [
    resultCard({
      title: "Por qué bañarse se vuelve una batalla en la demencia",
      search: "bañarse ducha higiene resistencia"
    }),
    resultCard({
      title: "Por qué mi ser querido rechaza ducharse",
      search: "ducharse baño higiene rechazo"
    })
  ];
  const setup = setupSearchPage({ windowSearch: "?q=ducha", cards });

  try {
    await import(`../src/client/search-page.js?spanishBathingFormsTest=${Date.now()}`);

    assert.deepEqual(cards.map((card) => card.hidden), [false, false]);
    assert.equal(setup.count.textContent, "2 articles");
  } finally {
    setup.restore();
  }
});

test("full Spanish and Russian caregiver questions keep bathing results ahead of medication articles", async () => {
  const spanishCards = [
    resultCard({ title: "Por qué bañarse se vuelve una batalla", search: "ducha bañarse higiene" }),
    resultCard({ title: "Guía de medicamentos para la demencia", search: "medicamentos tratamiento" })
  ];
  const spanishSetup = setupSearchPage({ windowSearch: "?q=como%20hago%20para%20que%20mi%20mama%20se%20duche", cards: spanishCards });

  try {
    await import(`../src/client/search-page.js?spanishCaregiverQuestionTest=${Date.now()}`);
    assert.deepEqual(spanishCards.map((card) => card.hidden), [false, true]);
  } finally {
    spanishSetup.restore();
  }

  const russianCards = [
    resultCard({ title: "Почему купание становится битвой", search: "душ купание гигиена" }),
    resultCard({ title: "Лекарства при деменции", search: "лекарства лечение" })
  ];
  const russianSetup = setupSearchPage({ windowSearch: "?q=как%20уговорить%20маму%20принять%20душ", cards: russianCards });

  try {
    await import(`../src/client/search-page.js?russianCaregiverQuestionTest=${Date.now()}`);
    assert.deepEqual(russianCards.map((card) => card.hidden), [false, true]);
  } finally {
    russianSetup.restore();
  }
});

test("interactive Russian result counts use locale-aware plural forms", async () => {
  const cards = [
    resultCard({ title: "Почему купание становится битвой", search: "душ купание" }),
    resultCard({ title: "Почему близкий отказывается принимать душ", search: "душ купание" })
  ];
  const setup = setupSearchPage({
    windowSearch: "?q=душ",
    cards,
    countDataset: {
      countLocale: "ru",
      countOne: "{count} статья",
      countFew: "{count} статьи",
      countMany: "{count} статей",
      countOther: "{count} статей"
    }
  });

  try {
    await import(`../src/client/search-page.js?russianPluralClientTest=${Date.now()}`);

    assert.equal(setup.count.textContent, "2 статьи");
  } finally {
    setup.restore();
  }
});

test("language buttons preserve the current search and topic path", async () => {
  const spanish = languageLink("/es/search/");
  const russian = languageLink("/ru/search/");
  const setup = setupSearchPage({ windowSearch: "?path=behavior&q=shower", languageLinks: [spanish, russian] });

  try {
    await import(`../src/client/search-page.js?languageSearchTest=${Date.now()}`);
    assert.equal(spanish.href(), "/es/search/?path=behavior&q=shower");
    assert.equal(russian.href(), "/ru/search/?path=behavior&q=shower");
  } finally {
    setup.restore();
  }
});
