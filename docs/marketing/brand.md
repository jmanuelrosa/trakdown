# trakdown brand

The visual identity for trakdown. Same palette and type system across the landing page, the extension, future CLI, and any docs.

## Concept

**Studio-utility.** Highlighter pen + technical drawing + terminal. Not editorial, not corporate-tech, not AI-cyberpunk. trakdown is a small sharp tool for engineers; the brand reflects that.

The product highlights and extracts. The brand IS a highlighter.

## Color tokens — warm cream surface + deep teal brand

trakdown's identity is a **warm neutral surface with one strong chromatic accent.** Theory: cream + teal is a complementary pairing (warm/cool), with the cream giving paper-document warmth and the teal giving precision-tool gravitas. Avoids the dev-tool aesthetic monocultures (cold corporate blue, AI purple, hacker lime, generic dark+neon).

Single light theme for v0. Dark-mode toggle deferred.

All colors in OKLCH; hex for reference.

| Token | Hex | OKLCH | Role |
|---|---|---|---|
| `--color-brand` | `#0F8B7E` | `oklch(54% 0.09 188)` | Primary brand. Picker overlay (extension). Primary CTA bg. Links. |
| `--color-brand-deep` | `#0F5E55` | `oklch(40% 0.07 188)` | Hover/active. Link hover. Brand emphasis. |
| `--color-brand-soft` | `#D9F0ED` | `oklch(94% 0.028 188)` | Highlighter underlays. Selection background. Subtle tints. |
| `--color-on-brand` | `#FBF7EE` | `oklch(97% 0.012 85)` | Text on brand-color backgrounds. |
| `--color-bg` | `#FBF7EE` | `oklch(97% 0.012 85)` | Page background. Warm cream. |
| `--color-bg-elev` | `#FEFCF5` | `oklch(99% 0.008 85)` | Cards, demo frame, elevated surfaces. |
| `--color-fg` | `#2A2722` | `oklch(20% 0.008 80)` | Primary text. Deep warm ink. |
| `--color-fg-muted` | `#736E66` | `oklch(45% 0.012 80)` | Secondary text, lede, sub-headings. |
| `--color-muted` | `#9A938A` | `oklch(58% 0.012 80)` | Captions, marginalia, labels. |
| `--color-rule` | `#DDD5C6` | `oklch(86% 0.015 80)` | Borders, dividers. |

### Why deep teal

- **Distinctive in the dev-tool space.** Almost no dev tool uses teal as primary — the field defaults to blue (B2B SaaS), purple (AI / Anthropic / Linear / Tailwind), or dark+neon (Cursor / Raycast). Teal stands alone.
- **Conceptually right.** Teal evokes clarity, precision instruments, fountain-pen ink, lab glass. The product is a clean, sharp extraction tool.
- **Accessible against cream.** `#0F8B7E` on `#FBF7EE` yields ~5.5:1 contrast — WCAG AA pass for text, AAA for graphical elements. Body text on cream is ~14:1.
- **Picker visibility.** Teal on most authenticated dashboards (which lean white/light) is highly visible — solves the lime-on-light contrast problem that killed the previous attempt.

### Don'ts

- Don't introduce a second saturated accent. The palette has one chromatic color; everything else is warm neutrals. A second accent dilutes the brand signal.
- Don't pure-white the surface. The warm cream is load-bearing — it's what makes the page feel like quality paper instead of a blank wireframe.
- Don't use teal for body text. Reserve for accents, CTAs, links, picker overlay, highlight blocks.
- Don't gradient anything. Solid colors only.

### Why lime

- Conceptually a highlighter mark — the product literally highlights and extracts.
- No major dev tool uses it as primary (Linear/purple, Vercel/black, Tailwind/cyan-purple, Cursor/blue, Raycast/red, Obsidian/purple). Lime stands alone in the space.
- Sharp on light surfaces; pops on dark surfaces; works as both fill (at 25–30% alpha) and outline (full strength).
- Pairs naturally with deep ink — the highlighter-on-text combo people already know.

### Don'ts

- Don't pair brand lime with another saturated accent color. Lime is the only chroma in the palette; everything else is ink/muted neutrals.
- Don't use brand lime for long-form text. Reserve for accents, CTAs, picker overlay, and highlight blocks.
- Don't tint the surface toward green to "match." Surface stays cool-neutral; the lime is what brings the warmth/chroma.

## Type system

| Role | Font | Weights | Source |
|---|---|---|---|
| Display & UI | **JetBrains Mono** (variable) | 400, 500, 600, 700 | Google Fonts |
| Body | **Manrope** (variable) | 300, 400, 500, 600, 700 | Google Fonts |

### Why mono headlines

Mono H1s say "tool, not magazine." Combined with a clean geometric sans for body, the page reads like a beautifully typeset README — which is what trakdown produces.

### Pairing rules

- H1–H4 → JetBrains Mono, Medium (500) at large size, Semibold (600) at smaller heads.
- Body → Manrope Regular (400), 16–17px, 1.6 line-height.
- Labels, kbd, code, button text, marginalia, captions → JetBrains Mono.
- Never Manrope for headlines. Never JetBrains Mono for body paragraphs longer than ~2 sentences.

## Texture

A single subtle SVG fractal-noise overlay on the page background, multiply-blended at ~50% opacity. No gradients, no dotted grids, no glow effects.

## Motion

One orchestrated reveal on first paint (hero stagger). Section transitions on scroll are restrained — opacity + 8px translate, 700ms cubic-bezier(0.16, 1, 0.3, 1). No parallax, no scroll-jacking.

## Application across surfaces

### Landing page (`apps/web`)
Defined in `apps/web/src/styles/global.css` via `@theme`. Single light theme (no toggle in v0). All components reference tokens; the only hardcoded colors are the macOS traffic-light dots in `Demo.astro` for realism. Primary CTAs use teal bg + cream text — visually identical to the picker overlay in the extension, so install-button and picker-in-the-wild reinforce the same color memory.

### Extension (`apps/extension`)

The picker overlay uses the brand colors directly:

- Outline: `rgb(15, 139, 126)` (brand teal)
- Fill: `rgba(15, 139, 126, 0.18)`
- Banner / toast background: `rgb(42, 39, 34)` (warm ink)
- Banner / toast text: `rgb(251, 247, 238)` (cream)
- Banner / toast `▍` cursor mark: `rgb(15, 139, 126)` (brand teal)

The brand color appears on the user's screen every time they capture — same teal as the install button on the landing.

### Future CLI

Terminal output uses the same palette where possible: success messages in lime (`\033[38;2;214;249;75m`), errors in a deep coral that doesn't conflict, info in muted grey.

### OG image / social

Lime on ink. `trakdown` wordmark in JetBrains Mono Medium. Optional ASCII-style schematic motif. No photographs, no people, no purple gradients.

## Logo / wordmark

`trakdown` — always lowercase, JetBrains Mono Medium. Optional `▍` cursor-bar prefix in lime when more visual presence is needed. Never use as `Trakdown` or `TrakDown`.
