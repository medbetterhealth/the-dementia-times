# Jewish Family Home Care test site — design

## Goal

Stand up a separate, local-only test site for Jewish Family Home Care (JFHC), reusing The Dementia Times' static-site generator and design system, so it can eventually be previewed at `jewishfamily.thedementiatimes.com`. This repo (`tdt`) must remain completely untouched — no files changed, no git history added, no deploy config modified.

## Scope

- New, independent project at `/Users/rognor/Documents/jfhc-times` (sibling directory, separate git history, no relation to `tdt` beyond being copied from it once).
- No new GitHub repo, no `git push`, no DNS changes, no live deploy in this pass. The GitHub Actions workflow file is copied for later use but stays inert (never pushed to a remote with Pages enabled).
- Deliverable for this pass: a working local dev server the user can open in a browser to review.

## What copies unchanged

- `scripts/`, `src/`, `tests/`, `package.json`, `.github/workflows/pages.yml`
- `content/issues/*.json` and `public/assets/issues/**` — real newsletter content, unchanged authorship (Dr. Erik Ilyayev / MedBetterHealth), unchanged source links
- `content/topics/`, `content/locales/`, other non-branding content files
- Design system (CSS tokens, typography, layout) from `src/styles` — reused as-is per user's choice to keep the Dementia Times visual identity

## What changes (site chrome only, not article content)

1. `content/site.json`:
   - `title`: "The Dementia Times" → "Jewish Family Home Care"
   - `presentedBy`, `description`: reworded for JFHC, keeping real author attribution (Dr. Erik Ilyayev, MedBetterHealth) intact
   - `siteUrl`: → `https://jewishfamily.thedementiatimes.com`
   - `brand.publicationMark`: no JFHC logo asset exists, so this points to a simple text wordmark instead of `dementia-times-mark.svg`
2. `src/lib/ui-text.js` — hardcoded "The Dementia Times" phrases across English/Spanish/Russian locale blocks → "Jewish Family Home Care" equivalents
3. `src/client/archive-filter.js` — one hardcoded form-source label string
4. `public/CNAME` → `jewishfamily.thedementiatimes.com`
5. `README.md` — describe this as the JFHC test site, note it is not yet deployed

## What's explicitly out of scope

- Creating a GitHub repo
- Pushing any commits to a remote
- Editing DNS
- Enabling the scheduled LinkedIn-sync or auto-deploy cron (workflow file stays, but nothing runs it)
- New branding/colors (explicitly reusing Dementia Times design system per user decision)

## Verification

- `npm install`, `npm test`, `npm run build` succeed in the new project
- `npm run dev` serves the built site locally; manually check the homepage masthead reads "Jewish Family Home Care" and a sampled article renders correctly with unchanged authorship
