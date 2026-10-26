# The Dementia Times Website Design

## Goal

Build `thedementiatimes.com` as a professional newsletter archive for The Dementia Times, authored by Dr. Erik Ilyayev. The site should feel like a credible editorial newspaper for dementia-care education: polished, readable, medically serious, and branded without becoming corporate.

The site will be static and hosted on GitHub Pages. There will be no CMS, admin dashboard, or visitor login. New LinkedIn newsletter editions should be imported by automation.

## Approved Direction

The approved direction is the "Editorial Archive" concept from the visual companion:

- A broadsheet-inspired homepage with a centered masthead for "The Dementia Times."
- The phrase "Dr. Erik Ilyayev presents" above the masthead.
- A latest-edition feature area.
- A recent-editions rail and a full issue archive.
- Individual article pages for each newsletter.
- Real newsletter images from LinkedIn, not generated or decorative substitutes.
- A restrained medical/editorial palette inspired by the existing email template.

## Brand And Links

Required identity elements:

- The MedBetter Health logo appears in the masthead/header and links to `https://medbetterhealth.org`.
- Dr. Erik Ilyayev appears at the top with his headshot and name. The headshot/name link to `https://www.linkedin.com/in/erik-ilyayev-b9795084/`.
- The YouTube banner for "Straight Talk With Dr. Erik" appears in a relevant homepage or article-side module and links to `https://www.youtube.com/@ErikIlyayev`.
- Every imported newsletter keeps a source link back to its original LinkedIn article.

Use the provided local assets:

- `/Users/rognor/Documents/medbetterhealth/images re/Dr.Erik Headshot.jpeg`
- `/Users/rognor/Documents/medbetterhealth/images re/channels4_banner.jpg`
- `/Users/rognor/Documents/medbetterhealth/images re/MedBetter Health4-02.png`

## Visual System

Palette:

- Paper: `#F4F1EC`
- Article surface: `#FDFCF9`
- Editorial navy: `#1C2B3A`
- Muted text: `#3D3D3D`
- Gold rule/accent: `#C4933F`
- Soft divider: `#E0DAD0`
- GUIDE green: `#3A7D44`
- MedBetter red: `#C9302C`

Typography:

- Masthead and article body: Georgia or a high-quality serif fallback.
- Utility labels, metadata, buttons, filters, and sync status: Arial or a similar sans-serif.
- Headlines should feel editorial and high-contrast without using oversized marketing-page type.
- Body text should prioritize long-form reading comfort.

Layout:

- Homepage opens with a narrow utility row, brand/author links, and a centered masthead.
- The first viewport shows a latest-edition feature using the actual LinkedIn article cover image.
- The archive is designed for scanning by date, issue number, title, topic, and excerpt.
- Individual article pages use a focused reading column with inline LinkedIn slide/deck images.
- Cards should be restrained and used only for repeated issue items or callout modules. No nested cards.

## Content Model

Each issue should be stored as content plus local assets:

- Title
- Slug
- Issue number when present
- Published date
- LinkedIn source URL
- Author
- Excerpt
- Topics/tags, inferred when possible
- Cover image downloaded from LinkedIn
- Inline images/slides downloaded from LinkedIn
- Newsletter body sections
- Medical/educational disclaimer when present

The imported content should be easy to review in the repository. Markdown plus frontmatter or structured JSON are both acceptable, but the article pages must render from local content files.

## LinkedIn Import And Images

The sync must use the actual LinkedIn newsletter content and images.

Importer behavior:

- Open the LinkedIn newsletter page: `https://www.linkedin.com/newsletters/the-dementia-times-7452443336956899329/`.
- Discover edition/article URLs.
- For each new article, extract title, published date, issue number, body text, cover image, and inline images.
- Download all article images into the repository instead of hotlinking LinkedIn URLs.
- Preserve source attribution with a link to the original LinkedIn article.
- Avoid overwriting existing imported issues unless an explicit refresh command is run.

Authentication:

- The importer should first work with publicly visible LinkedIn content when possible.
- If LinkedIn blocks full content, the GitHub Action can use a private repository secret for a Playwright storage state or session cookie.
- If the secret expires or LinkedIn blocks the run, the action should fail gracefully and leave the live site unchanged.

## Automation

Use GitHub Actions with GitHub Pages.

Daily schedule:

- The sync should check for new LinkedIn editions every day at noon Eastern.
- GitHub Actions cron is UTC-only, so use two UTC schedules around Eastern daylight/standard time and gate execution inside the workflow by checking whether the current America/New_York hour is 12.
- The workflow should also support manual `workflow_dispatch`.

Expected workflow:

1. Install dependencies.
2. Run the LinkedIn sync script.
3. If new issues were imported, commit the new content/assets.
4. Build the static site.
5. Deploy to GitHub Pages.

## Pages And Features

Homepage:

- Masthead with "Dr. Erik Ilyayev presents" and "The Dementia Times."
- MedBetter logo and Dr. Erik author block at the top.
- Latest issue feature with real LinkedIn image.
- Recent editions list.
- Archive list with search/filter by topic and date.
- GUIDE Model callout using the green treatment from the email template.
- YouTube banner module linking to Dr. Erik's channel.

Article page:

- Issue metadata, title, author row, source link.
- Real LinkedIn cover image.
- Full imported newsletter body.
- Inline LinkedIn slide/deck images placed where they appeared in the article.
- GUIDE/MedBetter callout when included in the newsletter.
- YouTube banner or link module near the end.
- Educational/medical disclaimer.
- Previous/next issue navigation.

Static support pages are optional for the first version. The homepage and article pages are required.

## Error Handling

- If no new LinkedIn editions exist, the sync exits successfully with no commit.
- If LinkedIn cannot be reached during a scheduled run, the current site remains deployed.
- If article extraction only partially succeeds, the importer should skip that article and report the issue rather than publishing incomplete content.
- If images fail to download, the article should not be marked imported unless the missing image is explicitly allowed.

## Testing And Verification

Implementation should include:

- Tests for content parsing, slug generation, duplicate detection, and image path handling.
- A build check for the static site.
- A local browser check of homepage and at least one article page on desktop and mobile widths.
- Visual QA against the approved companion concept: masthead, latest issue, archive, author/brand links, article page, and image rendering.

## Out Of Scope

- CMS/admin dashboard.
- Visitor accounts or subscriptions.
- Payment, donations, or intake forms beyond linking to MedBetter resources.
- Generated article imagery replacing LinkedIn newsletter media.
- A server-side database.
