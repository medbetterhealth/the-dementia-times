# Dementia Times Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every issue found in the July 6, 2026 site audit, then run a fresh audit and publish a before/after report comparing the fixed site to the baseline.

**Architecture:** Keep the site static and GitHub Pages compatible. Add repeatable audit tooling, repair media/content fidelity, tighten rendering accessibility and performance, improve AI/SEO artifacts, polish the publication experience, then verify locally and live.

**Tech Stack:** Node.js ESM, static HTML generation, native `node:test`, Playwright for rendered QA, GitHub Pages via `gh-pages`, LinkedIn browser import, YouTube public metadata sync.

---

## Baseline From July 6, 2026 Audit

Use these numbers as the comparison baseline for the final report:

- Build/test: `npm run check` passed 77 tests and rebuilt `dist/`.
- Generated site: 53 HTML pages, 42 issue pages, 42 RSS items, 42 JSON feed items.
- Static crawl: 682 local links, 0 broken local links.
- Rendered QA: no horizontal overflow on tested desktop or mobile routes.
- Live smoke: `https://thedementiatimes.com/`, `/start-here/`, `/subscribe/`, latest article, `/media-audit.json`, `/sitemap.xml`, `/robots.txt`, and `www` all returned `200`.
- Media audit: 10 issues marked `needs-review`.
- Video audit: 3 issues without companion videos: issues 33, 31, and 10.
- Sparse media: issues 1, 2, 3, 4, 5, 10, and 13 had 0 to 2 inline images.
- Image rendering: 545 rendered images lacked explicit `width` and `height`.
- Accessibility/rendering: homepage archive search and topic filter had no visible labels.
- Touch targets: nav, carousel controls, carousel dots, and several text links were under 44px high.
- Article YouTube banner link: measured as a 4px-tall clickable area before image layout was reserved.
- Homepage mobile masthead: about 690px tall before latest content.
- AI discovery: `llms.txt` listed 20 issue URLs, not all 42.
- Docs mismatch: README says GitHub Pages Actions source, workflow actually force-publishes `gh-pages`.

## File Structure

Create:

- `scripts/audit-site.js` - repeatable static audit CLI and exported audit helpers.
- `tests/audit-site.test.js` - tests for audit helper behavior and regression thresholds.
- `src/lib/image-metadata.js` - local PNG/JPEG/GIF/WebP dimension extraction helpers.
- `tests/image-metadata.test.js` - dimension parser tests with small fixture buffers.
- `docs/audits/2026-07-06-baseline.md` - human-readable copy of the baseline above.
- `docs/audits/2026-07-06-post-fix.md` - final comparison report created after fixes.

Modify:

- `package.json` - add `audit:site` script.
- `scripts/build-site.js` - improve `llms.txt`, sitemap metadata, feeds if needed, and call audit-compatible helpers.
- `scripts/sync-linkedin.js` - preserve downloaded image dimension metadata and improve image review output.
- `scripts/import-linkedin-browser-export.js` - preserve browser-imported image order/count evidence.
- `src/lib/content.js` - validate optional image dimensions and richer media metadata.
- `src/lib/image-download.js` - attach local image dimensions during import.
- `src/lib/linkedin-extract.js` - preserve source-order media blocks and reject only known non-article media.
- `src/lib/render.js` - render dimensions, labels, accessible links, richer SEO metadata, related links, and stable media containers.
- `src/client/archive-filter.js` - update result count and accessible state.
- `src/styles/site.css` - mobile masthead/header polish, touch targets, stable aspect ratios, publication styling.
- `.github/workflows/pages.yml` - run audit after checks and document noon Eastern behavior.
- `README.md` - correct GitHub Pages deployment instructions and document the audit command.
- Existing tests in `tests/*.test.js` - extend render/build/sync assertions.

Do not add a CMS, database, admin UI, or server-side runtime.

---

### Task 1: Add Repeatable Site Audit Tooling

**Files:**
- Create: `scripts/audit-site.js`
- Create: `tests/audit-site.test.js`
- Modify: `package.json`
- Create: `docs/audits/2026-07-06-baseline.md`

- [ ] **Step 1: Add the baseline audit document**

Create `docs/audits/2026-07-06-baseline.md` with the exact baseline numbers from this plan's "Baseline From July 6, 2026 Audit" section.

- [ ] **Step 2: Write failing audit helper tests**

Add tests in `tests/audit-site.test.js` for these exported functions:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAudit, classifyAudit } from "../scripts/audit-site.js";

test("summarizeAudit counts critical rendering and media defects", () => {
  const audit = {
    pages: [
      { path: "/", brokenLinks: [], brokenImages: [], missingVisibleLabels: ["search"], smallTouchTargets: ["Home"] },
      { path: "/issues/example/", brokenLinks: ["missing"], brokenImages: [], missingVisibleLabels: [], smallTouchTargets: [] }
    ],
    media: { totalIssues: 42, needsReview: 10 },
    ai: { llmsIssueLinks: 20, expectedIssueLinks: 42 },
    imagesMissingDimensions: 545
  };

  assert.deepEqual(summarizeAudit(audit), {
    pages: 2,
    brokenLinks: 1,
    brokenImages: 0,
    missingVisibleLabels: 1,
    smallTouchTargets: 1,
    mediaNeedsReview: 10,
    llmsMissingIssueLinks: 22,
    imagesMissingDimensions: 545
  });
});

test("classifyAudit fails critical regressions and passes clean output", () => {
  assert.equal(classifyAudit({ brokenLinks: 1 }).status, "fail");
  assert.equal(classifyAudit({ brokenLinks: 0, brokenImages: 0, mediaNeedsReview: 0, llmsMissingIssueLinks: 0, imagesMissingDimensions: 0 }).status, "pass");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- tests/audit-site.test.js
```

Expected: fail because `scripts/audit-site.js` does not exist yet.

- [ ] **Step 4: Implement audit helpers and CLI**

Create `scripts/audit-site.js` with exported helpers:

```js
export function summarizeAudit(audit) {
  const pages = audit.pages ?? [];
  return {
    pages: pages.length,
    brokenLinks: pages.reduce((sum, page) => sum + (page.brokenLinks?.length ?? 0), 0),
    brokenImages: pages.reduce((sum, page) => sum + (page.brokenImages?.length ?? 0), 0),
    missingVisibleLabels: pages.reduce((sum, page) => sum + (page.missingVisibleLabels?.length ?? 0), 0),
    smallTouchTargets: pages.reduce((sum, page) => sum + (page.smallTouchTargets?.length ?? 0), 0),
    mediaNeedsReview: audit.media?.needsReview ?? 0,
    llmsMissingIssueLinks: Math.max(0, (audit.ai?.expectedIssueLinks ?? 0) - (audit.ai?.llmsIssueLinks ?? 0)),
    imagesMissingDimensions: audit.imagesMissingDimensions ?? 0
  };
}

export function classifyAudit(summary) {
  const failures = [];
  if (summary.brokenLinks > 0) failures.push("broken links");
  if (summary.brokenImages > 0) failures.push("broken images");
  if (summary.mediaNeedsReview > 0) failures.push("media needs review");
  if (summary.llmsMissingIssueLinks > 0) failures.push("llms.txt missing issue links");
  if (summary.imagesMissingDimensions > 0) failures.push("images missing dimensions");
  return { status: failures.length ? "fail" : "pass", failures };
}
```

Then add the full CLI in the same file to crawl `dist/`, inspect HTML files, parse `dist/media-audit.json`, count issue URLs in `dist/llms.txt`, and write JSON to `/private/tmp/tdt-audit-current.json` by default. The CLI must print a compact summary and exit nonzero only when `--strict` is passed and `classifyAudit(summary).status === "fail"`.

- [ ] **Step 5: Add npm script**

Modify `package.json`:

```json
"audit:site": "node scripts/audit-site.js"
```

- [ ] **Step 6: Verify audit tests pass**

Run:

```bash
npm test -- tests/audit-site.test.js
```

Expected: pass.

- [ ] **Step 7: Run the audit on current build**

Run:

```bash
npm run build
npm run audit:site
```

Expected: report current baseline defects and write `/private/tmp/tdt-audit-current.json`.

- [ ] **Step 8: Commit**

```bash
git add package.json scripts/audit-site.js tests/audit-site.test.js docs/audits/2026-07-06-baseline.md
git commit -m "test: add repeatable site audit"
```

---

### Task 2: Add Local Image Dimension Metadata

**Files:**
- Create: `src/lib/image-metadata.js`
- Create: `tests/image-metadata.test.js`
- Modify: `src/lib/image-download.js`
- Modify: `src/lib/content.js`
- Modify: existing fixtures if validation requires dimensions

- [ ] **Step 1: Write dimension parser tests**

Add `tests/image-metadata.test.js` with tests for:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { imageDimensionsFromBuffer } from "../src/lib/image-metadata.js";

test("reads PNG dimensions", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000002000000030806000000f478d4fa", "hex");
  assert.deepEqual(imageDimensionsFromBuffer(png, "image/png"), { width: 2, height: 3 });
});

test("returns null for unknown image content", () => {
  assert.equal(imageDimensionsFromBuffer(Buffer.from("not an image"), "text/plain"), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/image-metadata.test.js
```

Expected: fail because `src/lib/image-metadata.js` does not exist.

- [ ] **Step 3: Implement image metadata helper**

Create `src/lib/image-metadata.js` with:

```js
export function imageDimensionsFromBuffer(buffer, contentType = "") {
  if (!Buffer.isBuffer(buffer) || buffer.length < 10) return null;
  if (contentType.includes("png") || buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    if (buffer.length < 24) return null;
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return null;
}
```

Extend the helper in the implementation pass to support JPEG, GIF, and WebP before committing. The JPEG parser must walk markers until SOF0/SOF2 and return `{ width, height }`; invalid buffers return `null`.

- [ ] **Step 4: Attach dimensions during image download**

Modify `src/lib/image-download.js` so each downloaded image metadata object includes `width` and `height` when detected:

```js
const dimensions = imageDimensionsFromBuffer(buffer, contentType);
return {
  ...metadata,
  ...(dimensions ? dimensions : {})
};
```

- [ ] **Step 5: Validate optional dimensions**

Modify `src/lib/content.js` so image objects accept optional positive integer `width` and `height`, and reject non-integer or unsafe values.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- tests/image-metadata.test.js tests/image-download.test.js tests/content.test.js
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/image-metadata.js src/lib/image-download.js src/lib/content.js tests/image-metadata.test.js tests/image-download.test.js tests/content.test.js
git commit -m "feat: record local image dimensions"
```

---

### Task 3: Fix Rendering Accessibility, Layout Stability, and Touch Targets

**Files:**
- Modify: `src/lib/render.js`
- Modify: `src/styles/site.css`
- Modify: `tests/render.test.js`
- Modify: `tests/build.test.js`

- [ ] **Step 1: Write failing render tests**

Extend `tests/render.test.js` with assertions that rendered pages include:

```js
assert.match(html, /<img[^>]+width="\\d+"[^>]+height="\\d+"/);
assert.match(html, /<label[^>]+for="archive-search"/);
assert.match(html, /<input[^>]+id="archive-search"/);
assert.match(html, /<label[^>]+for="archive-topic"/);
assert.match(html, /<select[^>]+id="archive-topic"/);
assert.match(html, /<meta property="og:image:alt" content="/);
```

Add a test that the article YouTube banner link wraps a stable media box:

```js
assert.match(html, /class="article-youtube-link"/);
assert.match(html, /class="article-youtube-media"/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/render.test.js
```

Expected: fail on missing labels, missing dimensions, missing `og:image:alt`, and missing stable YouTube media wrapper.

- [ ] **Step 3: Add render helpers**

Modify `src/lib/render.js` with a helper shaped like:

```js
function imageDimensionAttrs(image = {}) {
  const width = Number(image.width);
  const height = Number(image.height);
  if (Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0) {
    return ` width="${width}" height="${height}"`;
  }
  return "";
}
```

Use it for issue covers, inline article images, extra slides, headshot, publication mark, MedBetterHealth logo, and Straight Talk banner.

- [ ] **Step 4: Add visible archive labels and result count**

Modify homepage archive controls in `src/lib/render.js`:

```html
<label for="archive-search">Search editions</label>
<input id="archive-search" data-archive-search type="search" placeholder="Search by topic or headline" aria-describedby="archive-count">
<label for="archive-topic">Filter by topic</label>
<select id="archive-topic" data-topic-filter aria-describedby="archive-count">
<p id="archive-count" class="archive-count" data-archive-count>Showing 42 editions.</p>
```

Modify `src/client/archive-filter.js` to update `data-archive-count` after search or topic changes.

- [ ] **Step 5: Fix the article YouTube banner hit area**

Modify `renderYoutubeBanner()` in `src/lib/render.js` so the link contains:

```html
<span class="article-youtube-media">
  <img ...>
</span>
```

Modify `src/styles/site.css`:

```css
.article-youtube-link {
  display: block;
  border-top: 4px solid var(--gold);
  text-decoration: none;
}

.article-youtube-media {
  display: block;
  aspect-ratio: 6 / 1;
  background: var(--newsprint);
}

.article-youtube-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

- [ ] **Step 6: Increase touch targets**

Modify `src/styles/site.css`:

```css
.site-nav a,
.footer-links a,
.back-link,
.text-link {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}

.carousel-button {
  width: 48px;
  height: 48px;
  min-height: 48px;
}

.carousel-dot {
  width: 44px;
  height: 12px;
}

.button-link {
  min-height: 44px;
}
```

- [ ] **Step 7: Add visited link distinction**

Add:

```css
.article-body a:visited,
.archive-item a:visited,
.topic-issue-list a:visited {
  color: #5b3f73;
}
```

- [ ] **Step 8: Run focused tests and build**

Run:

```bash
npm test -- tests/render.test.js tests/build.test.js
npm run build
npm run audit:site
```

Expected: render/build tests pass. Audit shows 0 broken links/images, 0 missing visible labels, and 0 article YouTube banner 4px hit-area issues.

- [ ] **Step 9: Commit**

```bash
git add src/lib/render.js src/client/archive-filter.js src/styles/site.css tests/render.test.js tests/build.test.js
git commit -m "fix: stabilize media rendering and accessibility"
```

---

### Task 4: Reconcile All LinkedIn Media and Article Placement

**Files:**
- Modify: `scripts/sync-linkedin.js`
- Modify: `scripts/import-linkedin-browser-export.js`
- Modify: `src/lib/linkedin-extract.js`
- Modify: `content/issues/*.json`
- Modify: `content/linkedin-refresh-review.json`
- Modify: `public/assets/issues/**`
- Modify: `tests/linkedin-extract.test.js`
- Modify: `tests/sync.test.js`

- [ ] **Step 1: Write failing review-output tests**

Extend sync/import tests so `content/linkedin-refresh-review.json` records:

```json
{
  "browserArticleImageCount": 0,
  "importedArticleImageCount": 0,
  "excludedMediaCount": 0,
  "excludedMediaReasons": [],
  "placementStatus": "verified"
}
```

Expected statuses: `verified`, `needs-review`, or `blocked`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/linkedin-extract.test.js tests/sync.test.js
```

Expected: fail because richer review fields do not exist.

- [ ] **Step 3: Improve source-order extraction**

Modify `src/lib/linkedin-extract.js` so article media extraction keeps:

```js
{
  type: "image",
  src,
  alt,
  sourceIndex,
  sourceKind: "linkedin-article-image"
}
```

Reject non-article media only when it matches known reasons:

- `straight-talk-banner`
- `linkedin-ui`
- `author-avatar`
- `tracking-pixel`
- `duplicate-cover`

- [ ] **Step 4: Refresh all 42 issues using signed-in LinkedIn access**

Run with browser/auth access:

```bash
npm run sync
```

If LinkedIn blocks the run, update `LINKEDIN_STORAGE_STATE` and rerun. Do not manually guess missing images.

- [ ] **Step 5: Manually inspect the 10 known media-risk issues**

Check these source pages in signed-in LinkedIn and compare against generated article pages:

- Issue 33: `why-does-healthcare-innovation-fail-before-it-reaches-dementia-families`
- Issue 31: `why-does-routine-matter-so-much-in-dementia-care`
- Issue 29: `what-support-do-dementia-caregivers-actually-need-at-home`
- Issue 24: `why-does-respite-care-sometimes-fail-for-dementia-caregivers`
- Issue 20: `when-should-someone-with-dementia-stop-driving`
- Issue 19: `how-is-dementia-actually-diagnosed`
- Issue 17: `why-do-dementia-behaviors-happen-and-what-should-families-do`
- Issue 16: `what-my-grandmother-taught-me-about-dementia-care`
- Issue 15: `is-it-normal-to-feel-overwhelmed-caring-for-someone-with-dementia`
- Issue 10: `what-does-it-really-take-to-fight-alzheimer-s-in-south-florida`

For each issue, record in `content/linkedin-refresh-review.json` whether every LinkedIn article image is either placed in article order or intentionally excluded with a reason.

- [ ] **Step 6: Inspect sparse-media early issues**

Check issues 1, 2, 3, 4, 5, and 13 against LinkedIn. If LinkedIn truly has no slide media, mark `placementStatus: "verified"` and `browserArticleImageCount` accordingly. If media exists, import it and place it in source order.

- [ ] **Step 7: Run media audit**

Run:

```bash
npm run build
npm run audit:site
```

Expected: `mediaNeedsReview` is 0, or any remaining `needs-review` item has `status: "blocked"` with a specific LinkedIn access reason.

- [ ] **Step 8: Commit**

```bash
git add content/issues content/linkedin-refresh-review.json public/assets/issues src/lib/linkedin-extract.js scripts/sync-linkedin.js scripts/import-linkedin-browser-export.js tests/linkedin-extract.test.js tests/sync.test.js
git commit -m "fix: verify LinkedIn media placement"
```

---

### Task 5: Correct YouTube Matching and Hidden Video Decisions

**Files:**
- Modify: `src/lib/youtube.js`
- Modify: `scripts/sync-youtube.js`
- Modify: `content/youtube-videos.json`
- Modify: `content/youtube-matches.json`
- Modify: `content/youtube-review.json`
- Modify: `content/issues/*.json`
- Modify: `tests/youtube.test.js`
- Modify: `tests/youtube-sync.test.js`

- [ ] **Step 1: Add tests for hidden and low-confidence cases**

Add tests covering:

- exact-title nearby-date match for issue 2 if the correct video exists.
- hidden video remains hidden only when title, date, and description all fail.
- curated one-off matches require a review reason with title and description evidence.
- low-confidence curated matches under `0.45` require `manualReview: true`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/youtube.test.js tests/youtube-sync.test.js
```

Expected: fail until review metadata and thresholds are updated.

- [ ] **Step 3: Tighten review fields**

Make each `content/youtube-review.json` issue include:

```json
{
  "status": "matched",
  "confidence": 0.0,
  "daysApart": 0,
  "reason": "",
  "manualReview": false,
  "evidence": {
    "date": "",
    "titleOverlap": 0,
    "descriptionOverlap": 0,
    "matchedTerms": []
  }
}
```

- [ ] **Step 4: Review all hidden and low-confidence matches**

Manually review:

- Hidden: issues 33, 31, 10.
- Low confidence or off-date: issues 38, 37, 34, 32, 30, 25, 16, 15, 14, 12, 7.

Use YouTube title, publish date, and description. If a video is wrong, remove `youtubeVideo` from the issue. If it is right, add or update a curated entry in `content/youtube-matches.json` with the evidence.

- [ ] **Step 5: Re-sync YouTube**

Run:

```bash
npm run sync:youtube
npm run build
```

Expected: article pages show companion video blocks only for matched videos, and no empty shell appears for hidden videos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/youtube.js scripts/sync-youtube.js content/youtube-videos.json content/youtube-matches.json content/youtube-review.json content/issues tests/youtube.test.js tests/youtube-sync.test.js
git commit -m "fix: audit YouTube companion matches"
```

---

### Task 6: Polish Homepage, Mobile Header, and Publication Experience

**Files:**
- Modify: `src/lib/render.js`
- Modify: `src/styles/site.css`
- Modify: `tests/render.test.js`

- [ ] **Step 1: Add layout expectation tests**

Extend render tests to assert:

- homepage includes a latest issue strip before the carousel.
- homepage carousel has 6 slides and all slide links are issue URLs.
- masthead ledger labels are not randomly placed text nodes.
- subscribe page has a clear primary LinkedIn subscribe action and feed options.

- [ ] **Step 2: Run tests to verify they pass or expose gaps**

Run:

```bash
npm test -- tests/render.test.js
```

Expected: fail only where structure needs adjustment.

- [ ] **Step 3: Compact mobile header**

Modify CSS so below `760px`:

- Publication brand remains first.
- Nav is one compact wrapped row with 44px touch targets.
- MedBetterHealth partner logo moves below nav as a smaller partner line.
- Header height stays under 235px on a 390px-wide viewport.

- [ ] **Step 4: Reduce mobile masthead height**

Modify CSS so mobile masthead:

- uses `font-size: clamp(2.6rem, 13vw, 3.65rem)`.
- has reduced top/bottom padding.
- keeps the ledger stacked but compact.
- targets masthead height under 500px on a 390px-wide viewport.

- [ ] **Step 5: Make homepage feel more like a daily publication**

Keep the current broadsheet identity, but adjust hierarchy:

- latest issue strip: compact and above carousel.
- carousel: stronger image framing and less crop on cover images.
- archive controls: visible labels, result count, and clearer spacing.
- topic pathways: keep below latest/editorial content, not competing with the masthead.

- [ ] **Step 6: Improve subscribe page without fake email capture**

Until an email provider endpoint exists, render:

- primary "Subscribe on LinkedIn" button.
- "Get updates with RSS" and "Use JSON feed" secondary actions.
- "Want email delivery?" note that points to LinkedIn subscription instead of a fake form.

Do not add an email input that cannot actually subscribe readers.

- [ ] **Step 7: Run visual QA locally**

Run:

```bash
npm run build
npm run dev
```

Use Playwright or the in-app browser to capture:

- homepage desktop 1440x1200.
- homepage mobile 390x1200.
- subscribe mobile 390x1200.
- latest article desktop.
- latest article mobile.

Expected: no horizontal overflow, no clipped logos, no 4px link hit areas, header under 235px on mobile, masthead under 500px on mobile.

- [ ] **Step 8: Commit**

```bash
git add src/lib/render.js src/styles/site.css tests/render.test.js
git commit -m "style: polish publication homepage and mobile layout"
```

---

### Task 7: Improve SEO and AI SEO

**Files:**
- Modify: `scripts/build-site.js`
- Modify: `src/lib/render.js`
- Modify: `tests/build.test.js`
- Modify: `tests/render.test.js`

- [ ] **Step 1: Add failing AI SEO tests**

Extend `tests/build.test.js`:

```js
assert.equal((llmsText.match(/\\/issues\\//g) ?? []).length, 42);
assert.match(llmsText, /## All Issues/);
assert.match(llmsText, /## Answer Index/);
assert.match(llmsText, /is hearing loss linked to dementia/i);
```

Extend `tests/render.test.js`:

```js
assert.match(html, /"@type":"Article"/);
assert.match(html, /"isAccessibleForFree":true/);
assert.match(html, /"wordCount":/);
assert.match(html, /<meta property="og:image:alt" content="/);
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/build.test.js tests/render.test.js
```

Expected: fail because `llms.txt` lists only 20 issues and metadata is not complete enough.

- [ ] **Step 3: Expand `llms.txt`**

Modify `scripts/build-site.js` so `llms.txt` includes:

- site identity and author.
- medical-use guidance.
- all 42 issue URLs.
- topic guide URLs.
- a short answer index for each issue using `issue.answer.text` or `directAnswerText`.
- RSS and JSON feed links.

- [ ] **Step 4: Improve structured metadata**

Modify `src/lib/render.js` article schema to include:

```js
isAccessibleForFree: true,
articleSection: issue.topics ?? [],
wordCount,
thumbnailUrl: absoluteUrl(site, issue.coverImage)
```

When a video exists, keep `VideoObject` attached. On topic pages, keep FAQ schema and add `ItemList` for related articles.

- [ ] **Step 5: Rebuild and audit AI artifacts**

Run:

```bash
npm run build
npm run audit:site
```

Expected: `llmsIssueLinks` equals 42 and sitemap/feed counts remain 42.

- [ ] **Step 6: Commit**

```bash
git add scripts/build-site.js src/lib/render.js tests/build.test.js tests/render.test.js
git commit -m "feat: expand SEO and AI discovery metadata"
```

---

### Task 8: Fix Workflow and Documentation Drift

**Files:**
- Modify: `.github/workflows/pages.yml`
- Modify: `README.md`

- [ ] **Step 1: Update workflow to run audit**

After `Run checks`, add:

```yaml
      - name: Audit generated site
        if: steps.noon.outputs.run == 'true'
        run: npm run audit:site -- --strict
```

If strict mode still fails while media review is actively being resolved, use non-strict mode for one commit only and document why in the commit message.

- [ ] **Step 2: Clarify noon Eastern cron**

Add a workflow comment above the schedule:

```yaml
    # Runs at both 16:00 and 17:00 UTC so the bash gate catches noon Eastern across DST changes.
```

- [ ] **Step 3: Fix README deployment instructions**

Update README to say:

- site builds to `dist/`.
- workflow publishes `dist/` to the `gh-pages` branch.
- repository Pages source should be `gh-pages` root.
- custom domain comes from `public/CNAME`.
- `npm run audit:site` checks generated output.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/pages.yml README.md
git commit -m "docs: align Pages workflow and audit instructions"
```

---

### Task 9: Full Local Re-Audit and Before/After Report

**Files:**
- Create: `docs/audits/2026-07-06-post-fix.md`
- Read: `/private/tmp/tdt-audit-current.json`
- Read: screenshots in `/private/tmp/tdt-postfix-*.png`

- [ ] **Step 1: Run complete checks**

Run:

```bash
npm run check
npm run audit:site -- --strict
```

Expected:

- 77+ tests pass.
- 42 issue pages generated.
- 0 broken local links.
- 0 broken local images.
- 0 missing visible labels.
- 0 image dimension failures.
- 0 media needs-review items, unless explicitly marked blocked with reason.
- `llms.txt` has 42 issue links.

- [ ] **Step 2: Run rendered desktop/mobile QA**

Start server:

```bash
npm run dev
```

Test routes:

- `/`
- `/start-here/`
- `/subscribe/`
- `/topics/`
- `/topics/hearing-loss-and-dementia/`
- `/issues/why-do-dementia-patients-refuse-help/`
- `/issues/why-does-healthcare-innovation-fail-before-it-reaches-dementia-families/`
- `/issues/what-does-it-really-take-to-fight-alzheimer-s-in-south-florida/`

Viewports:

- desktop `1440x1200`
- mobile `390x1200`

Expected:

- no console errors.
- no horizontal overflow.
- homepage search filters archive results.
- carousel next button changes the active slide.
- article with video renders exactly 1 YouTube iframe.
- articles without video render no empty video shell.
- YouTube banner link is full-height and clickable.
- mobile header under 235px.
- mobile masthead under 500px.

- [ ] **Step 3: Save screenshots**

Save:

- `/private/tmp/tdt-postfix-home-desktop.png`
- `/private/tmp/tdt-postfix-home-mobile.png`
- `/private/tmp/tdt-postfix-article-video-desktop.png`
- `/private/tmp/tdt-postfix-article-video-mobile.png`
- `/private/tmp/tdt-postfix-subscribe-mobile.png`

- [ ] **Step 4: Write comparison report**

Create `docs/audits/2026-07-06-post-fix.md` with this structure:

```markdown
# The Dementia Times Post-Fix Audit

## Summary
- Baseline status:
- Fixed status:
- Remaining risks:

## Metrics Comparison
| Metric | Baseline | After Fix | Result |
| --- | ---: | ---: | --- |
| Tests passing | 77 |  |  |
| Issue pages | 42 | 42 |  |
| Broken local links | 0 | 0 |  |
| Broken local images | 0 | 0 |  |
| Media needs-review | 10 |  |  |
| Missing image dimensions | 545 | 0 |  |
| `llms.txt` issue links | 20 | 42 |  |
| Hidden videos | 3 |  |  |
| Mobile masthead height | 690px |  |  |

## Rendered QA
- Desktop:
- Mobile:
- Interactions:

## Live Domain QA
- Home:
- Latest article:
- Sitemap:
- Robots:

## Remaining Work
- Item:
```

- [ ] **Step 5: Commit report**

```bash
git add docs/audits/2026-07-06-post-fix.md
git commit -m "docs: add post-fix audit comparison"
```

---

### Task 10: Live Deploy, Live Smoke, and Final Report

**Files:**
- No source files unless live smoke exposes a regression.

- [ ] **Step 1: Push branch**

Run:

```bash
git push origin codex/dementia-times-site
```

- [ ] **Step 2: Merge or push to main according to current repo workflow**

If this branch is still tracking the active site work, push the reviewed commits to `main` after tests pass:

```bash
git push origin codex/dementia-times-site:main
```

- [ ] **Step 3: Wait for GitHub Pages deploy**

Use GitHub Actions UI or CLI to confirm the deploy completed successfully.

- [ ] **Step 4: Live smoke with no-cache**

Check:

```bash
https://thedementiatimes.com/
https://www.thedementiatimes.com/
https://thedementiatimes.com/subscribe/
https://thedementiatimes.com/issues/why-do-dementia-patients-refuse-help/
https://thedementiatimes.com/media-audit.json
https://thedementiatimes.com/llms.txt
https://thedementiatimes.com/sitemap.xml
https://thedementiatimes.com/robots.txt
```

Expected: all return `200`; `www` resolves to canonical domain; pages contain the new build.

- [ ] **Step 5: Final answer to user**

Report:

- what was fixed.
- before/after metrics.
- links to live pages.
- screenshots captured.
- any remaining blocked items, especially if LinkedIn or email subscription provider access prevented full completion.

---

## Self-Review

Spec coverage:

- LinkedIn images and image placement: Tasks 2 and 4.
- YouTube matching and hidden videos: Task 5.
- Logo/header/mobile design: Tasks 3 and 6.
- Newsletter experience: Task 6.
- SEO and AI SEO: Task 7.
- Automation/GitHub Pages/docs: Task 8.
- Re-check and audit comparison: Tasks 9 and 10.

Placeholder scan:

- No task uses placeholder markers or copy-forward shortcuts as implementation instructions.
- The only conditional item is the email-provider limitation. The plan explicitly avoids adding a fake email form and keeps LinkedIn subscription as the real working path until a provider endpoint exists.

Type consistency:

- Image dimension fields are consistently `width` and `height`.
- Audit summary fields are consistently `brokenLinks`, `brokenImages`, `mediaNeedsReview`, `llmsMissingIssueLinks`, and `imagesMissingDimensions`.
- Review statuses are consistently `verified`, `needs-review`, and `blocked` for LinkedIn media, and `matched` or `hidden` for YouTube.
