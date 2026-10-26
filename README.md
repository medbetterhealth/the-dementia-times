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

GitHub Actions checks for new LinkedIn editions at noon Eastern and deploys through GitHub Pages. In the repository settings, set Pages to use **GitHub Actions** as the source.

The scheduled workflow uses `scripts/sync-linkedin.js`, commits any new issue JSON/assets back into the repository, builds `dist/`, and deploys the static site.

If public LinkedIn content is blocked, add a repository secret named `LINKEDIN_STORAGE_STATE` containing a Playwright storage state JSON string for a logged-in LinkedIn session.

For a one-time backfill, set `LINKEDIN_ARTICLE_URLS` to a JSON array or newline-separated list of LinkedIn article URLs and run `npm run sync`.

If LinkedIn blocks a run or the secret expires, the workflow leaves the current published site unchanged.

## Domain

The custom domain is set with `public/CNAME` and deploys as `thedementiatimes.com`.
