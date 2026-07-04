# Rudy — Design System

> 이 문서는 Rudy 모바일 앱의 유일한 디자인 소스다. M3(Mobile Core) 이후 모든 UI 작업은
> 이 문서의 토큰·컴포넌트를 따른다. 임의로 색상·타이포·spacing을 정하지 않는다.

## Overview

Rudy reads like a quietly editorial print magazine that happens to be a personal curation app.
The base canvas is cream-tinted off-white `{colors.canvas}` (#faf6ef) holding warm near-black
ink `{colors.ink}` (#1c1712). The brand voltage is **atmospheric, not chromatic**: a single soft
pastel gradient orb (lavender, peach, or mint depending on card type) blooms behind the day's one
Hero card as the only "color" moment on the page. There is no neon accent, no saturated CTA color,
no badge-red, no dashboard chrome.

Type pairs a **weight-300 serif** for display (EB Garamond for English, Noto Serif KR for Korean)
with a matching sans for body, navigation, and captions (Inter / Pretendard). The display weight
at 300 is the editorial signature — never bold, never heavy. This mirrors the product's own voice:
Rudy hands the user one thing at a time and steps back, the way a well-edited page does.

CTAs are subtle: a near-black ink pill (`{component.button-primary}`) is the only primary action
color anywhere in the app. A transparent outline (`{component.button-outline}`) is the secondary.
The brand trusts the cream canvas, restrained type, and one atmospheric orb to carry the entire
visual identity — never a second accent color, never a mascot, never a badge.

**Key Characteristics:**
- Cream-tinted off-white canvas, warm near-black ink. No saturated CTA color anywhere in the app.
- Single primary action: ink pill at `{rounded.pill}`. One atmospheric orb carries visual brand voltage.
- Display runs a weight-300 serif (locale-paired) — editorial, never bold.
- Body runs a locale-paired sans at 400/500 with subtle positive letter-spacing.
- Pastel gradient orb (3 active tokens: lavender, peach, mint — mapped to card_type) used as
  atmospheric decoration on the Hero card only. Never anywhere else.
- Soft pill geometry (`{rounded.pill}` for CTAs and chips, `{rounded.lg}` for the Hero card).
- 56px section rhythm (Home header → Hero → Support cards → Closing line).
- No badges, no unread counts, no red dots — anywhere, ever (Product Rule 2).

## Colors

### Brand & Accent
- **Ink Primary** (`{colors.primary}` — #292420): The primary action color — warm near-black pill. The only CTA color in the app.
- **Ink Primary Active** (`{colors.primary-active}` — #1c1712): Press state.

### Surface
- **Canvas** (`{colors.canvas}` — #faf6ef): Cream-tinted off-white page floor. The warmth is deliberate — a colder gray (#f5f5f5) reads as dev-tooling, not a personal keepsake app.
- **Canvas Soft** (`{colors.canvas-soft}` — #fdfbf6): Lighter cream, used inside the Hero card behind the orb bloom.
- **Canvas Deep** (`{colors.canvas-deep}` — #1c1712): Reserved. No dark surfaces in Rudy v1 — MVP is light-canvas only.
- **Surface Card** (`{colors.surface-card}` — #ffffff): Pure white. Hero/Support cards, Card Detail, Library rows.
- **Surface Strong** (`{colors.surface-strong}` — #f1ebdc): Chips, badges, interest cards, onboarding selections.
- **Surface Dark** (`{colors.surface-dark}` — #1c1712): Reserved. Not used in MVP.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` — #292420): Reserved. Not used in MVP.

### Hairlines
- **Hairline** (`{colors.hairline}` — #e9e2d2): Default 1px divider — Library row separators, card outlines.
- **Hairline Soft** (`{colors.hairline-soft}` — #f1ebdc): Lighter divider inside cards.
- **Hairline Strong** (`{colors.hairline-strong}` — #d9cfb8): Text-input border, outline-button border.

### Text
- **Ink** (`{colors.ink}` — #1c1712): Display headlines, primary text (card titles, curation_reason).
- **Body** (`{colors.body}` — #4a4238): Default running text.
- **Body Strong** (`{colors.body-strong}` — #292420): Same value as primary — emphasis text.
- **Muted** (`{colors.muted}` — #736b5d): Metadata — saved date, source domain, sub-titles. Darkened from #8a8172 to clear WCAG AA (4.87:1 on `{colors.canvas}`, 5.25:1 on `{colors.surface-card}`) since it carries real text.
- **Muted Soft** (`{colors.muted-soft}` — #b7ad9a): Placeholder text and disabled state only (~2.1:1 on canvas — below AA, which is why it is restricted to placeholder text, WCAG-exempt, and must never carry meaningful body text or a standalone control label).
- **On Primary** (`{colors.on-primary}` — #ffffff): White text on the ink pill.

### Atmospheric Gradient Stops (signature)
- **Gradient Lavender** (`{colors.gradient-lavender}` — #cbc0e0): Hero orb — `card_type = 'rediscovery'`.
- **Gradient Peach** (`{colors.gradient-peach}` — #f1c9a3): Hero orb — `card_type = 'discovery'`.
- **Gradient Mint** (`{colors.gradient-mint}` — #b7decb): Hero orb — `card_type = 'reflection'`.
- **Gradient Sky** (`{colors.gradient-sky}` — #abc7de): Onboarding and empty-state illustration only.
- **Gradient Rose** (`{colors.gradient-rose}` — #e9bfc4): Reserved for a future `surprise` reason_code (post-MVP). Not used in v1.

These appear ONLY as a single soft radial-gradient bloom inside `{component.card-hero}`, at
opacity 0.35–0.5, behind the thumbnail/title area. Never as button fills, never as text colors,
never on Support cards, never in Library or Settings.

### Semantic
- **Success** (`{colors.semantic-success}` — #4a7a5c): Save confirmation toast.
- **Error** (`{colors.semantic-error}` — #b54b3a): Validation errors, destructive-action confirmation (account deletion, "never show this again").

## Typography

### Font Family
Rudy targets English by default with Korean as an opt-in locale (`users.locale`), so the display
serif and body sans both swap per locale — sizes, weights, and letter-spacing stay identical
across locales, only the family changes.

| Locale | Display (serif, weight 300) | Body (sans) |
|---|---|---|
| `en` (default) | EB Garamond | Inter |
| `ko` | Noto Serif KR | Pretendard |

Fallback: `'Times New Roman', serif` for the display family, system sans-serif for body. Both
EB Garamond and Noto Serif KR are open-source/free — no licensing constraint, unlike a
commissioned display face.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-lg}` | 26px | 300 | 1.2 | -0.3px | Onboarding screen titles |
| `{typography.display-md}` | 22px | 300 | 1.25 | -0.2px | Home greeting header |
| `{typography.title-md}` | 17px | 500 | 1.35 | 0 | Card title (content title) — sans |
| `{typography.title-sm}` | 15px | 500 | 1.4 | 0 | List labels, interest names — sans |
| `{typography.body-md}` | 15px | 400 | 1.5 | 0.1px | curation_reason, running body — sans |
| `{typography.body-strong}` | 15px | 500 | 1.5 | 0.1px | Emphasized body |
| `{typography.body-sm}` | 13px | 400 | 1.45 | 0.1px | Metadata — saved date, domain |
| `{typography.caption}` | 12px | 400 | 1.4 | 0 | Timestamps, fine print |
| `{typography.caption-uppercase}` | 11px | 600 | 1.3 | 0.8px | Section labels, "rising" badge |
| `{typography.button}` | 15px | 500 | 1.0 | 0 | CTA pill label |

### Principles
- **Display weight stays at 300.** The serif is the editorial signature. Never bold display copy.
- **Subtle positive letter-spacing on body.** +0.1px tracking — a touch looser than default for an editorial feel.
- **Negative letter-spacing on display.** -0.2px to -0.3px tighter on display sizes.
- Display sizes are deliberately restrained versus a marketing site (26px max, not 64px) — Rudy's
  display type sets a tone for a phone screen read in 90 seconds, not a hero banner.

### Note on Font Substitutes
No substitution needed — EB Garamond and Noto Serif KR are both open-source and directly
bundleable via Expo fonts. Inter and Pretendard are likewise free and already the de facto
standard for their respective locales.

## Layout

### Spacing System
- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.base}` 16px · `{spacing.md}` 20px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.section}` 56px.
- **Section rhythm:** 56px between Home header / Hero / Support-card group / Closing line — the mobile equivalent of a magazine's editorial band spacing, compressed for a single-column phone read.

### Grid & Container
- Single column throughout — Rudy has no multi-column layout anywhere (it is a phone app, not a responsive site).
- Screen margin: 16px each side, safe-area-aware (notch/home-indicator insets added on top).
- The only horizontal-scroll pattern is Card Detail's "connected memories" row (max 3 cards) and Onboarding's interest-chip wrap.

### Whitespace Philosophy
Generous but compressed editorial pacing for a phone screen: 56px between major Home bands,
12–16px between cards inside a band. The Hero orb occupies breathing space around the thumbnail
without competing with the title or curation_reason. The Closing line sits alone with extra
top padding (32px) to read as a deliberate stop, not a continuation.

## Elevation & Depth

The system uses **hairline + orb**, no shadow stack. Cards sit flat on the cream canvas via 1px
hairlines; the only depth signal is the Hero card's single atmospheric orb.

| Level | Treatment | Use |
|---|---|---|
| Flat (canvas) | `{colors.canvas}` (#faf6ef) | Home background, Library background, Settings background |
| Card | `{colors.surface-card}` (#ffffff) | Hero/Support cards, Card Detail, Library rows |
| Hairline border | 1px `{colors.hairline}` | Card and row outlines |
| Modal drop | `0 -2px 12px rgba(28, 23, 18, 0.08)` | Card Detail sheet presentation only (single shadow tier, used nowhere else) |
| Gradient orb | Radial gradient with one of `{colors.gradient-lavender/peach/mint}` | Hero card only — never a card surface, never elsewhere |

### Decorative Depth
- **The Hero orb** is Rudy's only atmospheric decoration. One soft radial bloom, opacity 0.35–0.5,
  positioned behind the thumbnail/title of `{component.card-hero}`. Its color is chosen by
  `card_type` (lavender = rediscovery, peach = discovery, mint = reflection) — a quiet signal, not
  a labeled category. Support cards, Library, Card Detail, and Settings carry zero orb decoration
  by design: the orb marks "today's one thing," and using it elsewhere would dilute that signal.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | Inline tags, timestamp chips |
| `{rounded.sm}` | 8px | Text inputs, small buttons |
| `{rounded.md}` | 12px | Support cards, Library row thumbnails |
| `{rounded.lg}` | 20px | Hero card, Card Detail hero thumbnail |
| `{rounded.pill}` | 9999px | All CTA buttons, chips, badges |
| `{rounded.full}` | 9999px | Profile icon, avatar |

## Components

### Navigation

**`tab-bar`** — Background `{colors.canvas}`, 3 items (Home / Capture / Library), height 56px + safe-area inset. Active tab: `{colors.ink}` icon + label. Inactive: `{colors.muted-soft}`. No badge counts on any tab (Product Rule 2). Capture tab renders as a raised circular `{component.button-primary}` (the "+" action), not a flat tab item.

### Buttons

**`button-primary`** — Near-black ink pill. Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}` (15px / 500), padding 12px × 24px, height 48px, rounded `{rounded.pill}`.

**`button-primary-active`** — Press state. Background `{colors.primary-active}`.

**`button-outline`** — Transparent pill with 1px ink border. Background transparent, text `{colors.ink}`, 1px `{colors.hairline-strong}` border. Same size as primary.

**`button-text-link`** — Inline ink text link, no background. Used for "Edit note" and inline actions in Card Detail.

### Home & Atmospheric

**`home-header`** — Background `{colors.canvas}`, greeting in `{typography.display-md}` (ink) + date in `{typography.body-sm}` (muted). Profile icon top-right opens Settings.

**`card-hero`** — Position 0 of the Home stack, always exactly one per day. Background `{colors.surface-card}`, rounded `{rounded.lg}` (20px), padding `{spacing.lg}`. Carries a single atmospheric orb bloom (see Decorative Depth) behind a 16:9 thumbnail, then title (`{typography.title-md}`), curation_reason (`{typography.body-md}`, `{colors.body}`), then a full-width `{component.button-primary}` as the primary open action. Feedback row (👍 / ⋯ menu with "stop showing this") sits bottom-right, small and quiet.

**`card-support`** — Positions 1–3 of the Home stack. Same internal structure as `card-hero` at smaller scale (thumbnail 64×64 or omitted), rounded `{rounded.md}` (12px), no orb, no shadow. `{spacing.sm}` gap between support cards.

**`home-closing`** — No background (canvas continues). Centered `{typography.body-sm}` in `{colors.muted}`: "That's all for today. I'll have more ready tomorrow." Extra top padding (32px) to read as a deliberate stop — the explicit end of the Home screen (Product Rule 3: no infinite scroll).

### Card Detail

**`card-detail-sheet`** — Modal sheet presentation, `{component.elevation.modal-drop}` on the sheet's top edge. Background `{colors.canvas}`. Large thumbnail → title (`{typography.display-md}`) → editable user-note input → saved-date caption → horizontal-scroll `{component.connected-memory-chip}` row (max 3) → curation_reason full text (`{typography.body-md}`) → sticky-bottom `{component.button-primary}` (primary open action) → feedback row.

**`connected-memory-chip`** — Background `{colors.surface-strong}`, rounded `{rounded.md}`, 96px width, small thumbnail + one-line title (`{typography.caption}`).

### Capture

**`capture-fullscreen`** — Background `{colors.canvas}`. Top-left cancel (`{component.button-text-link}`), centered full-width text input with immediate keyboard focus (`{typography.body-md}`), bottom `{component.button-primary}` "Save". No category/tag UI anywhere on this screen (Product Rule 5).

**`share-toast`** — Background `{colors.primary}`, text `{colors.on-primary}`, rounded `{rounded.sm}`, appears for 1s then auto-dismisses. "Got it." + one-line AI summary once ready; optional inline note field.

### Library

**`library-row`** — Horizontal row. 48×48 thumbnail (`{rounded.sm}`) + title (`{typography.title-sm}`) + AI one-line summary (`{typography.body-sm}`, muted) + saved-date (`{typography.caption}`, right-aligned). 1px `{colors.hairline}` bottom divider.

**`library-interest-card`** — Background `{colors.surface-strong}`, rounded `{rounded.md}`, padding `{spacing.md}`. Interest name (`{typography.title-sm}`) + memory count + rising arrow (`{colors.primary}`, only when `status = 'rising'`). Cards with `memory_count = 0` are not rendered.

**`search-bar`** — Background `{colors.surface-card}`, rounded `{rounded.pill}`, height 40px, 1px `{colors.hairline-strong}` border, placeholder in `{colors.muted-soft}`.

### Onboarding

**`onboarding-chip`** — Background `{colors.surface-strong}` (unselected) / `{colors.primary}` (selected, text flips to `{colors.on-primary}`), rounded `{rounded.pill}`, padding 8px × 14px, `{typography.body-sm}`.

**`onboarding-illustration`** — Uses `{colors.gradient-sky}` as a soft atmospheric bloom behind the value-proposition screen only. The single non-Hero use of an orb token in the entire app.

### Forms & Settings

**`text-input`** — Background `{colors.surface-card}`, text `{colors.ink}`, rounded `{rounded.sm}` (8px), padding 12px × 16px, height 44px, 1px `{colors.hairline-strong}` border. On focus, border thickens to 2px ink.

**`badge-pill`** — Background `{colors.surface-strong}`, text `{colors.ink}`, type `{typography.caption-uppercase}`, rounded `{rounded.pill}`, padding 4px × 10px. Used only for the "rising" interest marker — never as an unread/count badge.

**`settings-row`** — Background transparent, 1px `{colors.hairline-soft}` bottom divider, label (`{typography.body-md}`) left, value or toggle right. Rows: notification time, language (en/ko), hide lock-screen content, account.

## Do's and Don'ts

### Do
- Reserve `{colors.primary}` (ink pill) for primary CTAs only.
- Use the locale-paired serif at weight 300 for every display headline. Never bold.
- Use the locale-paired sans at +0.1px tracking for body — the editorial dialect.
- Use the atmospheric orb on `{component.card-hero}` only, colored by `card_type`.
- Use the pill shape for every CTA, chip, and badge.
- Render the Closing line and stop — no further content below it.

### Don't
- Don't introduce a second brand action color. Ink pill is the only CTA color in the app.
- Don't bold display copy. Weight 300 is the brand voice — bolding shifts it from editorial to generic-app.
- Don't use the gradient orb as a button fill, text color, or component background, and don't use it on any component besides `card-hero` and `onboarding-illustration`.
- Don't add unread counts, red dots, or "N days" badges anywhere (Product Rule 2 — Rudy does not evaluate the user).
- Don't drop body type to weight 300 to match the display face — body stays 400/500 for legibility.
- Don't add a shadow stack. One modal-drop tier exists for the Card Detail sheet only.

## Responsive Behavior

Rudy is a phone-only app (iOS first; Android build-only, not UI-tuned in MVP) — there are no
desktop/tablet breakpoints. "Responsive" here means device size classes and text scaling.

### Device Size Classes

| Class | Width | Key Changes |
|---|---|---|
| Compact (iPhone SE and similar, ≤375pt) | 375pt | `{typography.display-md}` steps down to 20px; Hero thumbnail shortens to 14:9. |
| Standard (most iPhones, 376–430pt) | 390–430pt | Base sizes as specified above. |
| Large / Max (Pro Max class, >430pt) | >430pt | No size change — extra width becomes margin, not larger type (keeps line length editorial). |

### Dynamic Type
- All text tokens support iOS Dynamic Type scaling up to the "Accessibility Large" tier.
- `{typography.display-md}`/`{typography.display-lg}` scale up to 1.3× max before line-wrapping to 2 lines rather than overflowing.
- `{component.button-primary}` height grows with scaled type (min 48px, no max) rather than clipping the label.

### Touch Targets
- `{component.button-primary}`/`{component.button-outline}` at 48px height — WCAG AAA by default.
- `{component.tab-bar}` items: 56px height, full-width tap zone per tab.
- `{component.card-hero}`/`{component.card-support}` are tappable as a whole (not just the CTA) — target ≥ 64pt tall.

### Orientation
Portrait only. No landscape layout is designed for MVP.

## Iteration Guide

1. Focus on a single component at a time.
2. CTAs default to `{rounded.pill}`. The Hero card uses `{rounded.lg}` (20px); everything else uses `{rounded.md}` or smaller.
3. Variants (`-active`, `-selected`, `-disabled`) live as separate entries under their base component.
4. Use `{token.refs}` everywhere — never inline hex in component code.
5. Hover state is not documented (no hover on a touch device) — only default / pressed / selected.
6. Serif weight 300 for display, sans 400/500 for body, locale-paired per `users.locale`.
7. The atmospheric orb is scoped to `card-hero` and `onboarding-illustration` only — do not introduce a third use case without updating this document first.

## Known Gaps

- No dark mode designed for MVP (`{colors.canvas-deep}`, `{colors.surface-dark}` are reserved tokens, unused).
- Animation timings (orb entrance, card-feedback micro-interaction, sheet presentation curve) are out of scope of this document.
- Android form factor is not visually tuned in MVP — CLAUDE.md scopes Android to "build-only."
- Empty-state illustration beyond `{component.onboarding-illustration}` (e.g. Library with zero memories, Search with zero results) is not yet specified — design on demand when M3 reaches those screens.
- Accessibility color-contrast: `{colors.muted}` audited and corrected to #736b5d (AA-passing, see Colors → Text). `{colors.muted-soft}` remains below AA by design (placeholder/disabled only, WCAG-exempt). Remaining tokens (ink/body on canvas, on-primary on primary) are high-contrast by inspection; a full automated audit across every pairing is still worth running once M3 screens exist.
