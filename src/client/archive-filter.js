const searchInput = document.querySelector("[data-archive-search]");
const topicSelect = document.querySelector("[data-topic-filter]");
const archiveCount = document.querySelector("[data-archive-count]");
const emptyState = document.querySelector("[data-archive-empty]");
const rows = Array.from(document.querySelectorAll("[data-archive-item]"));
const printButtons = Array.from(document.querySelectorAll("[data-print-article]"));
const shareButtons = Array.from(document.querySelectorAll("[data-share-article]"));
const smsShareForms = Array.from(document.querySelectorAll("[data-sms-share]"));
const carousel = document.querySelector("[data-featured-carousel]");
const newsletterModal = document.querySelector("[data-newsletter-modal]");
const newsletterForm = document.querySelector("[data-newsletter-signup]");
const newsletterEmail = document.querySelector("#newsletter-email");
const newsletterMessage = document.querySelector("[data-newsletter-message]");
const signupStorageKey = "tdtNewsletterSignupDismissed";
const signupEmailStorageKey = "tdtNewsletterSignupEmail";

function editionLabel(count) {
  return count === 1 ? "edition" : "editions";
}

function fillTemplate(template, values) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

const searchStopWords = new Set([
  "a",
  "about",
  "after",
  "all",
  "am",
  "an",
  "and",
  "are",
  "be",
  "been",
  "being",
  "can",
  "care",
  "dementia",
  "did",
  "do",
  "does",
  "doing",
  "for",
  "get",
  "gets",
  "got",
  "had",
  "has",
  "have",
  "help",
  "her",
  "him",
  "his",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "my",
  "of",
  "on",
  "one",
  "or",
  "our",
  "she",
  "should",
  "someone",
  "the",
  "their",
  "them",
  "they",
  "this",
  "to",
  "we",
  "what",
  "when",
  "where",
  "why",
  "with",
  "won",
  "wont",
  "t",
  "you",
  "your"
]);

const querySynonyms = {
  bath: ["bath", "bathing", "shower", "hygiene", "wash"],
  bathing: ["bath", "bathing", "shower", "hygiene", "wash", "ducha", "baño", "душ", "купание"],
  behavior: ["behavior", "behaviour", "agitation", "aggressive", "yelling", "refusal", "wandering", "delusion", "hallucination"],
  behaviour: ["behavior", "behaviour", "agitation", "aggressive", "yelling", "refusal", "wandering", "delusion", "hallucination"],
  "baño": ["bath", "bathing", "shower", "hygiene", "wash", "ducha", "baño", "душ", "купание"],
  car: ["car", "driving", "drive", "keys", "license"],
  drive: ["car", "driving", "drive", "keys", "license"],
  driving: ["car", "driving", "drive", "keys", "license"],
  eat: ["eat", "eating", "food", "meal", "mealtime", "swallowing", "pocketing"],
  eating: ["eat", "eating", "food", "meal", "mealtime", "swallowing", "pocketing"],
  food: ["eat", "eating", "food", "meal", "mealtime", "swallowing", "pocketing"],
  medication: ["medication", "medicine", "meds", "pills", "treatment"],
  medicine: ["medication", "medicine", "meds", "pills", "treatment"],
  meds: ["medication", "medicine", "meds", "pills", "treatment"],
  night: ["night", "nighttime", "sleep", "awake", "sundowning", "4pm"],
  pills: ["medication", "medicine", "meds", "pills", "treatment"],
  refuse: ["refuse", "refuses", "refusal", "resist", "won't", "wont"],
  refuses: ["refuse", "refuses", "refusal", "resist", "won't", "wont"],
  refusing: ["refuse", "refuses", "refusal", "resist", "won't", "wont"],
  shower: ["bath", "bathing", "shower", "hygiene", "wash", "ducha", "baño", "душ", "купание"],
  ducha: ["bath", "bathing", "shower", "hygiene", "wash", "ducha", "baño", "душ", "купание"],
  sleep: ["night", "nighttime", "sleep", "awake", "sundowning", "4pm"],
  stealing: ["stealing", "stole", "accuse", "accusing", "accusation", "paranoia", "money"],
  stole: ["stealing", "stole", "accuse", "accusing", "accusation", "paranoia", "money"],
  "душ": ["bath", "bathing", "shower", "hygiene", "wash", "ducha", "baño", "душ", "купание"],
  "купание": ["bath", "bathing", "shower", "hygiene", "wash", "ducha", "baño", "душ", "купание"]
};

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

function queryTokens(value) {
  return normalizeSearchValue(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !searchStopWords.has(token));
}

function tokenMatchesHaystack(token, haystack) {
  const candidates = querySynonyms[token] || [token];
  return candidates.some((candidate) => {
    const normalized = normalizeSearchValue(candidate);
    if (!normalized) return false;
    if (haystack.includes(normalized)) return true;
    if (normalized.endsWith("s") && haystack.includes(normalized.slice(0, -1))) return true;
    if (normalized.endsWith("ing") && haystack.includes(normalized.slice(0, -3))) return true;
    return false;
  });
}

function updateArchiveCount(visibleCount) {
  if (!archiveCount) return;
  const hiddenCount = rows.length - visibleCount;
  const defaultVisible = `Showing ${visibleCount} ${editionLabel(visibleCount)}.`;
  if (hiddenCount > 0 && archiveCount.dataset?.hiddenTemplate) {
    archiveCount.textContent = fillTemplate(archiveCount.dataset.hiddenTemplate, { visible: visibleCount, hidden: hiddenCount });
  } else if (archiveCount.dataset?.countTemplate) {
    archiveCount.textContent = fillTemplate(archiveCount.dataset.countTemplate, { count: visibleCount });
  } else {
    archiveCount.textContent = hiddenCount > 0 ? `${defaultVisible} ${hiddenCount} ${editionLabel(hiddenCount)} hidden by filters.` : defaultVisible;
  }
}

function applyArchiveFilters() {
  const tokens = queryTokens(searchInput?.value || "");
  const topic = (topicSelect?.value || "").trim().toLowerCase();
  let visibleCount = 0;

  for (const row of rows) {
    const title = row.dataset.title || "";
    const topics = row.dataset.topics || "";
    const search = row.dataset.search || "";
    const categories = row.dataset.categories || "";
    const haystack = normalizeSearchValue([title, topics, search, categories].join(" "));
    const textMatches = tokens.length === 0 || tokens.every((token) => tokenMatchesHaystack(token, haystack));
    const categoryValues = categories.split(",").map((value) => value.trim()).filter(Boolean);
    const topicValues = topics.split(",").map((value) => value.trim()).filter(Boolean);
    const topicMatches = !topic || categoryValues.includes(topic) || topicValues.includes(topic);
    const isVisible = textMatches && topicMatches;
    row.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  }

  if (emptyState) {
    emptyState.hidden = visibleCount > 0;
  }

  updateArchiveCount(visibleCount);
}

searchInput?.addEventListener("input", applyArchiveFilters);
topicSelect?.addEventListener("change", applyArchiveFilters);

function applyInitialArchiveFiltersFromUrl() {
  const search = globalThis.window?.location?.search || "";
  if (!search) return;
  const params = new URLSearchParams(search);
  const query = params.get("q");
  const topic = params.get("topic");

  if (query && searchInput) {
    searchInput.value = query;
  }

  if (topic && topicSelect) {
    const normalizedTopic = topic.trim().toLowerCase();
    const hasOption = Array.from(topicSelect.options || []).some((option) => option.value === normalizedTopic);
    if (hasOption) {
      topicSelect.value = normalizedTopic;
    }
  }
}

function initializePrintButtons() {
  for (const button of printButtons) {
    button.addEventListener("click", () => {
      if (typeof window.plausible === "function") {
        window.plausible("Print Article");
      }
      window.print?.();
    });
  }
}

function initializeArticleSharePanels() {
  for (const button of shareButtons) {
    const targetId = button.dataset.shareTarget;
    const panel = targetId ? document.getElementById(targetId) : null;
    if (!panel) continue;

    button.addEventListener("click", () => {
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      button.setAttribute("aria-expanded", willOpen ? "true" : "false");
      if (willOpen) {
        panel.querySelector("a, input, button")?.focus?.();
      }
    });
  }
}

function smsHref(phoneNumber, message) {
  const phone = String(phoneNumber || "").replace(/[^\d+]/g, "");
  const separator = /iPad|iPhone|iPod/i.test(globalThis.navigator?.userAgent || "") ? "&" : "?";
  return `sms:${encodeURIComponent(phone)}${separator}body=${encodeURIComponent(message)}`;
}

function initializeSmsShareForms() {
  for (const form of smsShareForms) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const messageEl = form.querySelector("[data-sms-message]");
      const formData = new FormData(form);
      const to = String(formData.get("to") || "").trim();
      const articleTitle = form.dataset.articleTitle || document.title;
      const articleUrl = form.dataset.articleUrl || window.location.href;
      const message = form.dataset.smsBody || `${articleTitle}\n${articleUrl}`;

      if (!to) {
        if (messageEl) messageEl.textContent = form.dataset.smsMissingPhone || "Enter a phone number first.";
        return;
      }

      if (messageEl) messageEl.textContent = form.dataset.smsOpening || "Opening your text message app.";
      window.location.href = smsHref(to, message);
    });
  }
}

function attachSwipeNavigation(element, { onSwipeLeft, onSwipeRight, threshold = 40 } = {}) {
  if (!element) return;

  let startX = 0;
  let startY = 0;
  let tracking = false;

  element.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    },
    { passive: true }
  );

  element.addEventListener(
    "touchend",
    (event) => {
      if (!tracking) return;
      tracking = false;

      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) < threshold || Math.abs(deltaX) <= Math.abs(deltaY)) return;

      event.preventDefault();
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    },
    { passive: false }
  );
}

function initializeFeaturedCarousel() {
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
  const previousButton = carousel.querySelector("[data-carousel-prev]");
  const nextButton = carousel.querySelector("[data-carousel-next]");
  if (slides.length <= 1) return;

  let activeIndex = Math.max(
    0,
    slides.findIndex((slide) => slide.classList.contains("is-active"))
  );

  function showSlide(nextIndex) {
    activeIndex = (nextIndex + slides.length) % slides.length;

    slides.forEach((slide, index) => {
      const isActive = index === activeIndex;
      slide.hidden = !isActive;
      slide.classList.toggle("is-active", isActive);
      slide.setAttribute("aria-hidden", isActive ? "false" : "true");
    });

    dots.forEach((dot, index) => {
      if (index === activeIndex) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
  }

  previousButton?.addEventListener("click", () => showSlide(activeIndex - 1));
  nextButton?.addEventListener("click", () => showSlide(activeIndex + 1));

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => showSlide(index));
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(activeIndex - 1);
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(activeIndex + 1);
    }
  });

  attachSwipeNavigation(carousel.querySelector(".carousel-frame") ?? carousel, {
    onSwipeLeft: () => showSlide(activeIndex + 1),
    onSwipeRight: () => showSlide(activeIndex - 1)
  });

  showSlide(activeIndex);
}

initializeFeaturedCarousel();
applyInitialArchiveFiltersFromUrl();
initializePrintButtons();
initializeArticleSharePanels();
initializeSmsShareForms();
applyArchiveFilters();

function safelyGetStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safelySetStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

function closeNewsletterModal() {
  if (!newsletterModal) return;
  newsletterModal.hidden = true;
  document.body.classList.remove("has-signup-modal");
  safelySetStorageItem(signupStorageKey, "1");
}

function openNewsletterModal() {
  if (!newsletterModal || safelyGetStorageItem(signupStorageKey) === "1") return;
  newsletterModal.hidden = false;
  document.body.classList.add("has-signup-modal");
  window.setTimeout(() => newsletterEmail?.focus(), 80);
}

function initializeNewsletterModal() {
  if (!newsletterModal) return;

  newsletterModal.addEventListener("click", (event) => {
    if (event.target.closest("[data-newsletter-dismiss]")) {
      closeNewsletterModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !newsletterModal.hidden) {
      closeNewsletterModal();
    }
  });

  newsletterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = String(newsletterEmail?.value || "").trim();
    if (!email) return;

    safelySetStorageItem(signupEmailStorageKey, email);
    safelySetStorageItem(signupStorageKey, "1");
    if (newsletterMessage) {
      newsletterMessage.textContent = newsletterModal.dataset?.signupSaving || "Thanks. Saving your email now.";
    }

    const captureEndpoint = newsletterForm.dataset.captureEndpoint;
    if (captureEndpoint) {
      try {
        const formData = new FormData(newsletterForm);
        formData.set("email", email);
        formData.set("source", "The Dementia Times popup");
        const response = await fetch(captureEndpoint, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: formData
        });
        if (response.ok) {
          if (newsletterMessage) {
            newsletterMessage.textContent = newsletterModal.dataset?.signupSaved || "Thanks. You are on the list.";
          }
          window.setTimeout(closeNewsletterModal, 900);
          return;
        }
      } catch {
        // Fall back to LinkedIn signup below.
      }
    }

    if (newsletterMessage) {
      newsletterMessage.textContent = newsletterModal.dataset?.signupOpening || "Thanks. Opening the LinkedIn subscription page now.";
    }

    const signupUrl = newsletterForm.dataset.signupUrl;
    if (signupUrl) {
      window.location.href = signupUrl;
    } else {
      closeNewsletterModal();
    }
  });

  window.setTimeout(openNewsletterModal, 700);
}

initializeNewsletterModal();
