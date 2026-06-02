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
docs/              # Spec, brand, deploy, analytics
```

## Requirements

- **Node**: version pinned in `.nvmrc` (currently `v24.13.0`). Engines field requires `>= 22`.
- **pnpm**: pinned via `packageManager` (`pnpm@11.1.2`). Engines field requires `>= 11`.

## Commands

From repo root:

```bash
pnpm install
pnpm dev:ext           # WXT dev (hot reload)
pnpm dev:web           # Astro dev at http://localhost:4321/trakdown/
pnpm build:ext         # → apps/extension/.output/chrome-mv3/
pnpm build:web         # → apps/web/dist/
pnpm build             # build all packages
pnpm lint              # Biome lint + format check (uses biome.json)
pnpm lint:fix          # apply Biome's auto-fixable issues
pnpm lint:ci           # `biome ci` (CI-tuned variant — used by GitHub Actions)
pnpm format            # format only
```

Per-package scripts (`apps/extension/`, `apps/web/`): `dev`, `build`, plus `zip` (extension) and `preview` + `check` (web).

There is no test runner. Linting + formatting is handled by **Biome 2.x** (`biome.json` at the repo root). `.astro` files are intentionally excluded — Astro's own tooling handles them while Biome's Astro support stabilises.

## Extension architecture

WXT-based MV3 extension. Path alias: `@/` resolves to `apps/extension/` (WXT default — library files live at `apps/extension/lib/`, **not** under a `src/` subdir).

**Capture flow:**
- Popup sends `{ type: 'trakdown:capture', mode }` via `chrome.tabs.sendMessage` to the active tab's content script.
- For **synchronous modes** (`page`, `selection`): content script returns the markdown, popup writes the clipboard and shows status.
- For **autonomous modes** (`element`, `page-ai`): content script returns `pending: true` immediately so the popup closes; content script then runs the work, writes the clipboard, and shows an **on-page toast** (since the popup is gone by then).

This "fire and forget" pattern is load-bearing — the picker waits for user interaction and the AI mode takes 2–5 seconds; both outlast the popup's lifetime.

**Picker, selection, and Readability all flow through the same Turndown + GFM singleton** (`lib/markdown.ts`). AI Deep Clean adds a `lib/preclean.ts` step that aggressively strips DOM noise before feeding to `LanguageModel` (Chrome's Prompt API).

**Keyboard shortcuts**: `wxt.config.ts` declares four `chrome.commands` — `capture-element` (`⌘⇧K`), `capture-selection` (`⌘⇧J`), `capture-page` (`⌘⇧Y`), `capture-page-ai` (`⌘⇧U`). `background.ts` listens for `chrome.commands.onCommand` and forwards the matching message to the active tab. Users rebind in `chrome://extensions/shortcuts`.

**Persisted popup state** (`chrome.storage.local`):
- `destination` — `clipboard` or `download`. Set in the popup toggle, read by the content-script `deliver()` so the keyboard-shortcut and popup paths agree.
- `last_capture` — `{mode, source, destination, url, domain, title, excerpt (180 chars), charCount, capturedAt}`. Written by `lib/last-capture.ts` after every successful deliver; read on popup open to render the recap card under the status line. Bounded excerpt size keeps the stored payload tiny — page content never leaves the machine.

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

## CI / GitHub Actions

Two workflows in `.github/workflows/`:

- **`deploy-web.yml`** — builds + deploys `apps/web` to GitHub Pages. Pipeline: composite-setup → `pnpm lint:ci` → `pnpm -F @trakdown/web build` → `actions/upload-pages-artifact` → `actions/deploy-pages`. Deploy job is gated on `push: main` or `workflow_dispatch`; PR triggers run build only.
- **`pull_request.yml`** — three parallel PR-only jobs: GitLeaks (secret scan, needs `fetch-depth: 0`), Bearer (vulnerability scan; critical/high fails, medium/low warns), and Biome lint via `pnpm lint:ci`.

Shared composite action at `.github/actions/setup-node/action.yml` handles install: `pnpm/action-setup@v4` (reads pnpm version from `packageManager`) → `actions/setup-node@v4` (reads Node from `.nvmrc`) → `pnpm install --frozen-lockfile`. **Composite actions require `shell: bash` on every `run:` step** — easy to forget, breaks at runtime if missed.

Dependabot config in `.github/dependabot.yml` runs in security-alerts-only mode (`open-pull-requests-limit: 0`). No routine version-update PRs but Dependabot Alerts on the Security tab still surface advisories. The npm ecosystem uses `directory: "/"` (single root entry — pnpm workspaces share one lockfile); github-actions has two separate entries (one for workflows, one for the composite action).

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

## Supply-chain hardening (`.npmrc` + `pnpm-workspace.yaml`)

Strict pnpm defaults are split across two files — be aware before adding deps:

- `ignore-scripts=true` (`.npmrc`) — install scripts (`postinstall`, `preinstall`, etc.) are **blocked by default**. To allow a specific package, add it to `allowBuilds:` in `pnpm-workspace.yaml`. Currently allowed: `esbuild`, `sharp`, `spawn-sync`.
- `min-release-age=3` (`.npmrc`, days) — packages must be ≥72h old before they install. Mitigates fast-moving supply-chain attacks; means a freshly published version can't be installed for three days. Mirrored in `pnpm-workspace.yaml` as `minimumReleaseAge: 4320` (minutes) — keep both in sync if you change one.
- `block-exotic-subdeps=true` (`.npmrc`) — pnpm refuses transitive deps from non-registry sources (git, tarballs, `file:`). Also enforced in `pnpm-workspace.yaml` as `blockExoticSubdeps: true`.
- `save-exact=true` (`.npmrc`) — `package.json` entries are pinned exactly (no `^` or `~`).
- `trust-policy=no-downgrade` (`.npmrc`) + `trustPolicy: no-downgrade` (`pnpm-workspace.yaml`) — pnpm refuses to install older versions over newer ones.
- `node-options="--permission"` (`.npmrc`) — Node's permission model is enabled during install.
- `store-dir=.pnpm-store` (`.npmrc`) — project-local pnpm store (sandbox workaround; see "Sandbox / agent caveats").
- `dangerouslyAllowAllBuilds: false` (`pnpm-workspace.yaml`) — belt-and-braces guard against accidentally re-enabling install scripts globally.

When proposing a new dep:
1. Check if it has install scripts (native bindings, `esbuild`, `sharp`, etc.). If yes, add to `allowBuilds:` in `pnpm-workspace.yaml`.
2. The version installed will be the latest one published ≥72h ago.

## Sandbox / agent caveats specific to this repo

When operating inside Claude Code's sandbox:

- **`pnpm install` is unreliable.** Cannot write `pnpm-lock.yaml`; sometimes fails copying `.gitmodules` into nested `node_modules/.pnpm/*_tmp_*/` paths. Workflow: edit `apps/*/package.json`, then ask the user to run `! pnpm install` themselves.
- **`.env*` writes are denied** (including `.env.example`). Document env vars in `docs/deploy.md`.
- **`.git/config` writes are denied** — `git remote add`, `git config`, `git push` over SSH all fail. The user has to run those.
- **`.git/hooks/` creation is blocked** — fresh `git init` from inside the sandbox produces a corrupt repo. The user has to handle initial `rm -rf .git && git init`.
- **Project-local pnpm store** at `.pnpm-store/` (set in `.npmrc`) to avoid the global `~/.pnpm-store` symlink the sandbox can't create.

## Deploy

`.github/workflows/deploy-web.yml` deploys `apps/web` to GitHub Pages on push to `main`. Requires repo *Variables* → `UMAMI_WEBSITE_ID` (only if analytics is wanted) and Settings → Pages → Source set to "GitHub Actions". Walkthrough in `docs/deploy.md`.

Extension has no auto-deploy — built locally with `pnpm build:ext` and shipped via GitHub release / Chrome Web Store.

## Things to check before doing

- **Changing the GitHub Pages base path** — touches `astro.config.mjs`, `Base.astro`, `Hero.astro`, `sitemap.xml.ts`, `public/robots.txt`, `public/llms.txt`. Easy to miss one.
- **Adding a new dependency** — sandbox quirks make `pnpm install` painful. If the dep has install scripts, add to `allowBuilds:` in `pnpm-workspace.yaml`. Bundle size on the extension content script matters (currently ~58 kB; Readability + Turndown + picker + AI extract logic).
- **Adding a second brand accent color** — `docs/marketing/brand.md` explicitly forbids this. Re-read before proposing.
- **Adding a `run:` step to the composite action** — must include `shell: bash` (composite actions require it; regular workflows don't).
