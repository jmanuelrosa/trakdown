# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

trakdown is a Chrome MV3 extension that captures any web page — including authenticated dashboards behind a login — as clean markdown for AI workflows. Three capture modes (element picker, text selection, full page) plus an opt-in AI Deep Clean using Chrome's on-device Gemini Nano. The repo also hosts the landing page at `apps/web`.

Spec: [`docs/ideas/trakdown.md`](docs/ideas/trakdown.md). Brand: [`docs/marketing/brand.md`](docs/marketing/brand.md). Live URL: `https://jmanuelrosa.github.io/trakdown/`.

## Monorepo layout

pnpm workspaces. Two real apps; `apps/cli/` and `packages/core/` are intentionally not scaffolded (placeholders in `README.md`).

```
apps/extension/    # Chrome MV3 extension (WXT)
apps/web/          # Landing page (Astro 5 + Tailwind v4)
docs/              # Spec, brand, copy, deploy, analytics
```

## Commands

From repo root:

```bash
pnpm install
pnpm dev:ext           # WXT dev (hot reload)
pnpm dev:web           # Astro dev at http://localhost:4321/trakdown/
pnpm build:ext         # → apps/extension/.output/chrome-mv3/
pnpm build:web         # → apps/web/dist/
pnpm build             # build all packages
```

Per-package scripts (`apps/extension/`, `apps/web/`): `dev`, `build`, plus `zip` (extension) and `preview` + `check` (web).

There is no test runner and no linter wired up — adding them is fine but no existing config to honor.

## Extension architecture

WXT-based MV3 extension. Path alias: `@/` resolves to `apps/extension/` (WXT default — library files live at `apps/extension/lib/`, **not** under a `src/` subdir).

**Capture flow:**
- Popup sends `{ type: 'trakdown:capture', mode }` via `chrome.tabs.sendMessage` to the active tab's content script.
- For **synchronous modes** (`page`, `selection`): content script returns the markdown, popup writes the clipboard and shows status.
- For **autonomous modes** (`element`, `page-ai`): content script returns `pending: true` immediately so the popup closes; content script then runs the work, writes the clipboard, and shows an **on-page toast** (since the popup is gone by then).

This "fire and forget" pattern is load-bearing — the picker waits for user interaction and the AI mode takes 2–5 seconds; both outlast the popup's lifetime.

**Picker, selection, and Readability all flow through the same Turndown + GFM singleton** (`lib/markdown.ts`). AI Deep Clean adds a `lib/preclean.ts` step that aggressively strips DOM noise before feeding to `LanguageModel` (Chrome's Prompt API).

**Keyboard shortcut**: `background.ts` listens for `chrome.commands.onCommand` (default `⌘⇧K` / `Ctrl+Shift+K` → activate picker) and forwards the message to the active tab.

## Web architecture

Astro 5 with Tailwind v4 via `@tailwindcss/vite`. CSS-first config — design tokens live in `apps/web/src/styles/global.css` inside `@theme`. No `tailwind.config.{js,ts}` file.

**Base path quirk.** `astro.config.mjs` sets `base: '/trakdown'` for GitHub Pages. Astro 5 returns `BASE_URL` *without* a trailing slash, so any string concatenation needs normalization:

```ts
const baseRaw = import.meta.env.BASE_URL;
const base = baseRaw.endsWith("/") ? baseRaw : `${baseRaw}/`;
```

When adding new asset references (favicon, og-image, sitemap, internal links), use the normalized form. The sitemap endpoint at `src/pages/sitemap.xml.ts` does this manually and is `prerender = true` so it ships as a static file.

**SEO.** `Base.astro` injects `SoftwareApplication` and `WebSite` JSON-LD. `FAQ.astro` and `HowItWorks.astro` self-contain their own `FAQPage` / `HowTo` JSON-LD blocks. `public/robots.txt`, `public/llms.txt`, and the generated sitemap reference the live URL.

**Analytics.** Umami Cloud, env-gated through *two* layers:
1. `import.meta.env.PROD === true` (script not injected during `astro dev`)
2. `data-domains={site.hostname}` on the script tag (Umami's own tracker filters by hostname)

`UMAMI_WEBSITE_ID` is a repo *Variable* (not Secret — the website ID is rendered into the page HTML, not a credential). Read in `Base.astro` frontmatter via `import.meta.env.UMAMI_WEBSITE_ID` — that runs server-side during build, so no `PUBLIC_` prefix is needed (the value lands in static HTML, not the client JS bundle). Click events use Umami's `data-umami-event` attribute auto-discovery; scroll-depth and section-view events live in `apps/web/src/components/Analytics.astro`. Each major `<section>` carries a `data-section` attribute that the IntersectionObserver reads.

## Brand — locked, do not regress

Full spec: `docs/marketing/brand.md`.

- **Surface:** warm cream `#FBF7EE` (`oklch(97% 0.012 85)`).
- **Brand:** deep teal `#0F8B7E` (`oklch(54% 0.09 188)`). Used for CTAs, picker overlay, links.
- **Type:** JetBrains Mono (display + UI + code) + Manrope (body). Mono headlines are intentional.
- **One chromatic accent.** Do not introduce a second saturated color or gradient.
- **The picker overlay (extension) and the install CTA bg (web) use the same teal.** Brand = product action — keep them in sync.

**Rejected directions — do not re-propose:**
- Fraunces + Source Serif + terracotta + paper (editorial — felt too literary)
- Lime `#D6F94B` on light surface (insufficient lightness contrast)
- Lime on dark surface (read as "black-and-white hacker")
- FOSSA-centric copy framing (broadened to "the dashboards behind your login")

## Sandbox / agent caveats specific to this repo

When operating inside Claude Code's sandbox:

- **`pnpm install` is unreliable.** Cannot write `pnpm-lock.yaml`; sometimes fails copying `.gitmodules` into nested `node_modules/.pnpm/*_tmp_*/` paths. Workflow: edit `apps/*/package.json`, then ask the user to run `! pnpm install` themselves.
- **`.env*` writes are denied** (including `.env.example`). Document env vars in `docs/deploy.md`.
- **`.git/config` writes are denied** — `git remote add`, `git config`, and similar must be run by the user.
- **`.git/hooks/` creation is blocked** — fresh `git init` from inside the sandbox produces a corrupt repo. The user has to handle initial `rm -rf .git && git init`.
- **Project-local pnpm store** at `.pnpm-store/` (set in `.npmrc`) to avoid the global `~/.pnpm-store` symlink the sandbox can't create.

## Deploy

`.github/workflows/deploy-web.yml` deploys `apps/web` to GitHub Pages on push to `main`. Requires repo *Variables* → `UMAMI_WEBSITE_ID` (only if analytics is wanted) and Settings → Pages → Source set to "GitHub Actions". Walkthrough in `docs/deploy.md`.

Extension has no auto-deploy — built locally with `pnpm build:ext` and shipped via GitHub release / Chrome Web Store.

## Things to check before doing

- **Changing the GitHub Pages base path** — touches `astro.config.mjs`, `Base.astro`, `Hero.astro`, `sitemap.xml.ts`, `public/robots.txt`, `public/llms.txt`. Easy to miss one.
- **Adding a new dependency** — sandbox quirks make `pnpm install` painful. Bundle size on the extension content script matters (currently ~58 kB; Readability + Turndown + picker + AI extract logic).
- **Adding a second brand accent color** — `docs/marketing/brand.md` explicitly forbids this. Re-read before proposing.
