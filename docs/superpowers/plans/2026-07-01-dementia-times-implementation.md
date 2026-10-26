# The Dementia Times Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages newsletter archive for The Dementia Times with real LinkedIn newsletter content/images and a daily noon Eastern sync.

**Architecture:** Use a small Node.js static generator that reads structured JSON issue files and writes `dist/` HTML/CSS/JS. Use Playwright only for LinkedIn discovery/extraction in the sync script. GitHub Actions runs tests, imports new issues, commits content/assets when needed, builds, and deploys to GitHub Pages.

**Tech Stack:** Node.js 20 ESM, built-in `node:test`, Playwright for LinkedIn scraping, GitHub Actions, static HTML/CSS/JS, GitHub Pages.

---

## File Structure

- Create `package.json`: npm scripts and the Playwright dependency.
- Create `README.md`: local development, sync, GitHub Pages, and secret setup instructions.
- Create `content/site.json`: brand links, author metadata, newsletter URL, and homepage copy.
- Create `content/issues/`: imported issue JSON files.
- Create `public/assets/brand/`: copied Dr. Erik headshot, MedBetter logo, and YouTube banner.
- Create `public/assets/issues/`: downloaded LinkedIn issue covers and inline images.
- Create `src/lib/slug.js`: deterministic slug generation.
- Create `src/lib/content.js`: load, validate, and sort issue JSON.
- Create `src/lib/render.js`: shared HTML escaping, page shell, issue rendering, and homepage rendering.
- Create `src/lib/linkedin-extract.js`: pure extraction helpers for newsletter/article DOM data.
- Create `src/lib/image-download.js`: image URL normalization and local image download.
- Create `src/styles/site.css`: approved editorial visual system.
- Create `src/client/archive-filter.js`: homepage search/filter behavior.
- Create `scripts/build-site.js`: generate `dist/`.
- Create `scripts/sync-linkedin.js`: discover and import LinkedIn issues.
- Create `scripts/serve.js`: local static server for QA.
- Create `.github/workflows/pages.yml`: test, sync, commit, build, and deploy.
- Create `tests/*.test.js`: parser, content, generator, and image path tests.
- Create `tests/fixtures/`: minimal LinkedIn-like HTML and issue JSON fixtures.

---

### Task 1: Project Scaffold And Brand Assets

**Files:**
- Create: `package.json`
- Create: `README.md`
- Create: `content/site.json`
- Create directory: `content/issues/`
- Create directory: `public/assets/brand/`
- Copy assets into: `public/assets/brand/`

- [ ] **Step 1: Create package metadata**

Create `package.json`:

```json
{
  "name": "the-dementia-times",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node scripts/build-site.js",
    "dev": "node scripts/serve.js",
    "sync": "node scripts/sync-linkedin.js",
    "test": "node --test",
    "check": "npm run test && npm run build"
  },
  "dependencies": {
    "playwright": "^1.54.0"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Create site configuration**

Create `content/site.json`:

```json
{
  "siteUrl": "https://thedementiatimes.com",
  "title": "The Dementia Times",
  "presentedBy": "Dr. Erik Ilyayev presents",
  "description": "Evidence-based insights on dementia care from Dr. Erik Ilyayev.",
  "newsletterUrl": "https://www.linkedin.com/newsletters/the-dementia-times-7452443336956899329/",
  "author": {
    "name": "Dr. Erik Ilyayev, MD",
    "role": "CEO, MedBetter Health",
    "linkedinUrl": "https://www.linkedin.com/in/erik-ilyayev-b9795084/",
    "headshot": "/assets/brand/dr-erik-headshot.jpeg"
  },
  "brand": {
    "medBetterUrl": "https://medbetterhealth.org",
    "logo": "/assets/brand/medbetter-health-logo.png",
    "youtubeUrl": "https://www.youtube.com/@ErikIlyayev",
    "youtubeBanner": "/assets/brand/straight-talk-with-dr-erik-banner.jpg"
  },
  "guide": {
    "title": "Support for Families Navigating Dementia Care",
    "body": "MedBetter Health supports eligible families in Florida and New York through Medicare's GUIDE Model with structured dementia-care support for patients and caregivers.",
    "url": "https://medbetterhealth.org/guide"
  }
}
```

- [ ] **Step 3: Copy provided image assets**

Run:

```bash
mkdir -p public/assets/brand content/issues public/assets/issues
cp "/Users/rognor/Documents/medbetterhealth/images re/Dr.Erik Headshot.jpeg" public/assets/brand/dr-erik-headshot.jpeg
cp "/Users/rognor/Documents/medbetterhealth/images re/channels4_banner.jpg" public/assets/brand/straight-talk-with-dr-erik-banner.jpg
cp "/Users/rognor/Documents/medbetterhealth/images re/MedBetter Health4-02.png" public/assets/brand/medbetter-health-logo.png
```

Expected: all three brand files exist under `public/assets/brand/`.

- [ ] **Step 4: Create README**

Create `README.md`:

```markdown
# The Dementia Times

Static newsletter archive for `thedementiatimes.com`.

## Local Commands

- `npm install`
- `npm run sync` imports new LinkedIn newsletter issues.
- `npm run build` writes the static site to `dist/`.
- `npm run dev` serves `dist/` locally after a build.
- `npm test` runs parser and generator tests.

## Content

Issues live in `content/issues/*.json`. Imported images live in `public/assets/issues/<slug>/`.

The site renders real LinkedIn newsletter images copied into the repository. It does not hotlink LinkedIn media.

## LinkedIn Automation

GitHub Actions checks for new LinkedIn editions at noon Eastern. If public LinkedIn content is blocked, add a repository secret named `LINKEDIN_STORAGE_STATE` containing a Playwright storage state JSON string for a logged-in LinkedIn session.

If LinkedIn blocks a run or the secret expires, the workflow leaves the current published site unchanged.
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
test -f package.json
test -f content/site.json
test -f public/assets/brand/dr-erik-headshot.jpeg
test -f public/assets/brand/straight-talk-with-dr-erik-banner.jpg
test -f public/assets/brand/medbetter-health-logo.png
```

Expected: command exits `0`.

- [ ] **Step 6: Commit scaffold**

Run:

```bash
git add package.json README.md content/site.json public/assets/brand
git commit -m "chore: scaffold static newsletter site"
```

---

### Task 2: Core Content Utilities

**Files:**
- Create: `src/lib/slug.js`
- Create: `src/lib/content.js`
- Create: `tests/slug.test.js`
- Create: `tests/content.test.js`
- Create: `tests/fixtures/sample-issue.json`

- [ ] **Step 1: Write failing slug tests**

Create `tests/slug.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { slugifyTitle } from "../src/lib/slug.js";

test("slugifyTitle creates stable lowercase URL slugs", () => {
  assert.equal(
    slugifyTitle("Why Does Eating Become So Hard in Dementia?"),
    "why-does-eating-become-so-hard-in-dementia"
  );
});

test("slugifyTitle removes punctuation and collapses repeated separators", () => {
  assert.equal(
    slugifyTitle("The 4PM Reset: Preventing the Dementia Sundowning Spiral Before It Starts"),
    "the-4pm-reset-preventing-the-dementia-sundowning-spiral-before-it-starts"
  );
});
```

- [ ] **Step 2: Run slug tests to verify failure**

Run:

```bash
npm test -- tests/slug.test.js
```

Expected: FAIL with module not found for `src/lib/slug.js`.

- [ ] **Step 3: Implement slug utility**

Create `src/lib/slug.js`:

```js
export function slugifyTitle(title) {
  return String(title)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
```

- [ ] **Step 4: Run slug tests to verify pass**

Run:

```bash
npm test -- tests/slug.test.js
```

Expected: PASS.

- [ ] **Step 5: Write failing content tests**

Create `tests/fixtures/sample-issue.json`:

```json
{
  "title": "Why Does Eating Become So Hard in Dementia?",
  "slug": "why-does-eating-become-so-hard-in-dementia",
  "issueNumber": "41",
  "publishedDate": "2026-07-01",
  "sourceUrl": "https://www.linkedin.com/pulse/why-does-eating-become-so-hard-dementia-erik-ilyayev-x1u7e",
  "author": "Dr. Erik Ilyayev, MD",
  "excerpt": "A practical look at the hidden mechanics of eating in dementia.",
  "topics": ["Nutrition", "Caregiving", "Safety"],
  "coverImage": "/assets/issues/why-does-eating-become-so-hard-in-dementia/cover.jpg",
  "images": [
    {
      "src": "/assets/issues/why-does-eating-become-so-hard-in-dementia/slide-1.jpg",
      "alt": "LinkedIn newsletter slide"
    }
  ],
  "sections": [
    {
      "type": "heading",
      "text": "The Iceberg of Refusal"
    },
    {
      "type": "paragraph",
      "text": "Behavior is communication."
    },
    {
      "type": "image",
      "src": "/assets/issues/why-does-eating-become-so-hard-in-dementia/slide-1.jpg",
      "alt": "LinkedIn newsletter slide"
    }
  ],
  "disclaimer": "This is education, not medical advice."
}
```

Create `tests/content.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { validateIssue, sortIssuesNewestFirst, createExcerpt } from "../src/lib/content.js";

test("validateIssue accepts a complete issue object", () => {
  const issue = {
    title: "Why Does Eating Become So Hard in Dementia?",
    slug: "why-does-eating-become-so-hard-in-dementia",
    publishedDate: "2026-07-01",
    sourceUrl: "https://www.linkedin.com/pulse/example",
    author: "Dr. Erik Ilyayev, MD",
    excerpt: "A practical look at eating challenges.",
    topics: ["Nutrition"],
    coverImage: "/assets/issues/example/cover.jpg",
    images: [],
    sections: [{ type: "paragraph", text: "Body text." }]
  };

  assert.equal(validateIssue(issue).slug, issue.slug);
});

test("validateIssue rejects an issue without a local cover image path", () => {
  assert.throws(
    () =>
      validateIssue({
        title: "Missing Image",
        slug: "missing-image",
        publishedDate: "2026-07-01",
        sourceUrl: "https://www.linkedin.com/pulse/example",
        author: "Dr. Erik Ilyayev, MD",
        excerpt: "Missing cover.",
        topics: [],
        coverImage: "https://media.licdn.com/example.jpg",
        images: [],
        sections: [{ type: "paragraph", text: "Body text." }]
      }),
    /coverImage must be a local path/
  );
});

test("sortIssuesNewestFirst orders by published date descending", () => {
  const issues = [
    { title: "Older", slug: "older", publishedDate: "2026-06-01" },
    { title: "Newer", slug: "newer", publishedDate: "2026-07-01" }
  ];

  assert.deepEqual(sortIssuesNewestFirst(issues).map((issue) => issue.slug), ["newer", "older"]);
});

test("createExcerpt trims body text to sentence-friendly excerpt", () => {
  assert.equal(
    createExcerpt("One sentence. Two sentence. Three sentence.", 24),
    "One sentence. Two sentence."
  );
});
```

- [ ] **Step 6: Run content tests to verify failure**

Run:

```bash
npm test -- tests/content.test.js
```

Expected: FAIL with module not found for `src/lib/content.js`.

- [ ] **Step 7: Implement content utilities**

Create `src/lib/content.js`:

```js
import fs from "node:fs/promises";
import path from "node:path";

const requiredFields = [
  "title",
  "slug",
  "publishedDate",
  "sourceUrl",
  "author",
  "excerpt",
  "topics",
  "coverImage",
  "images",
  "sections"
];

export function validateIssue(issue) {
  for (const field of requiredFields) {
    if (!(field in issue)) {
      throw new Error(`Issue is missing required field: ${field}`);
    }
  }

  if (!issue.coverImage.startsWith("/assets/issues/")) {
    throw new Error("coverImage must be a local path under /assets/issues/");
  }

  for (const image of issue.images) {
    if (!image.src.startsWith("/assets/issues/")) {
      throw new Error(`image src must be a local path under /assets/issues/: ${image.src}`);
    }
  }

  for (const section of issue.sections) {
    if (!["heading", "paragraph", "image", "list", "quote", "callout"].includes(section.type)) {
      throw new Error(`Unsupported section type: ${section.type}`);
    }
  }

  return issue;
}

export function sortIssuesNewestFirst(issues) {
  return [...issues].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));
}

export function createExcerpt(text, maxLength = 180) {
  const cleanText = String(text).replace(/\s+/g, " ").trim();
  if (cleanText.length <= maxLength) return cleanText;
  const sliced = cleanText.slice(0, maxLength);
  const sentenceEnd = Math.max(sliced.lastIndexOf("."), sliced.lastIndexOf("?"), sliced.lastIndexOf("!"));
  if (sentenceEnd > 40) return sliced.slice(0, sentenceEnd + 1);
  return `${sliced.replace(/\s+\S*$/, "")}...`;
}

export async function loadSiteConfig(rootDir = process.cwd()) {
  const filePath = path.join(rootDir, "content/site.json");
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

export async function loadIssues(rootDir = process.cwd()) {
  const issuesDir = path.join(rootDir, "content/issues");
  const entries = await fs.readdir(issuesDir, { withFileTypes: true });
  const issues = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const issue = JSON.parse(await fs.readFile(path.join(issuesDir, entry.name), "utf8"));
    issues.push(validateIssue(issue));
  }

  return sortIssuesNewestFirst(issues);
}
```

- [ ] **Step 8: Run content tests to verify pass**

Run:

```bash
npm test -- tests/content.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit content utilities**

Run:

```bash
git add src/lib/slug.js src/lib/content.js tests/slug.test.js tests/content.test.js tests/fixtures/sample-issue.json
git commit -m "feat: add newsletter content utilities"
```

---

### Task 3: Static Rendering And Build Output

**Files:**
- Create: `src/lib/render.js`
- Create: `scripts/build-site.js`
- Create: `tests/render.test.js`
- Create: `tests/build.test.js`

- [ ] **Step 1: Write failing render tests**

Create `tests/render.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, renderIssueBody, renderIssuePage, renderHomePage } from "../src/lib/render.js";

const site = {
  title: "The Dementia Times",
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
    medBetterUrl: "https://medbetterhealth.org",
    logo: "/assets/brand/medbetter-health-logo.png",
    youtubeUrl: "https://www.youtube.com/@ErikIlyayev",
    youtubeBanner: "/assets/brand/straight-talk-with-dr-erik-banner.jpg"
  },
  guide: {
    title: "Support for Families Navigating Dementia Care",
    body: "MedBetter Health supports eligible families.",
    url: "https://medbetterhealth.org/guide"
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
  images: [{ src: "/assets/issues/example/slide-1.jpg", alt: "Slide 1" }],
  sections: [
    { type: "heading", text: "The Iceberg of Refusal" },
    { type: "paragraph", text: "Behavior is communication." },
    { type: "image", src: "/assets/issues/example/slide-1.jpg", alt: "Slide 1" },
    { type: "list", items: ["Reduce background noise", "Face the person directly"] }
  ],
  disclaimer: "This is education, not medical advice."
};

test("escapeHtml escapes text for safe rendering", () => {
  assert.equal(escapeHtml("<script>alert('x')</script>"), "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
});

test("renderIssueBody renders headings, paragraphs, images, lists, and disclaimer", () => {
  const html = renderIssueBody(issue);
  assert.match(html, /The Iceberg of Refusal/);
  assert.match(html, /Behavior is communication/);
  assert.match(html, /src="\/assets\/issues\/example\/slide-1.jpg"/);
  assert.match(html, /Reduce background noise/);
  assert.match(html, /This is education, not medical advice/);
});

test("renderIssuePage includes source link and author link", () => {
  const html = renderIssuePage({ site, issue, previousIssue: null, nextIssue: null });
  assert.match(html, /Why Does Eating Become So Hard in Dementia/);
  assert.match(html, /View original on LinkedIn/);
  assert.match(html, /https:\/\/www.linkedin.com\/in\/erik-ilyayev-b9795084\//);
});

test("renderHomePage includes masthead, latest issue, archive, and YouTube banner", () => {
  const html = renderHomePage({ site, issues: [issue] });
  assert.match(html, /Dr. Erik Ilyayev presents/);
  assert.match(html, /The Dementia Times/);
  assert.match(html, /data-archive-search/);
  assert.match(html, /straight-talk-with-dr-erik-banner.jpg/);
});
```

- [ ] **Step 2: Run render tests to verify failure**

Run:

```bash
npm test -- tests/render.test.js
```

Expected: FAIL with module not found for `src/lib/render.js`.

- [ ] **Step 3: Implement renderer**

Create `src/lib/render.js` with these exported functions: `escapeHtml(value)`, `renderIssueBody(issue)`, `renderIssuePage({ site, issue, previousIssue, nextIssue })`, and `renderHomePage({ site, issues })`.

Implementation requirements:

```js
export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function issueUrl(issue) {
  return `/issues/${escapeHtml(issue.slug)}/`;
}
```

The renderer must output:

- A shared page shell with `<link rel="stylesheet" href="/styles/site.css">`.
- Homepage masthead text exactly as `Dr. Erik Ilyayev presents` and `The Dementia Times`.
- Header logo image linking to MedBetter.
- Author headshot/name linking to Dr. Erik's LinkedIn.
- Homepage archive rows with `data-title`, `data-topics`, and `data-date` attributes.
- Article pages with real local `coverImage` and inline image paths.
- Source links labelled `View original on LinkedIn`.
- YouTube banner linking to `https://www.youtube.com/@ErikIlyayev`.
- Previous/next issue navigation.

- [ ] **Step 4: Run render tests to verify pass**

Run:

```bash
npm test -- tests/render.test.js
```

Expected: PASS.

- [ ] **Step 5: Write failing build test**

Create `tests/build.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildSite } from "../scripts/build-site.js";

test("buildSite writes homepage and article pages", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-build-"));
  await fs.mkdir(path.join(root, "content/issues"), { recursive: true });
  await fs.mkdir(path.join(root, "public/assets/brand"), { recursive: true });
  await fs.writeFile(
    path.join(root, "content/site.json"),
    JSON.stringify({
      title: "The Dementia Times",
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
        medBetterUrl: "https://medbetterhealth.org",
        logo: "/assets/brand/medbetter-health-logo.png",
        youtubeUrl: "https://www.youtube.com/@ErikIlyayev",
        youtubeBanner: "/assets/brand/straight-talk-with-dr-erik-banner.jpg"
      },
      guide: {
        title: "Support for Families Navigating Dementia Care",
        body: "MedBetter Health supports eligible families.",
        url: "https://medbetterhealth.org/guide"
      }
    })
  );
  await fs.writeFile(
    path.join(root, "content/issues/example.json"),
    JSON.stringify({
      title: "Example Issue",
      slug: "example-issue",
      issueNumber: "1",
      publishedDate: "2026-07-01",
      sourceUrl: "https://www.linkedin.com/pulse/example",
      author: "Dr. Erik Ilyayev, MD",
      excerpt: "Example excerpt.",
      topics: ["Caregiving"],
      coverImage: "/assets/issues/example-issue/cover.jpg",
      images: [],
      sections: [{ type: "paragraph", text: "Example body." }]
    })
  );

  await buildSite(root);

  assert.match(await fs.readFile(path.join(root, "dist/index.html"), "utf8"), /Example Issue/);
  assert.match(await fs.readFile(path.join(root, "dist/issues/example-issue/index.html"), "utf8"), /Example body/);
});
```

- [ ] **Step 6: Run build test to verify failure**

Run:

```bash
npm test -- tests/build.test.js
```

Expected: FAIL with module not found or missing `buildSite`.

- [ ] **Step 7: Implement build script**

Create `scripts/build-site.js` exporting `buildSite(rootDir = process.cwd())`.

Implementation requirements:

```js
import fs from "node:fs/promises";
import path from "node:path";
import { loadIssues, loadSiteConfig } from "../src/lib/content.js";
import { renderHomePage, renderIssuePage } from "../src/lib/render.js";
```

The script must:

- Remove and recreate `dist/`.
- Copy `public/` into `dist/`.
- Copy `src/styles/site.css` to `dist/styles/site.css`.
- Copy `src/client/archive-filter.js` to `dist/client/archive-filter.js`.
- Write `dist/index.html`.
- Write `dist/issues/<slug>/index.html` for each issue.
- Use issue order from `loadIssues()`.
- Run `buildSite()` when executed directly.

- [ ] **Step 8: Run build test to verify pass**

Run:

```bash
npm test -- tests/build.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit renderer and build script**

Run:

```bash
git add src/lib/render.js scripts/build-site.js tests/render.test.js tests/build.test.js
git commit -m "feat: render static newsletter pages"
```

---

### Task 4: Editorial Styles And Archive Filtering

**Files:**
- Create: `src/styles/site.css`
- Create: `src/client/archive-filter.js`
- Create: `scripts/serve.js`
- Modify: `src/lib/render.js`
- Test: `tests/render.test.js`

- [ ] **Step 1: Extend render test for archive controls**

Update `tests/render.test.js` with:

```js
test("renderHomePage exposes archive search and topic filter controls", () => {
  const html = renderHomePage({ site, issues: [issue] });
  assert.match(html, /type="search"/);
  assert.match(html, /data-archive-search/);
  assert.match(html, /data-topic-filter/);
  assert.match(html, /Nutrition/);
});
```

- [ ] **Step 2: Run render test to verify failure**

Run:

```bash
npm test -- tests/render.test.js
```

Expected: FAIL if topic filter controls are not present.

- [ ] **Step 3: Update renderer for filter controls**

Modify `renderHomePage` so it renders:

```html
<section class="archive-tools" aria-label="Archive filters">
  <input data-archive-search type="search" placeholder="Search the archive" aria-label="Search the archive">
  <select data-topic-filter aria-label="Filter by topic">
    <option value="">All topics</option>
  </select>
</section>
```

Populate the select options from unique issue topics.

- [ ] **Step 4: Run render test to verify pass**

Run:

```bash
npm test -- tests/render.test.js
```

Expected: PASS.

- [ ] **Step 5: Add editorial CSS**

Create `src/styles/site.css` with the approved visual system:

```css
:root {
  --paper: #f4f1ec;
  --surface: #fdfcf9;
  --navy: #1c2b3a;
  --text: #3d3d3d;
  --gold: #c4933f;
  --divider: #e0dad0;
  --guide: #3a7d44;
  --red: #c9302c;
  --max: 1180px;
  --reading: 760px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--paper);
  color: var(--text);
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.65;
}

a { color: inherit; }

img { max-width: 100%; height: auto; display: block; }

.site-shell {
  max-width: var(--max);
  margin: 0 auto;
  background: var(--surface);
  min-height: 100vh;
  box-shadow: 0 0 0 1px rgba(28, 43, 58, 0.08);
}

.topbar,
.archive-tools,
.issue-meta,
.utility-text,
button,
input,
select {
  font-family: Arial, sans-serif;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px 28px;
  border-bottom: 1px solid var(--divider);
}

.brand-logo { width: min(240px, 42vw); }

.author-link {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--navy);
}

.author-link img {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center top;
  border: 2px solid var(--gold);
}

.masthead {
  text-align: center;
  padding: 24px 28px 18px;
  border-bottom: 4px double var(--navy);
}

.presented-by {
  margin: 0 0 8px;
  color: var(--gold);
  font-family: Arial, sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
}

.masthead h1 {
  margin: 0;
  color: var(--navy);
  font-size: clamp(3.2rem, 8vw, 6.4rem);
  line-height: 0.92;
}

.dek {
  margin: 12px auto 0;
  max-width: 760px;
  color: #536272;
  font-family: Arial, sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
  gap: 28px;
  padding: 28px;
}

.latest-card {
  border-right: 1px solid var(--divider);
  padding-right: 28px;
}

.latest-card img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: 1px solid var(--navy);
}

.kicker {
  margin: 18px 0 8px;
  color: var(--gold);
  font-family: Arial, sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  font-weight: 700;
}

.latest-card h2,
.article-header h1 {
  color: var(--navy);
  line-height: 1.05;
}

.latest-card h2 { font-size: clamp(2rem, 5vw, 3.8rem); margin: 0; }

.button-link {
  display: inline-flex;
  align-items: center;
  margin-top: 16px;
  background: var(--navy);
  color: #fff;
  text-decoration: none;
  padding: 11px 16px;
  border-radius: 4px;
  font-family: Arial, sans-serif;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

.recent-list,
.archive-list {
  display: grid;
  gap: 0;
}

.recent-item,
.archive-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--divider);
}

.recent-item a,
.archive-item a {
  color: var(--navy);
  text-decoration: none;
}

.archive-section {
  padding: 8px 28px 34px;
}

.archive-tools {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 12px;
  margin: 18px 0;
}

.archive-tools input,
.archive-tools select {
  width: 100%;
  border: 1px solid var(--divider);
  background: #fff;
  color: var(--navy);
  padding: 12px;
  font-size: 0.9rem;
  border-radius: 4px;
}

.guide-box {
  margin-top: 22px;
  background: #ebf4ee;
  color: #2d4a30;
  border: 1px solid #7db88a;
  border-left: 5px solid var(--guide);
  padding: 18px;
  font-family: Arial, sans-serif;
}

.youtube-banner {
  margin-top: 20px;
  border: 1px solid var(--divider);
  background: #fff;
}

.article {
  max-width: var(--reading);
  margin: 0 auto;
  padding: 32px 24px 56px;
}

.article-header {
  border-bottom: 1px solid var(--divider);
  margin-bottom: 24px;
  padding-bottom: 20px;
}

.article-header h1 {
  margin: 8px 0 16px;
  font-size: clamp(2.3rem, 6vw, 4.2rem);
}

.article-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border: 1px solid var(--navy);
  margin: 24px 0;
}

.article-body h2 {
  margin-top: 34px;
  color: var(--navy);
  font-size: 1.75rem;
  line-height: 1.2;
}

.article-body p,
.article-body li {
  font-size: 1.08rem;
}

.article-body figure {
  margin: 28px 0;
}

.article-body figure img {
  border: 1px solid var(--divider);
  background: #fff;
}

.disclaimer {
  margin-top: 32px;
  color: #66727d;
  font-family: Arial, sans-serif;
  font-size: 0.86rem;
  border-top: 1px solid var(--divider);
  padding-top: 16px;
}

.issue-nav {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  border-top: 1px solid var(--divider);
  margin-top: 28px;
  padding-top: 18px;
}

@media (max-width: 760px) {
  .topbar,
  .home-grid,
  .archive-tools {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .home-grid {
    display: block;
    padding: 20px;
  }

  .latest-card {
    border-right: 0;
    border-bottom: 1px solid var(--divider);
    padding-right: 0;
    padding-bottom: 22px;
    margin-bottom: 22px;
  }

  .archive-section { padding: 0 20px 28px; }

  .issue-nav { flex-direction: column; }
}
```

- [ ] **Step 6: Add archive filter JavaScript**

Create `src/client/archive-filter.js`:

```js
const searchInput = document.querySelector("[data-archive-search]");
const topicSelect = document.querySelector("[data-topic-filter]");
const rows = Array.from(document.querySelectorAll("[data-archive-item]"));

function applyArchiveFilters() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const topic = (topicSelect?.value || "").trim().toLowerCase();

  for (const row of rows) {
    const title = row.dataset.title || "";
    const topics = row.dataset.topics || "";
    const textMatches = !query || title.includes(query) || topics.includes(query);
    const topicMatches = !topic || topics.split(",").map((value) => value.trim()).includes(topic);
    row.hidden = !(textMatches && topicMatches);
  }
}

searchInput?.addEventListener("input", applyArchiveFilters);
topicSelect?.addEventListener("change", applyArchiveFilters);
```

- [ ] **Step 7: Add local static server**

Create `scripts/serve.js`:

```js
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(root, safePath);
  if (url.pathname.endsWith("/")) filePath = path.join(filePath, "index.html");

  try {
    const data = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Serving http://localhost:${port}`);
});
```

- [ ] **Step 8: Build the styled site**

Run:

```bash
npm run build
```

Expected: `dist/index.html`, `dist/styles/site.css`, and `dist/client/archive-filter.js` exist.

- [ ] **Step 9: Commit UI styles and filter**

Run:

```bash
git add src/styles/site.css src/client/archive-filter.js scripts/serve.js src/lib/render.js tests/render.test.js
git commit -m "feat: add editorial archive interface"
```

---

### Task 5: LinkedIn Extraction And Image Downloading

**Files:**
- Create: `src/lib/linkedin-extract.js`
- Create: `src/lib/image-download.js`
- Create: `tests/linkedin-extract.test.js`
- Create: `tests/image-download.test.js`
- Create: `tests/fixtures/linkedin-article.html`
- Create: `tests/fixtures/linkedin-newsletter.html`

- [ ] **Step 1: Write failing LinkedIn extraction tests**

Create `tests/fixtures/linkedin-newsletter.html`:

```html
<main>
  <a href="https://www.linkedin.com/pulse/why-does-eating-become-so-hard-dementia-erik-ilyayev-x1u7e">Why Does Eating Become So Hard in Dementia?</a>
  <a href="/pulse/4pm-reset-preventing-dementia-sundowning-spiral-before-erik-ilyayev-mrp4e">The 4PM Reset</a>
</main>
```

Create `tests/fixtures/linkedin-article.html`:

```html
<article>
  <h1>Why Does Eating Become So Hard in Dementia?</h1>
  <h6>Published on Jul 1, 2026</h6>
  <figure><img src="https://media.licdn.com/cover.jpg" alt="Article cover image"></figure>
  <p>ISSUE NO. 41 · DEMENTIA, MEALTIMES, AND THE HIDDEN MECHANICS OF EATING</p>
  <p>Every week, caregivers ask me some version of the same question:</p>
  <p>THE ICEBERG OF REFUSAL</p>
  <p>Behavior is communication.</p>
  <figure><img src="https://media.licdn.com/slide-1.jpg" alt="Slide one"></figure>
  <p>This is education, not medical advice.</p>
</article>
```

Create `tests/linkedin-extract.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { discoverArticleUrls, extractArticleFromHtml } from "../src/lib/linkedin-extract.js";

test("discoverArticleUrls finds LinkedIn pulse URLs from newsletter HTML", async () => {
  const html = await fs.readFile("tests/fixtures/linkedin-newsletter.html", "utf8");
  assert.deepEqual(discoverArticleUrls(html), [
    "https://www.linkedin.com/pulse/why-does-eating-become-so-hard-dementia-erik-ilyayev-x1u7e",
    "https://www.linkedin.com/pulse/4pm-reset-preventing-dementia-sundowning-spiral-before-erik-ilyayev-mrp4e"
  ]);
});

test("extractArticleFromHtml extracts article metadata, body sections, and images", async () => {
  const html = await fs.readFile("tests/fixtures/linkedin-article.html", "utf8");
  const article = extractArticleFromHtml(html, "https://www.linkedin.com/pulse/example");

  assert.equal(article.title, "Why Does Eating Become So Hard in Dementia?");
  assert.equal(article.issueNumber, "41");
  assert.equal(article.publishedDate, "2026-07-01");
  assert.equal(article.remoteImages[0].url, "https://media.licdn.com/cover.jpg");
  assert.equal(article.remoteImages[1].url, "https://media.licdn.com/slide-1.jpg");
  assert.deepEqual(article.sections.map((section) => section.type), ["heading", "paragraph", "image", "paragraph"]);
});
```

- [ ] **Step 2: Run LinkedIn extraction tests to verify failure**

Run:

```bash
npm test -- tests/linkedin-extract.test.js
```

Expected: FAIL with module not found for `src/lib/linkedin-extract.js`.

- [ ] **Step 3: Implement LinkedIn extraction helpers**

Create `src/lib/linkedin-extract.js`.

Implementation requirements:

```js
export function discoverArticleUrls(html) {
  const urls = new Set();
  const hrefPattern = /href=["']([^"']*\/pulse\/[^"']+)["']/g;
  let match;
  while ((match = hrefPattern.exec(html))) {
    const url = match[1].startsWith("http") ? match[1] : `https://www.linkedin.com${match[1]}`;
    urls.add(url.split("?")[0]);
  }
  return [...urls];
}
```

`extractArticleFromHtml(html, sourceUrl)` must:

- Extract the first `<h1>` as `title`.
- Extract a date from text matching `Published on Mon D, YYYY`.
- Convert the date to `YYYY-MM-DD`.
- Extract `ISSUE NO. 41` as `issueNumber`.
- Treat all-caps paragraph text with at least 10 letters as a `heading`.
- Treat normal paragraphs as `paragraph`.
- Treat each `<figure><img>` as a remote image; first image is cover.
- Insert `image` sections for inline images after the cover.
- Return `{ title, slug, issueNumber, publishedDate, sourceUrl, author, excerpt, topics, remoteImages, sections, disclaimer }`.
- Use `slugifyTitle(title)` and `createExcerpt()`.

- [ ] **Step 4: Run LinkedIn extraction tests to verify pass**

Run:

```bash
npm test -- tests/linkedin-extract.test.js
```

Expected: PASS.

- [ ] **Step 5: Write failing image download tests**

Create `tests/image-download.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { imageExtensionFromContentType, localIssueImagePath, remoteImageToLocalMetadata } from "../src/lib/image-download.js";

test("imageExtensionFromContentType maps supported image content types", () => {
  assert.equal(imageExtensionFromContentType("image/jpeg"), ".jpg");
  assert.equal(imageExtensionFromContentType("image/png"), ".png");
  assert.equal(imageExtensionFromContentType("image/webp"), ".webp");
});

test("localIssueImagePath creates cover and slide paths", () => {
  assert.equal(localIssueImagePath("example-issue", 0, ".jpg"), "public/assets/issues/example-issue/cover.jpg");
  assert.equal(localIssueImagePath("example-issue", 2, ".png"), "public/assets/issues/example-issue/image-2.png");
});

test("remoteImageToLocalMetadata returns public paths for issue JSON", () => {
  assert.deepEqual(remoteImageToLocalMetadata("example-issue", 1, ".jpg", "Slide one"), {
    src: "/assets/issues/example-issue/image-1.jpg",
    alt: "Slide one"
  });
});
```

- [ ] **Step 6: Run image download tests to verify failure**

Run:

```bash
npm test -- tests/image-download.test.js
```

Expected: FAIL with module not found for `src/lib/image-download.js`.

- [ ] **Step 7: Implement image download helpers**

Create `src/lib/image-download.js` exporting:

- `imageExtensionFromContentType(contentType)`
- `localIssueImagePath(slug, index, extension)`
- `remoteImageToLocalMetadata(slug, index, extension, alt)`
- `downloadIssueImages({ rootDir, slug, remoteImages, fetchImpl = fetch })`

`downloadIssueImages` must:

- Download each remote image.
- Determine extension from response `content-type`.
- Write files under `public/assets/issues/<slug>/`.
- Return `{ coverImage, images }` with public `/assets/issues/...` paths.
- Throw an error if any response is not ok or content type is not JPEG, PNG, or WebP.

- [ ] **Step 8: Run image download tests to verify pass**

Run:

```bash
npm test -- tests/image-download.test.js
```

Expected: PASS.

- [ ] **Step 9: Commit scraper helper modules**

Run:

```bash
git add src/lib/linkedin-extract.js src/lib/image-download.js tests/linkedin-extract.test.js tests/image-download.test.js tests/fixtures/linkedin-article.html tests/fixtures/linkedin-newsletter.html
git commit -m "feat: extract linkedin newsletter content"
```

---

### Task 6: LinkedIn Sync Script

**Files:**
- Create: `scripts/sync-linkedin.js`
- Modify: `package.json`
- Test: `tests/sync.test.js`

- [ ] **Step 1: Write failing sync test for duplicate detection**

Create `tests/sync.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { articleAlreadyImported, writeImportedIssue } from "../scripts/sync-linkedin.js";

test("articleAlreadyImported detects existing sourceUrl", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-sync-"));
  await fs.mkdir(path.join(root, "content/issues"), { recursive: true });
  await fs.writeFile(
    path.join(root, "content/issues/example.json"),
    JSON.stringify({ title: "Example", sourceUrl: "https://www.linkedin.com/pulse/example" })
  );

  assert.equal(await articleAlreadyImported(root, "https://www.linkedin.com/pulse/example"), true);
  assert.equal(await articleAlreadyImported(root, "https://www.linkedin.com/pulse/new"), false);
});

test("writeImportedIssue writes issue JSON with stable formatting", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tdt-sync-"));
  await writeImportedIssue(root, {
    title: "Example",
    slug: "example",
    publishedDate: "2026-07-01",
    sourceUrl: "https://www.linkedin.com/pulse/example",
    author: "Dr. Erik Ilyayev, MD",
    excerpt: "Example.",
    topics: [],
    coverImage: "/assets/issues/example/cover.jpg",
    images: [],
    sections: [{ type: "paragraph", text: "Body." }]
  });

  const text = await fs.readFile(path.join(root, "content/issues/example.json"), "utf8");
  assert.match(text, /"slug": "example"/);
  assert.match(text, /\n}\n$/);
});
```

- [ ] **Step 2: Run sync tests to verify failure**

Run:

```bash
npm test -- tests/sync.test.js
```

Expected: FAIL with missing exports from `scripts/sync-linkedin.js`.

- [ ] **Step 3: Implement sync script**

Create `scripts/sync-linkedin.js` exporting:

- `articleAlreadyImported(rootDir, sourceUrl)`
- `writeImportedIssue(rootDir, issue)`
- `syncLinkedIn({ rootDir = process.cwd(), storageStateJson = process.env.LINKEDIN_STORAGE_STATE } = {})`

Implementation requirements:

- Use `playwright.chromium.launch({ headless: true })`.
- If `storageStateJson` is present, write it to a temp file and create the browser context with that storage state.
- Visit `content/site.json` `newsletterUrl`.
- Use `page.content()` and `discoverArticleUrls()` to find article URLs.
- For each URL not already imported:
  - Open the article.
  - Extract article data with `extractArticleFromHtml(await page.content(), url)`.
  - Download images with `downloadIssueImages()`.
  - Replace `remoteImages` with local `coverImage` and `images`.
  - Save JSON with `writeImportedIssue`.
- Return `{ imported: number, skipped: number }`.
- Catch per-article extraction/download errors, log the URL, skip that article, and continue.
- Exit non-zero only when the newsletter page cannot be loaded at all.

- [ ] **Step 4: Run sync tests to verify pass**

Run:

```bash
npm test -- tests/sync.test.js
```

Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit sync script**

Run:

```bash
git add scripts/sync-linkedin.js tests/sync.test.js package.json
git commit -m "feat: add linkedin sync workflow script"
```

---

### Task 7: GitHub Pages Workflow

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

- [ ] **Step 1: Create GitHub Actions workflow**

Create `.github/workflows/pages.yml`:

```yaml
name: Sync and deploy The Dementia Times

on:
  workflow_dispatch:
  schedule:
    - cron: "0 16 * * *"
    - cron: "0 17 * * *"
  push:
    branches:
      - main

permissions:
  contents: write
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Gate scheduled runs to noon Eastern
        if: github.event_name == 'schedule'
        run: |
          hour="$(TZ=America/New_York date +%H)"
          if [ "$hour" != "12" ]; then
            echo "Not noon Eastern; exiting."
            exit 0
          fi

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browser
        run: npx playwright install --with-deps chromium

      - name: Test
        run: npm test

      - name: Sync LinkedIn newsletters
        env:
          LINKEDIN_STORAGE_STATE: ${{ secrets.LINKEDIN_STORAGE_STATE }}
        run: npm run sync

      - name: Commit imported issues
        run: |
          if [ -n "$(git status --porcelain content public/assets/issues)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add content public/assets/issues
            git commit -m "chore: import latest linkedin newsletter"
            git push
          else
            echo "No new newsletter content."
          fi

      - name: Build
        run: npm run build

      - name: Configure Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

      - name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Update README for GitHub Pages**

Append to `README.md`:

```markdown
## GitHub Pages Setup

In the GitHub repository settings:

1. Enable Pages with GitHub Actions as the source.
2. Add the custom domain `thedementiatimes.com`.
3. Add `LINKEDIN_STORAGE_STATE` as an Actions secret when logged-in LinkedIn scraping is needed.

The workflow checks for new newsletters at noon Eastern and on manual dispatch.
```

- [ ] **Step 3: Commit workflow**

Run:

```bash
git add .github/workflows/pages.yml README.md
git commit -m "ci: deploy newsletter archive to github pages"
```

---

### Task 8: Import Seed Content And Verify Site

**Files:**
- Create/modify: `content/issues/*.json`
- Create/modify: `public/assets/issues/**`
- Modify if QA requires: `src/styles/site.css`
- Modify if QA requires: `src/lib/render.js`

- [ ] **Step 1: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` exists and Playwright is installed.

- [ ] **Step 2: Run sync against LinkedIn**

Run:

```bash
npm run sync
```

Expected: new JSON files appear in `content/issues/` and real LinkedIn images appear in `public/assets/issues/`.

- [ ] **Step 3: Run tests and build**

Run:

```bash
npm run check
```

Expected: tests pass and `dist/` is generated.

- [ ] **Step 4: Start local server**

Run:

```bash
npm run dev
```

Expected: server prints `Serving http://localhost:4173`.

- [ ] **Step 5: Browser QA desktop**

Open `http://localhost:4173` and verify:

- Masthead says `Dr. Erik Ilyayev presents`.
- MedBetter logo links to `https://medbetterhealth.org`.
- Dr. Erik headshot/name links to `https://www.linkedin.com/in/erik-ilyayev-b9795084/`.
- Latest issue uses a real LinkedIn cover image.
- Archive search filters visible issue rows.
- YouTube banner links to `https://www.youtube.com/@ErikIlyayev`.

- [ ] **Step 6: Browser QA article page**

Open the latest issue page and verify:

- Article title, date, issue number, and source link render.
- Cover image and inline LinkedIn slide/deck images render from `/assets/issues/`.
- Body text is readable in a single editorial column.
- Disclaimer appears near the end when imported.
- Previous/next navigation appears when more than one issue exists.

- [ ] **Step 7: Browser QA mobile**

Resize to `390x844` and verify:

- Masthead does not overflow.
- Topbar stacks cleanly.
- Latest issue image and archive rows fit the viewport.
- Article body text and inline images do not overflow horizontally.

- [ ] **Step 8: Commit imported seed content and QA fixes**

Run:

```bash
git add package-lock.json content/issues public/assets/issues src/styles/site.css src/lib/render.js
git commit -m "chore: import initial newsletter archive"
```

---

## Self-Review

Spec coverage:

- GitHub Pages hosting is covered by Task 7.
- Daily noon Eastern sync is covered by Task 7.
- No CMS/admin is preserved by the static architecture across all tasks.
- Real LinkedIn content and local image downloads are covered by Tasks 5, 6, and 8.
- MedBetter, Dr. Erik, YouTube, and LinkedIn source links are covered by Tasks 1, 3, 4, and 8.
- Homepage archive and article pages are covered by Tasks 3 and 4.
- Tests and browser verification are covered by Tasks 2 through 8.

Placeholder scan:

- The plan has no TBD, TODO, fill-in, or "implement later" steps.
- Each task has exact files, exact commands, and expected outcomes.

Type consistency:

- Issue JSON fields match the content validator and renderer requirements.
- Scraper output fields map to `downloadIssueImages()` and then to final issue JSON.
- Script names match `package.json` scripts and workflow commands.
