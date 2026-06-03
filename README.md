# trakdown

Capture web pages and DOM regions as clean markdown — for AI consumption, from authenticated pages, with no copy-paste mangling.

Free, MIT-licensed. If trakdown earns a spot in your workflow, you can sponsor at [github.com/sponsors/jmanuelrosa](https://github.com/sponsors/jmanuelrosa) — entirely optional.

## Monorepo layout

```
apps/
  extension/    # Chrome MV3 extension (WXT)
  web/          # Landing page (Astro)
  cli/          # (planned) Playwright-based CLI for non-auth pages
packages/
  core/         # (planned) shared HTML→markdown engine
```

## Requirements

- **Node ≥ 22** — exact CI version pinned in [`.nvmrc`](.nvmrc)
- **pnpm ≥ 11** — declared via `packageManager` and `engines` in [`package.json`](package.json)

## Develop

```bash
pnpm install

pnpm dev:ext       # WXT dev with hot reload (extension)
pnpm dev:web       # Astro dev server (landing page)

pnpm build         # build all packages
pnpm build:ext     # extension → apps/extension/.output/chrome-mv3/
pnpm build:web     # landing → apps/web/dist/

pnpm lint          # Biome lint + format check
pnpm lint:fix      # apply Biome's auto-fixable issues
pnpm format        # format only
```

Load the extension into Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → point at `apps/extension/.output/chrome-mv3/`.

## Deploy

The landing page (`apps/web`) auto-deploys to GitHub Pages on push to `main` via [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml). Live at <https://jmanuelrosa.github.io/trakdown/>. One-time setup steps are documented in [`docs/deploy.md`](docs/deploy.md).

The extension (`apps/extension`) is built locally with `pnpm build:ext` and shipped via GitHub release / Chrome Web Store (no auto-deploy).

## Analytics

Privacy-friendly visit and event tracking via Umami — see [`docs/analytics.md`](docs/analytics.md) for the event list and how to add more. The analytics snippet only loads on production builds when `UMAMI_WEBSITE_ID` is set, and is domain-scoped via `data-domains`.

## Supply-chain hardening

This repo's `.npmrc` enforces strict install defaults:

- `ignore-scripts=true` — package install scripts (`postinstall`, etc.) are **blocked by default**. Allow specific packages via `allowBuilds:` in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) (currently: `esbuild`, `sharp`, `spawn-sync`)
- `min-release-age=3` (days) — only install packages published ≥72 hours ago (mitigates fast-moving supply-chain attacks). Mirrored as `minimumReleaseAge: 4320` (minutes) in [`pnpm-workspace.yaml`](pnpm-workspace.yaml)
- `block-exotic-subdeps=true` — refuse transitive deps from non-registry sources (git, tarballs, `file:`); also enforced via `blockExoticSubdeps: true` in [`pnpm-workspace.yaml`](pnpm-workspace.yaml)
- `save-exact=true` — no caret ranges in `package.json`
- `trust-policy=no-downgrade` — refuse to install older versions
- `node-options="--permission"` — Node's permission model enabled during install

When adding a new dependency that needs install scripts (typically packages with native bindings), add the package name to `allowBuilds:` in `pnpm-workspace.yaml`.

## CI

Two workflows under `.github/workflows/`:

- **`deploy-web.yml`** — builds + deploys `apps/web` to GitHub Pages. Runs lint → build → deploy. PR triggers run lint + build only.
- **`pull_request.yml`** — PR-only security and lint gates: GitLeaks (secret detection), Bearer (vulnerability scan), Biome lint.

Both use a shared composite action at `.github/actions/setup-node/` for the install step.

Dependabot is configured in [`.github/dependabot.yml`](.github/dependabot.yml) in security-alerts-only mode — no routine version-update PRs, but Dependabot Alerts on the Security tab still fire for advisories.

## Status

v0 — Chrome only. Shipping today:

- **Capture modes**: element picker (`⌘⇧K`), text selection (`⌘⇧J`), full page (`⌘⇧Y`), and AI Deep Clean (`⌘⇧U` — opt-in, requires Chrome 138+ with on-device Gemini Nano enabled). Shortcuts are rebindable at `chrome://extensions/shortcuts`.
- **Output**: clipboard (default) or `.md` download, toggled in the popup and persisted.
- **Popup**: mode selector, destination toggle, "Include frontmatter" checkbox, AI availability hint, and a recap of the last capture (mode, time, char count, title, 2-line excerpt).
- **Frontmatter**: every capture starts with YAML containing title, source URL, domain, timestamp, word count, and excerpt — toggleable from the popup for users who want raw body only.

Next up: Chrome Web Store listing, and the Playwright-based CLI for public pages (`apps/cli/`, deferred to v0.x).
