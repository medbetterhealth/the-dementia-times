# The Dementia Times Design System

## Overview

The site is a calm, highly legible daily publication for dementia caregivers. Its visual language combines a serious newspaper masthead with practical, modern wayfinding. Editorial character supports trust; it never delays access to an answer.

## Theme

Use a light reading environment suitable for an older caregiver reading during the day at a kitchen table or in a clinical waiting room. Surfaces are warm white, surrounding space is cool and quiet, and dark navy carries authority. Red, blue, gold, and GUIDE green are reserved for clear brand or action roles.

## Color Palette

- Page surround: `#E8EDF1`
- Reading surface: `#FFFDF9`
- Newsprint secondary surface: `#F6F1E8`
- Editorial navy: `#17334A`
- Primary ink: `#14212D`
- Body text: `#383838`
- Muted text: `#65615A`
- MedBetter blue: `#075A8F`
- Editorial gold: `#B98A3B`
- Divider: `#D8D3C9`
- GUIDE green: `#3A7D44`
- Action red: `#C9302C`

All foreground/background combinations used for text must meet WCAG 2.2 AA contrast.

## Typography

- Editorial headlines and long-form reading: Georgia, "Times New Roman", serif.
- Navigation, labels, metadata, forms, and controls: Arial, Helvetica, sans-serif.
- Body copy targets 65 to 75 characters per line with relaxed line height.
- Headings use clear scale and weight contrast; interface labels stay compact but never small enough to strain older readers.
- Letter spacing is zero for reading text. Modest positive tracking is limited to short uppercase utility labels.

## Layout

- Maximum publication width: 1220px.
- Maximum article reading width: 760px.
- Use ruled editorial sections for hierarchy and full-width bands for major page regions.
- Use cards only for repeated selectable pathways, search results, and issue entries.
- Homepage help pathways must fit in one comprehensible section and link directly to filtered search results.
- Search results use a horizontal editorial card on wide screens and a stacked card on narrow screens, with cover image, compact title, metadata, relevant excerpt, and an explicit read link.

## Components

### Header

The TDT publication mark links home. English, Español, and Русский remain visible near the top on every page. The MedBetterHealth mark is labeled "Presented by" and links to MedBetterHealth.

### Help Pathways

Use plain-language situation labels, a short explanation, and one explicit action. A pathway click opens the search page already filtered to that situation, where direct answers and relevant newsletters are immediately visible.

### Search Results

Show common questions for the selected situation first. Each question links to its answer article. Below that, show matching newsletters ordered by relevance, with the section that best answers the query and a visible "Read the full article" action.

### Focus And Targets

Interactive controls use a visible three-pixel focus ring and at least a 44px target. Hover treatment must not be the only indication of interactivity.

## Motion

Motion is optional and restrained. Carousel and disclosure behavior should be immediate or use short ease-out transitions. Respect `prefers-reduced-motion: reduce`.

## Responsive Behavior

At mobile widths, navigation wraps without overlap, pathway cards become a single column, result cards stack, and all text and controls remain within the viewport. No content depends on horizontal scrolling.
