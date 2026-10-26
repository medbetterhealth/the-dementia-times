import test from "node:test";
import assert from "node:assert/strict";

function control(value = "") {
  const listeners = {};
  return {
    value,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type) {
      listeners[type]?.({ type });
    }
  };
}

function archiveRow(title, topics, search = "", categories = "") {
  return {
    dataset: { title, topics, search, categories },
    hidden: false
  };
}

function eventTarget(initial = {}) {
  const listeners = {};
  return {
    ...initial,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    dispatch(type, event = {}) {
      return listeners[type]?.({ type, ...event });
    }
  };
}

function setupArchiveDocument({
  modal = null,
  form = null,
  email = null,
  message = null,
  storage = new Map(),
  windowSearch = "",
  printButtons = [],
  shareButtons = [],
  sharePanels = new Map(),
  smsForms = [],
  fetchImpl = async () => ({ ok: true }),
  rows = [archiveRow("dementia agitation care", "behavior,caregiving")]
} = {}) {
  const searchInput = control();
  const topicSelect = control();
  const archiveCount = { textContent: "" };
  const emptyState = { hidden: true };
  const bodyClasses = new Set();
  const documentListeners = {};
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousFetch = globalThis.fetch;

  globalThis.document = {
    body: {
      classList: {
        add(value) {
          bodyClasses.add(value);
        },
        remove(value) {
          bodyClasses.delete(value);
        },
        contains(value) {
          return bodyClasses.has(value);
        }
      }
    },
    querySelector(selector) {
      if (selector === "[data-archive-search]") return searchInput;
      if (selector === "[data-topic-filter]") return topicSelect;
      if (selector === "[data-archive-count]") return archiveCount;
      if (selector === "[data-archive-empty]") return emptyState;
      if (selector === "[data-featured-carousel]") return null;
      if (selector === "[data-newsletter-modal]") return modal;
      if (selector === "[data-newsletter-signup]") return form;
      if (selector === "#newsletter-email") return email;
      if (selector === "[data-newsletter-message]") return message;
      return null;
    },
    getElementById(id) {
      return sharePanels.get(id) ?? null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-archive-item]") return rows;
      if (selector === "[data-print-article]") return printButtons;
      if (selector === "[data-share-article]") return shareButtons;
      if (selector === "[data-sms-share]") return smsForms;
      return [];
    },
    addEventListener(type, listener) {
      documentListeners[type] = listener;
    },
    dispatch(type, event = {}) {
      documentListeners[type]?.({ type, ...event });
    }
  };

  globalThis.window = {
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      }
    },
    location: { href: "", search: windowSearch },
    printCalled: false,
    plausibleEvents: [],
    plausible(eventName) {
      this.plausibleEvents.push(eventName);
    },
    print() {
      this.printCalled = true;
    },
    setTimeout(callback) {
      callback();
      return 1;
    }
  };
  globalThis.fetch = fetchImpl;

  return {
    storage,
    rows,
    bodyClasses,
    restore() {
      globalThis.document = previousDocument;
      globalThis.window = previousWindow;
      globalThis.fetch = previousFetch;
    }
  };
}

test("archive filter updates count text, hidden rows, and empty state", async () => {
  const searchInput = control();
  const topicSelect = control();
  const archiveCount = { textContent: "" };
  const emptyState = { hidden: true };
  const rows = [
    archiveRow("dementia agitation care", "behavior,caregiving"),
    archiveRow("hearing loss and dementia", "hearing,diagnosis"),
    archiveRow("nutrition support", "nutrition,caregiving")
  ];
  const previousDocument = globalThis.document;

  globalThis.document = {
    querySelector(selector) {
      if (selector === "[data-archive-search]") return searchInput;
      if (selector === "[data-topic-filter]") return topicSelect;
      if (selector === "[data-archive-count]") return archiveCount;
      if (selector === "[data-archive-empty]") return emptyState;
      if (selector === "[data-featured-carousel]") return null;
      return null;
    },
    querySelectorAll(selector) {
      return selector === "[data-archive-item]" ? rows : [];
    }
  };

  try {
    await import(`../src/client/archive-filter.js?test=${Date.now()}`);

    assert.equal(archiveCount.textContent, "Showing 3 editions.");
    assert.equal(emptyState.hidden, true);

    searchInput.value = "agitation";
    searchInput.dispatch("input");
    assert.equal(archiveCount.textContent, "Showing 1 edition. 2 editions hidden by filters.");
    assert.deepEqual(rows.map((row) => row.hidden), [false, true, true]);
    assert.equal(emptyState.hidden, true);

    topicSelect.value = "nutrition";
    topicSelect.dispatch("change");
    assert.equal(archiveCount.textContent, "Showing 0 editions. 3 editions hidden by filters.");
    assert.deepEqual(rows.map((row) => row.hidden), [true, true, true]);
    assert.equal(emptyState.hidden, false);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("archive filter applies q query parameter on load", async () => {
  const setup = setupArchiveDocument({ windowSearch: "?q=hearing" });

  try {
    await import(`../src/client/archive-filter.js?queryTest=${Date.now()}`);

    assert.equal(setup.rows[0].hidden, true);
  } finally {
    setup.restore();
  }
});

test("archive search understands caregiver-language questions instead of only exact headlines", async () => {
  const rows = [
    archiveRow(
      "why does my loved one with dementia refuse to shower",
      "bathing refusal in dementia",
      "mom mother shower bathing bath hygiene refuses screams fights wrists clean clothes"
    ),
    archiveRow(
      "why do dementia patients refuse help",
      "anosognosia and the dementia blind spot",
      "mom says nothing is wrong refuses help thinks fine no insight"
    ),
    archiveRow(
      "what is dementia",
      "dementia awareness",
      "normal aging memory repeated questions diagnosis basics"
    )
  ];
  const setup = setupArchiveDocument({ rows });

  try {
    await import(`../src/client/archive-filter.js?careSearchTest=${Date.now()}`);

    const searchInput = globalThis.document.querySelector("[data-archive-search]");
    searchInput.value = "how do i get my mom to shower";
    searchInput.dispatch("input");

    assert.deepEqual(rows.map((row) => row.hidden), [false, true, true]);
  } finally {
    setup.restore();
  }
});

test("archive search keeps Spanish accents and Russian Cyrillic tokens searchable", async () => {
  const rows = [
    archiveRow("shower refusal", "behavior", "ducha baño higiene душ купание гигиена"),
    archiveRow("sleep help", "sleep", "sueño сон ночь")
  ];
  const setup = setupArchiveDocument({ rows });

  try {
    await import(`../src/client/archive-filter.js?unicodeSearchTest=${Date.now()}`);

    const searchInput = globalThis.document.querySelector("[data-archive-search]");
    searchInput.value = "душ";
    searchInput.dispatch("input");

    assert.deepEqual(rows.map((row) => row.hidden), [false, true]);

    searchInput.value = "baño";
    searchInput.dispatch("input");

    assert.deepEqual(rows.map((row) => row.hidden), [false, true]);
  } finally {
    setup.restore();
  }
});

test("archive topic filter uses curated caregiver categories, not broad text matches", async () => {
  const rows = [
    archiveRow(
      "why does my loved one with dementia refuse to shower",
      "bathing refusal in dementia",
      "mom shower bathing refusal",
      "refusing-help,behavior"
    ),
    archiveRow(
      "why is mom being so aggressive",
      "behavioral changes in dementia",
      "agitation yelling aggression behavior",
      "behavior"
    ),
    archiveRow(
      "what is dementia",
      "dementia awareness",
      "normal aging diagnosis basics",
      "basics"
    )
  ];
  const setup = setupArchiveDocument({ rows });
  const topicSelect = globalThis.document.querySelector("[data-topic-filter]");
  topicSelect.options = [{ value: "behavior" }, { value: "refusing-help" }, { value: "basics" }];

  try {
    await import(`../src/client/archive-filter.js?categoryTest=${Date.now()}`);

    topicSelect.value = "refusing-help";
    topicSelect.dispatch("change");
    assert.deepEqual(rows.map((row) => row.hidden), [false, true, true]);

    topicSelect.value = "behavior";
    topicSelect.dispatch("change");
    assert.deepEqual(rows.map((row) => row.hidden), [false, false, true]);
  } finally {
    setup.restore();
  }
});

test("article print button calls window.print and records a plausible event when available", async () => {
  const printButton = eventTarget();
  const setup = setupArchiveDocument({ printButtons: [printButton] });

  try {
    await import(`../src/client/archive-filter.js?printTest=${Date.now()}`);
    printButton.dispatch("click");

    assert.equal(globalThis.window.printCalled, true);
    assert.deepEqual(globalThis.window.plausibleEvents, ["Print Article"]);
  } finally {
    setup.restore();
  }
});

test("article share button opens the share panel", async () => {
  const shareButton = eventTarget({ dataset: { shareTarget: "share-panel" }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } });
  const focusTarget = { focusCalled: false, focus() { this.focusCalled = true; } };
  const panel = { hidden: true, querySelector() { return focusTarget; } };
  const setup = setupArchiveDocument({
    shareButtons: [shareButton],
    sharePanels: new Map([["share-panel", panel]])
  });

  try {
    await import(`../src/client/archive-filter.js?shareTest=${Date.now()}`);
    shareButton.dispatch("click");

    assert.equal(panel.hidden, false);
    assert.equal(shareButton.attributes["aria-expanded"], "true");
    assert.equal(focusTarget.focusCalled, true);
  } finally {
    setup.restore();
  }
});

test("sms share form opens the native text app even if a legacy endpoint exists", async () => {
  const message = { textContent: "" };
  const smsForm = eventTarget({
    dataset: {
      smsEndpoint: "https://example.com/sms",
      smsBody: "Article title\nhttps://thedementiatimes.com/issues/example/",
      articleTitle: "Article title",
      articleUrl: "https://thedementiatimes.com/issues/example/"
    },
    querySelector(selector) {
      return selector === "[data-sms-message]" ? message : null;
    }
  });
  const requests = [];
  const previousFormData = globalThis.FormData;
  globalThis.FormData = class {
    get(name) {
      return name === "to" ? "555-555-5555" : "";
    }
  };
  const setup = setupArchiveDocument({
    smsForms: [smsForm],
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true };
    }
  });

  try {
    await import(`../src/client/archive-filter.js?smsTest=${Date.now()}`);
    await smsForm.dispatch("submit", { preventDefault() {} });

    assert.equal(requests.length, 0);
    assert.match(globalThis.window.location.href, /^sms:5555555555\?body=/);
    assert.equal(message.textContent, "Opening your text message app.");
  } finally {
    globalThis.FormData = previousFormData;
    setup.restore();
  }
});

test("newsletter modal opens once, dismisses, and redirects after email submit", async () => {
  const modal = eventTarget({ hidden: true });
  const email = { value: "reader@example.com", focusCalled: false, focus() { this.focusCalled = true; } };
  const message = { textContent: "" };
  const form = eventTarget({ dataset: { signupUrl: "https://www.linkedin.com/newsletters/example/" } });
  const setup = setupArchiveDocument({ modal, form, email, message });

  try {
    await import(`../src/client/archive-filter.js?modalTest=${Date.now()}`);

    assert.equal(modal.hidden, false);
    assert.equal(email.focusCalled, true);
    assert.equal(setup.bodyClasses.has("has-signup-modal"), true);

    form.dispatch("submit", { preventDefault() {} });
    assert.equal(setup.storage.get("tdtNewsletterSignupEmail"), "reader@example.com");
    assert.equal(setup.storage.get("tdtNewsletterSignupDismissed"), "1");
    assert.equal(message.textContent, "Thanks. Opening the LinkedIn subscription page now.");
    assert.equal(globalThis.window.location.href, "https://www.linkedin.com/newsletters/example/");
  } finally {
    setup.restore();
  }
});

test("newsletter modal closes from the backdrop", async () => {
  const modal = eventTarget({ hidden: true });
  const email = { value: "", focus() {} };
  const setup = setupArchiveDocument({ modal, email });
  const dismissTarget = {
    closest(selector) {
      return selector === "[data-newsletter-dismiss]" ? dismissTarget : null;
    }
  };

  try {
    await import(`../src/client/archive-filter.js?dismissTest=${Date.now()}`);
    assert.equal(modal.hidden, false);

    modal.dispatch("click", { target: dismissTarget });
    assert.equal(modal.hidden, true);
    assert.equal(setup.storage.get("tdtNewsletterSignupDismissed"), "1");
    assert.equal(setup.bodyClasses.has("has-signup-modal"), false);
  } finally {
    setup.restore();
  }
});
