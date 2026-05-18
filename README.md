# trakdown

Capture web pages and DOM regions as clean markdown — for AI consumption, from authenticated pages, with no copy-paste mangling.

Spec: [`docs/ideas/trakdown.md`](docs/ideas/trakdown.md)

## Monorepo layout

```
apps/
  extension/    # Chrome MV3 extension (WXT)
  web/          # Landing page (Astro)
  cli/          # (planned) Playwright-based CLI for non-auth pages
packages/
  core/         # (planned) shared HTML→markdown engine
```

## Develop

```bash
pnpm install

pnpm dev:ext     # WXT dev with hot reload
pnpm dev:web     # Astro dev server

pnpm build       # build all packages
pnpm build:ext   # build only the extension
pnpm build:web   # build only the web app
```

## Deploy

The landing page (`apps/web`) auto-deploys to GitHub Pages on push to `main` via [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml). Live at `https://jmanuelrosa.github.io/trakdown/`. One-time setup steps are documented in [`docs/deploy.md`](docs/deploy.md).

The extension (`apps/extension`) is built locally with `pnpm build:ext` and shipped via GitHub release / Chrome Web Store (not auto-deployed).

## Analytics

Privacy-friendly visit and event tracking via Umami — see [`docs/analytics.md`](docs/analytics.md) for the event list and how to add more.

## Status

v0 — element picker, text selection, and full-page capture modes. Chrome only.
