import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  renderAuthorPage,
  renderIssueBody,
  renderIssuePage,
  renderGlossaryPage,
  renderHomePage,
  renderSearchPage,
  renderStartHerePage,
  renderSubscribePage,
  renderTopicIndexPage,
  renderTopicPage
} from "../src/lib/render.js";

const site = {
  title: "The Dementia Times",
  siteUrl: "https://thedementiatimes.com",
  presentedBy: "Dr. Erik Ilyayev presents",
  description: "Evidence-based insights on dementia care.",
  newsletterUrl: "https://www.linkedin.com/newsletters/the-dementia-times-7452443336956899329/",
  author: {
    name: "Dr. Erik Ilyayev, MD",
    role: "CEO, MedBetter Health",
    linkedinUrl: "https://www.linkedin.com/in/erik-ilyayev-b9795084/",
    headshot: "/assets/brand/dr-erik-headshot.jpeg"
  },
  brand: {
    medBetterUrl: "https://medbetterhealth.org/",
    logo: "/assets/brand/medbetter-health-logo.png",
    youtubeUrl: "https://www.youtube.com/@erikilyayev",
    youtubePlaylistUrl: "https://www.youtube.com/watch?v=58ziiR8eujM&list=PLghCRz2fTSjo_WUu-kYFhMsBGDJz-ExPE&pp=sAgC",
    youtubeBanner: "/assets/brand/straight-talk-with-dr-erik-banner.jpg"
  },
  guide: {
    label: "Medicare Program · GUIDE Model Participant",
    title: "Imagine a world where caring for your loved one with dementia doesn't mean doing it alone.",
    body: "Where you have someone to help at home, and 24/7 access to support when you need it. You don't have to imagine anymore. This is now a reality, and covered by Medicare*.",
    secondaryBody: "Through the MedBetterHealth GUIDE Model, Medicare covers home care services to help you support your loved one. You get the support you need. Ready to get started? See if you qualify.",
    benefitScenarios: [
      "Medicare may cover home care services so you can rest, go to your own appointment, or have dinner with family while your loved one is cared for.",
      "A 24/7 support line gives you somewhere to call when Mom is acting different at night and you are not sure what to do.",
      "Care guidance can help you handle shower refusal, medication refusal, agitation, or confusion with calmer steps."
    ],
    finePrint: "Eligibility requirements apply.",
    url: "https://intakeguide.medbetterhealth.org",
    cta: "See if you qualify"
  }
};

const issue = {
  title: "Why Does Eating Become So Hard in Dementia?",
  slug: "why-does-eating-become-so-hard-in-dementia",
  issueNumber: "41",
  publishedDate: "2026-07-01",
  sourceUrl: "https://www.linkedin.com/pulse/example",
  author: "Dr. Erik Ilyayev, MD",
  excerpt: "A practical look at eating challenges.",
  topics: ["Nutrition", "Caregiving"],
  coverImage: "/assets/issues/example/cover.jpg",
  coverWidth: 1200,
  coverHeight: 630,
  images: [{ src: "/assets/issues/example/slide-1.jpg", alt: "Slide 1", width: 1200, height: 630 }],
  sections: [
    { type: "heading", text: "The Iceberg of Refusal" },
    { type: "paragraph", text: "Behavior is communication." },
    { type: "image", src: "/assets/issues/example/slide-1.jpg", alt: "Slide 1", width: 1200, height: 630 },
    { type: "list", items: ["Reduce background noise", "Face the person directly"] }
  ],
  disclaimer: "This is education, not medical advice.",
  youtubeVideo: {
    id: "x66xkz-DDM8",
    title: "Dementia Eating Problems: Food Pocketing, Swallowing Trouble, and Aspiration Risk",
    publishedDate: "2026-07-01",
    description: "Food pocketing, swallowing trouble, and aspiration risk in dementia care.",
    thumbnailUrl: "https://i.ytimg.com/vi/x66xkz-DDM8/hqdefault.jpg",
    url: "https://www.youtube.com/watch?v=x66xkz-DDM8",
    embedUrl: "https://www.youtube-nocookie.com/embed/x66xkz-DDM8"
  }
};

const topic = {
  title: "Hearing Loss and Dementia",
  slug: "hearing-loss-and-dementia",
  description: "What families should know about hearing loss and dementia risk.",
  directAnswer:
    "Untreated hearing loss is associated with a higher risk of cognitive decline, but it does not mean someone will definitely develop dementia.",
  keyTakeaways: ["Hearing evaluation can be part of brain-health care.", "Clear communication can reduce confusion."],
  issueSlugs: [issue.slug],
  faqs: [
    {
      question: "Does hearing loss cause dementia?",
      answer: "Hearing loss is associated with increased dementia risk, but families should avoid treating it as a guaranteed cause."
    }
  ],
  sources: [{ title: "Source article", url: "https://example.com/source" }]
};

test("escapeHtml escapes text for safe rendering", () => {
  assert.equal(escapeHtml("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
});

test("renderIssueBody renders headings, paragraphs, images, lists, and disclaimer", () => {
  const html = renderIssueBody(issue);
  assert.match(html, /The Iceberg of Refusal/);
  assert.match(html, /Behavior is communication/);
  assert.match(html, /src="assets\/issues\/example\/slide-1.jpg"/);
  assert.match(html, /<img[^>]+width="\d+"[^>]+height="\d+"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /Reduce background noise/);
  assert.match(html, /This is education, not medical advice/);
});

test("renderIssueBody does not link ordinary article images to the YouTube playlist", () => {
  const html = renderIssueBody(issue, {
    youtubeBannerUrl: site.brand.youtubePlaylistUrl
  });

  assert.doesNotMatch(html, /class="article-youtube-link"/);
  assert.doesNotMatch(html, /https:\/\/www.youtube.com\/watch\?v=58ziiR8eujM&amp;list=PLghCRz2fTSjo_WUu-kYFhMsBGDJz-ExPE&amp;pp=sAgC/);
});

test("renderIssuePage includes source link and author link", () => {
  const previousIssue = { ...issue, title: "Previous Care Topic", slug: "previous-care-topic" };
  const html = renderIssuePage({ site, issue, previousIssue, nextIssue: null });
  assert.match(html, /Why Does Eating Become So Hard in Dementia/);
  assert.match(html, /Companion episode/);
  assert.match(html, /https:\/\/www.youtube-nocookie.com\/embed\/x66xkz-DDM8/);
  assert.match(html, /See if you qualify/);
  assert.match(html, /https:\/\/intakeguide.medbetterhealth.org/);
  assert.match(html, /Imagine a world where caring for your loved one with dementia doesn&#39;t mean doing it alone/);
  assert.match(html, /someone to help at home/);
  assert.match(html, /24\/7 access to support/);
  assert.match(html, /covered by Medicare/);
  assert.match(html, /Medicare covers home care services/);
  assert.match(html, /shower refusal, medication refusal, agitation, or confusion/);
  assert.match(html, /Ready to get started/);
  assert.doesNotMatch(html, /A dedicated Care Navigator/);
  assert.ok(html.indexOf("Imagine a world where") > html.indexOf("Behavior is communication"));
  assert.ok(html.indexOf("Imagine a world where") < html.indexOf("straight-talk-with-dr-erik-banner.jpg"));
  assert.match(html, /class="answer-box care-brief"/);
  assert.match(html, /Quick care brief/);
  assert.match(html, /Try today/);
  assert.match(html, /Call a doctor when/);
  assert.match(html, /<a class="care-brief-video-link" href="#article-video-heading">Related video<\/a>/);
  assert.match(html, /Print \/ save PDF/);
  assert.match(html, /Send to family/);
  assert.match(html, /Send by email/);
  assert.match(html, /Send text message/);
  assert.match(html, /href="sms:\?body=/);
  assert.match(html, /class="button-link share-option-button"/);
  assert.doesNotMatch(html, /data-sms-share/);
  assert.doesNotMatch(html, /RingCentral/);
  assert.match(html, /Article review information/);
  assert.match(html, /class="article-youtube-link"/);
  assert.match(html, /straight-talk-with-dr-erik-banner.jpg/);
  assert.match(html, /https:\/\/www.youtube.com\/watch\?v=58ziiR8eujM&amp;list=PLghCRz2fTSjo_WUu-kYFhMsBGDJz-ExPE&amp;pp=sAgC/);
  assert.match(html, /View original on LinkedIn/);
  assert.match(html, /Back to archive/);
  assert.match(html, /href="..\/..\/"/);
  assert.match(html, /src="..\/..\/assets\/issues\/example\/cover.jpg"/);
  assert.match(html, /Previous Care Topic/);
  assert.match(html, /href="..\/..\/issues\/previous-care-topic\/"/);
  assert.match(html, /https:\/\/www.linkedin.com\/in\/erik-ilyayev-b9795084\//);
  assert.match(html, /src="..\/..\/client\/archive-filter.js"/);
});

test("renderIssuePage does not invent cover dimensions when metadata is missing", () => {
  const html = renderIssuePage({
    site,
    issue: { ...issue, coverWidth: undefined, coverHeight: undefined, coverImageWidth: undefined, coverImageHeight: undefined },
    previousIssue: null,
    nextIssue: null
  });
  const coverTag = html.match(/<img class="article-cover"[^>]+>/)?.[0] || "";

  assert.doesNotMatch(coverTag, /width="\d+"/);
  assert.doesNotMatch(coverTag, /height="\d+"/);
});

test("renderIssuePage surfaces topic-specific downloaded issue images that are not already placed in the body", () => {
  const html = renderIssuePage({
    site,
    issue: {
      ...issue,
      images: [
        ...issue.images,
        { src: "/assets/issues/example/slide-2.jpg", alt: "Slide 2" }
      ]
    },
    previousIssue: null,
    nextIssue: null
  });

  assert.match(html, /Slide deck note/);
  assert.match(html, /Extra visual from this issue/);
  assert.match(html, /src="..\/..\/assets\/issues\/example\/slide-2.jpg"/);
});

test("renderIssuePage hides old GUIDE promo deck slides replaced by the unified CTA", () => {
  const html = renderIssuePage({
    site,
    issue: {
      ...issue,
      images: [
        ...issue.images,
        {
          src: "/assets/issues/what-support-do-dementia-caregivers-actually-need-at-home/image-8.png",
          alt: "Old GUIDE promo slide"
        }
      ]
    },
    previousIssue: null,
    nextIssue: null
  });

  assert.doesNotMatch(html, /Old GUIDE promo slide/);
  assert.doesNotMatch(html, /what-support-do-dementia-caregivers-actually-need-at-home\/image-8\.png/);
});

test("renderIssuePage omits the companion video block when no confident video is assigned", () => {
  const html = renderIssuePage({
    site,
    issue: { ...issue, youtubeVideo: null },
    previousIssue: null,
    nextIssue: null
  });

  assert.doesNotMatch(html, /class="article-video"/);
  assert.doesNotMatch(html, /youtube-nocookie/);
});

test("renderIssuePage supports multiple companion videos for event issues", () => {
  const html = renderIssuePage({
    site,
    issue: {
      ...issue,
      youtubeVideo: null,
      youtubeVideos: [
        {
          id: "X_yt-JEJpWw",
          title: "Why Companies Need to Care About Dementia",
          publishedDate: "2026-05-11",
          description: "Dr. Erik speaks at the Alzheimer's Association Corporate Leaders Breakfast.",
          thumbnailUrl: "https://i.ytimg.com/vi/X_yt-JEJpWw/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=X_yt-JEJpWw",
          embedUrl: "https://www.youtube-nocookie.com/embed/X_yt-JEJpWw"
        },
        {
          id: "hO-i7822_kw",
          title: "720,000 Floridians Have Alzheimer's",
          publishedDate: "2026-05-06",
          description: "Dr. Erik discusses Alzheimer's diagnosis and caregiver burden in Florida.",
          thumbnailUrl: "https://i.ytimg.com/vi/hO-i7822_kw/hqdefault.jpg",
          url: "https://www.youtube.com/watch?v=hO-i7822_kw&t=38s",
          embedUrl: "https://www.youtube-nocookie.com/embed/hO-i7822_kw?start=38"
        }
      ]
    },
    previousIssue: null,
    nextIssue: null
  });

  assert.match(html, /Companion episodes/);
  assert.match(html, /There are 2 companion Straight Talk with Dr\. Erik episodes embedded below/);
  assert.match(html, /https:\/\/www.youtube-nocookie.com\/embed\/X_yt-JEJpWw/);
  assert.match(html, /https:\/\/www.youtube-nocookie.com\/embed\/hO-i7822_kw\?start=38/);
  assert.match(html, /https:\/\/www.youtube.com\/watch\?v=hO-i7822_kw&amp;t=38s/);
  assert.match(html, /"url":"https:\/\/www.youtube.com\/watch\?v=X_yt-JEJpWw"/);
  assert.match(html, /"url":"https:\/\/www.youtube.com\/watch\?v=hO-i7822_kw&t=38s"/);
});

test("renderIssuePage includes canonical, social, article, and video structured metadata", () => {
  const html = renderIssuePage({ site, issue, previousIssue: null, nextIssue: null });

  assert.match(html, /<link rel="canonical" href="https:\/\/thedementiatimes.com\/issues\/why-does-eating-become-so-hard-in-dementia\/">/);
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, /<meta property="og:image:alt" content="Why Does Eating Become So Hard in Dementia\?">/);
  assert.match(html, /<meta property="article:published_time" content="2026-07-01">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /"@type":"NewsArticle"/);
  assert.match(html, /"@type":"VideoObject"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /"embedUrl":"https:\/\/www.youtube-nocookie.com\/embed\/x66xkz-DDM8"/);
  assert.match(html, /"isAccessibleForFree":true/);
});

test("renderIssuePage rejects unsafe source URLs", () => {
  assert.throws(
    () =>
      renderIssuePage({
        site,
        issue: { ...issue, sourceUrl: "javascript:alert(1)" },
        previousIssue: null,
        nextIssue: null
      }),
    /Invalid issue sourceUrl/
  );
});

test("renderHomePage includes masthead, latest issue, archive, and YouTube banner", () => {
  const html = renderHomePage({ site, issues: [issue], topics: [topic] });
  assert.match(html, /Dr. Erik Ilyayev presents/);
  assert.match(html, /The Dementia Times/);
  assert.match(html, /Presented by/);
  assert.doesNotMatch(html, /<nav class="site-nav"[\s\S]*href="start-here\//);
  assert.match(html, /href="subscribe\/"/);
  assert.match(html, /Subscribe/);
  assert.match(html, /Choose one simple path/);
  assert.match(html, /pick the box that sounds closest/);
  assert.match(html, /Dementia is new to us/);
  assert.match(html, /A behavior changed/);
  assert.match(html, /Pick the problem/);
  assert.match(html, /No guessing, no search tricks/);
  assert.match(html, /Dementia is new to us/);
  assert.match(html, /They refuse help/);
  assert.match(html, /Planning before a crisis/);
  assert.match(html, /Browse bigger care questions/);
  assert.match(html, /Hearing Loss and Dementia/);
  assert.match(html, /data-newsletter-modal/);
  assert.match(html, /id="newsletter-email"/);
  assert.match(html, /rel="alternate" type="application\/rss\+xml"[^>]+href="https:\/\/thedementiatimes.com\/feed.xml"/);
  assert.match(html, /data-archive-search/);
  assert.match(html, /data-archive-empty/);
  assert.match(html, /<label[^>]+for="archive-search"[^>]*>Search editions<\/label>/);
  assert.match(html, /<input[^>]+id="archive-search"[^>]+data-archive-search[^>]+type="search"[^>]+placeholder="Try: mom (?:won't|won&#39;t) shower, stealing, driving, sleep, medication"[^>]+aria-describedby="archive-count"/);
  assert.match(html, /<label[^>]+for="archive-topic"[^>]*>Pick a care problem<\/label>/);
  assert.match(html, /<select[^>]+id="archive-topic"[^>]+data-topic-filter[^>]+aria-describedby="archive-count"/);
  assert.match(html, /<option value="refusing-help">Refusing help<\/option>/);
  assert.match(html, /<option value="behavior">Behavior changes<\/option>/);
  assert.match(html, /<option value="food-eating">Food and eating<\/option>/);
  assert.match(html, /<p id="archive-count" class="archive-count" data-archive-count[^>]*>Showing 1 edition\.<\/p>/);
  assert.match(html, /data-featured-carousel/);
  assert.match(html, /data-carousel-next/);
  assert.match(html, /carousel-copy/);
  assert.match(html, /Read issue/);
  assert.match(html, /LinkedIn original/);
  assert.match(html, /<li><strong>1<\/strong><span>editions<\/span><\/li>/);
  assert.match(html, /href="issues\/why-does-eating-become-so-hard-in-dementia\/"/);
  assert.match(html, /src="assets\/issues\/example\/cover.jpg"/);
  assert.match(html, /src="client\/archive-filter.js"/);
  assert.match(html, /straight-talk-with-dr-erik-banner.jpg/);
});

test("renderHomePage includes canonical, social, and website structured metadata", () => {
  const html = renderHomePage({ site, issues: [issue] });

  assert.match(html, /<link rel="canonical" href="https:\/\/thedementiatimes.com\/">/);
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/thedementiatimes.com\/assets\/issues\/example\/cover.jpg">/);
  assert.match(html, /<meta property="og:image:alt" content="Why Does Eating Become So Hard in Dementia\?">/);
  assert.match(html, /"@type":"WebSite"/);
  assert.match(html, /"@type":"Person"/);
});

test("renderHomePage versions CSS and client assets when configured", () => {
  const html = renderHomePage({ site: { ...site, assetsVersion: "abc123" }, issues: [issue] });
  assert.match(html, /href="styles\/site.css\?v=abc123"/);
  assert.match(html, /src="client\/archive-filter.js\?v=abc123"/);
});

test("renderHomePage shows recent editions after the latest issue", () => {
  const issues = [
    issue,
    {
      ...issue,
      title: "Caregiver Burnout Warning Signs",
      slug: "caregiver-burnout-warning-signs",
      publishedDate: "2026-06-24"
    },
    {
      ...issue,
      title: "Understanding Wandering Risk",
      slug: "understanding-wandering-risk",
      publishedDate: "2026-06-17"
    }
  ];

  const html = renderHomePage({ site, issues });

  assert.match(html, /class="recent-list"/);
  assert.match(html, /class="recent-item"/);
  assert.match(html, /href="issues\/caregiver-burnout-warning-signs\/"/);
  assert.match(html, /Caregiver Burnout Warning Signs/);
  assert.match(html, /2026-06-24/);
  assert.match(html, /href="issues\/understanding-wandering-risk\/"/);
});

test("renderHomePage exposes archive search and topic filter controls", () => {
  const html = renderHomePage({ site, issues: [issue] });
  assert.match(html, /type="search"/);
  assert.match(html, /for="archive-search"/);
  assert.match(html, /id="archive-search"/);
  assert.match(html, /data-archive-search/);
  assert.match(html, /for="archive-topic"/);
  assert.match(html, /id="archive-topic"/);
  assert.match(html, /data-topic-filter/);
  assert.match(html, /Dementia basics/);
  assert.match(html, /Refusing help/);
  assert.match(html, /Behavior changes/);
  assert.match(html, /Food and eating/);
  assert.match(html, /data-search=/);
  assert.match(html, /data-categories=/);
});

test("homepage archive uses the shared curated taxonomy without defaulting bathing guidance to basics", () => {
  const bathingIssue = {
    ...issue,
    slug: "why-does-bathing-become-a-battle-in-dementia",
    title: "Why Does Bathing Become a Battle in Dementia?"
  };
  const html = renderHomePage({ site, issues: [bathingIssue] });

  assert.match(html, /data-categories="behavior,refusing-help"/);
  assert.doesNotMatch(html, /data-categories="basics"/);
});

test("renderHomePage links starting points directly into search instead of another chooser", () => {
  const html = renderHomePage({ site, issues: [issue] });

  assert.match(html, /href="search\/\?path=basics"/);
  assert.match(html, /href="search\/\?path=behavior"/);
  assert.match(html, /href="search\/\?path=diagnosis-planning"/);
  assert.match(html, /href="search\/"[^>]*>Search all care questions/);
  assert.doesNotMatch(html, /href="start-here\/#behaviors"/);
});

test("renderHomePage can render localized shells with language buttons and hreflang", () => {
  const html = renderHomePage({ site, issues: [issue], locale: "es" });

  assert.match(html, /<html lang="es">/);
  assert.match(html, /class="language-switcher"/);
  assert.match(html, /Español/);
  assert.match(html, /href="\.\.\/ru\/"/);
  assert.match(html, /hreflang="ru"/);
  assert.doesNotMatch(html, /Traducido automáticamente del inglés/);
});

test("renderIssuePage wraps the YouTube banner image in a stable media box", () => {
  const html = renderIssuePage({ site, issue, previousIssue: null, nextIssue: null });

  assert.match(
    html,
    /<a class="article-youtube-link"[^>]*>[\s\S]*<span class="article-youtube-media">[\s\S]*<img[^>]+straight-talk-with-dr-erik-banner\.jpg/
  );
});

test("renderTopicPage creates an answer-focused topic page with FAQ schema", () => {
  const html = renderTopicPage({ site, topic, issues: [issue] });

  assert.match(html, /Hearing Loss and Dementia/);
  assert.match(html, /Untreated hearing loss is associated/);
  assert.match(html, /Why Does Eating Become So Hard in Dementia/);
  assert.match(html, /FAQPage/);
  assert.match(html, /BreadcrumbList/);
});

test("renderSubscribePage creates a publication subscription hub with feed links", () => {
  const html = renderSubscribePage({ site, issues: [issue] });

  assert.match(html, /Subscribe on LinkedIn/);
  assert.match(html, /RSS feed/);
  assert.match(html, /JSON feed/);
  assert.match(html, /Feed reader links/);
  assert.match(html, /Open RSS feed/);
  assert.match(html, /Open JSON feed/);
  assert.match(html, /href="..\/feed.xml"/);
  assert.match(html, /href="..\/feed.json"/);
  assert.match(html, /Latest edition/);
});

test("renderStartHerePage creates direct search starting points", () => {
  const html = renderStartHerePage({ site, issues: [issue], topics: [topic] });

  assert.match(html, /Start here/);
  assert.match(html, /What do you need help with today/);
  assert.match(html, /href="..\/search\/\?path=basics"/);
  assert.match(html, /href="..\/search\/\?path=behavior"/);
  assert.match(html, /href="..\/search\/\?path=caregiver-support"/);
  assert.doesNotMatch(html, /id="behaviors" class="path-card"/);
});

test("renderSearchPage creates question-first search results with relevant snippets", () => {
  const showerIssue = {
    ...issue,
    title: "Why Does My Loved One With Dementia Refuse to Shower?",
    slug: "why-does-my-loved-one-with-dementia-refuse-to-shower-and-what-can-i-actually-do-about-it",
    excerpt: "A practical guide to shower refusal.",
    topics: ["Behavior", "Caregiving"],
    sections: [
      { type: "heading", text: "When showering feels threatening" },
      {
        type: "paragraph",
        text: "A person with dementia may refuse to shower because water, mirrors, noise, or loss of privacy feels frightening."
      },
      { type: "list", items: ["Warm the room first", "Offer choices", "Avoid arguing about hygiene"] }
    ]
  };
  const behaviorTopic = {
    ...topic,
    title: "Dementia Behaviors and Communication",
    slug: "dementia-behaviors-and-communication",
    issueSlugs: [showerIssue.slug]
  };
  const html = renderSearchPage({ site, issues: [showerIssue, issue], topics: [behaviorTopic] });

  assert.match(html, /data-search-page/);
  assert.match(html, /Most asked questions/);
  assert.match(html, /How do I get Mom to shower/);
  assert.match(html, /data-search-question[^>]+data-path="refusing-help"/);
  assert.match(html, /A person with dementia may refuse to shower because water/);
  assert.match(html, /Read full answer/);
  assert.match(html, /View trusted sources/);
  assert.match(html, /href="..\/topics\/dementia-behaviors-and-communication\/#sources"/);
  assert.match(html, /Best matching section/);
  assert.match(html, /When showering feels threatening/);
  assert.match(html, /refuse to shower because water/);
  assert.match(html, /href="..\/issues\/why-does-my-loved-one-with-dementia-refuse-to-shower-and-what-can-i-actually-do-about-it\/"/);
  assert.match(html, /Read full article/);
  assert.match(html, /View original source/);
  assert.match(html, /href="https:\/\/www.linkedin.com\/pulse\/example"/);
  assert.match(html, /data-selected-topic-title/);
  assert.match(html, /data-selected-topic-copy/);
  assert.match(html, /data-selected-questions-title/);
  assert.match(html, /data-selected-results-title/);
  assert.match(html, /data-search-index/);
  assert.doesNotMatch(html, /data-search="/);
});

test("renderTopicPage exposes a stable sources anchor for direct search journeys", () => {
  const html = renderTopicPage({ site, topic, issues: [issue] });

  assert.match(html, /<section class="topic-section" id="sources"><h2>Sources<\/h2>/);
});

test("renderSearchPage localizes direct answer and source actions", () => {
  const html = renderSearchPage({ site, issues: [issue], topics: [topic], locale: "es" });

  assert.match(html, /Leer la respuesta completa/);
  assert.match(html, /Leer el artículo completo/);
  assert.match(html, /Ver fuente original/);
  assert.match(html, /data-selected-topic-title/);
});

test("renderSearchPage localizes shell metadata and keeps search parameters switchable", () => {
  const html = renderSearchPage({ site, issues: [issue], topics: [topic], locale: "ru" });

  assert.match(html, /<html lang="ru">/);
  assert.match(html, /href="..\/..\/search\/"/);
  assert.match(html, /href="..\/..\/es\/search\/"/);
  assert.match(html, /Русский/);
  assert.match(html, /hreflang="es"/);
  assert.doesNotMatch(html, /Автоматический перевод/);
});

test("renderTopicIndexPage lists topic pages", () => {
  const html = renderTopicIndexPage({
    site,
    topics: [{ title: "Hearing Loss and Dementia", slug: "hearing-loss-and-dementia", description: "Topic summary." }]
  });

  assert.match(html, /Topic Guides/);
  assert.match(html, /href="..\/topics\/hearing-loss-and-dementia\/"/);
});

test("renderGlossaryPage defines plain-language dementia terms", () => {
  const html = renderGlossaryPage({ site });

  assert.match(html, /Dementia care words, explained simply/);
  assert.match(html, /Delirium/);
  assert.match(html, /GUIDE Model/);
  assert.match(html, /DefinedTermSet/);
});

test("renderAuthorPage exposes Dr. Erik author trust signals", () => {
  const html = renderAuthorPage({ site, issues: [issue] });

  assert.match(html, /Dr. Erik Ilyayev, MD/);
  assert.match(html, /CEO, MedBetter Health/);
  assert.match(html, /Person/);
  assert.match(html, /Why Does Eating Become So Hard in Dementia/);
});
