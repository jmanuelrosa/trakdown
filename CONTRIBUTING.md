# Contributing to trakdown

Thanks for your interest. trakdown is a small, opinionated tool — contributions that align with the [spec](docs/ideas/trakdown.md) and [brand guidelines](docs/marketing/brand.md) are welcome.

## Setup

Prereqs: Node ≥ 22 (exact CI version pinned in [`.nvmrc`](.nvmrc)) and pnpm ≥ 11 (pinned via `packageManager` in [`package.json`](package.json)).

```bash
git clone https://github.com/jmanuelrosa/trakdown.git
cd trakdown
pnpm install
```

The first `pnpm install` runs under the project's strict [`.npmrc`](.npmrc) defaults — most notably `ignore-scripts=true` (install scripts blocked unless the package is in `allowBuilds:` in [`pnpm-workspace.yaml`](pnpm-workspace.yaml)) and `minimum-release-age=1440` (packages must be ≥24h old). These are intentional supply-chain hardening; see the [README](README.md#supply-chain-hardening) for the full list.

## Develop

```bash
pnpm dev:ext     # WXT dev with hot reload (extension)
pnpm dev:web     # Astro dev at http://localhost:4321/trakdown/
pnpm build:ext   # production extension → apps/extension/.output/chrome-mv3/
pnpm build:web   # production landing → apps/web/dist/
pnpm lint        # Biome lint + format check
pnpm lint:fix    # apply Biome's auto-fixes
pnpm format      # format only
```

Load the extension into Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → point at `apps/extension/.output/chrome-mv3/`.

## Architecture pointers

- Big-picture architecture, sandbox quirks, brand discipline → [`CLAUDE.md`](CLAUDE.md)
- Product spec, MVP scope, "Not Doing" list → [`docs/ideas/trakdown.md`](docs/ideas/trakdown.md)
- Brand identity (colors, type, voice) → [`docs/marketing/brand.md`](docs/marketing/brand.md)
- Deploy walkthrough → [`docs/deploy.md`](docs/deploy.md)
- Analytics events → [`docs/analytics.md`](docs/analytics.md)

## Pull request workflow

1. **Open an issue first** for non-trivial changes — sometimes the answer is "this is in the Not Doing list, here's why."
2. Branch from `main`: `feat/short-description`, `fix/short-description`, `chore/short-description`, `docs/...`, or `ci/...`.
3. Run `pnpm lint:fix` locally before pushing — CI fails on lint and format issues.
4. Open a PR; the template prompts for summary + test plan.
5. CI runs in parallel:
   - **`deploy-web.yml`** — `pnpm lint:ci` then `pnpm -F @trakdown/web build` (PRs validate the build; only `push: main` deploys)
   - **`pull_request.yml`** — GitLeaks (secret scan), Bearer (vulnerability scan), Biome lint

All required checks must pass before merge.

## Commit style

- Conventional prefixes: `feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `deps:`. Helps with future changelog generation.
- One logical change per commit. Squash WIP churn before merge.

## Adding dependencies

A few project-specific rules — the strict `.npmrc` makes some of these unavoidable:

- **Bundle size matters** for the extension's content script (currently ~58 kB on `<all_urls>`). Avoid pulling in heavy libraries.
- **Install scripts are blocked by default** (`ignore-scripts=true`). If a new dep runs install scripts (typically packages with native bindings — `sharp`, `esbuild`, etc.), add the package name to `allowBuilds:` in [`pnpm-workspace.yaml`](pnpm-workspace.yaml).
- **`save-exact=true`** — new deps get pinned exactly. No caret ranges in `package.json`.
- **`minimum-release-age=1440`** — freshly published packages can't be installed for 24 hours. Plan accordingly if you need a brand-new release.

## What's out of scope

Before proposing big changes, check the "Not Doing (and Why)" section of [`docs/ideas/trakdown.md`](docs/ideas/trakdown.md). A few items intentionally deferred:

- Firefox / Safari ports
- Read-later or queue features
- Cloud sync or accounts
- A second brand accent color (see brand guidelines)

## Questions

Open a [GitHub Issue](https://github.com/jmanuelrosa/trakdown/issues) — even for vague questions. Better than DMing.
