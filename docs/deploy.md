# Deploy

## Environment variables

The landing page reads one analytics variable. Set it on production deploys; leave it unset and no analytics snippet is injected.

| Name | Example | Required |
|---|---|---|
| `PUBLIC_UMAMI_ID` | `00000000-0000-0000-0000-000000000000` | for analytics |

**Where to set it**: GitHub → repo → *Settings → Secrets and variables → Actions → Variables → New repository variable*. Use a **Variable** (not a Secret) — the value is exposed in the client bundle on purpose; secrets would just leak through the build anyway. Must be prefixed with `PUBLIC_` because Astro/Vite only expose `PUBLIC_*` vars to the client.

**The Umami snippet is only injected when**:

1. The build is a production build (`import.meta.env.PROD === true`) — `astro dev` skips it entirely
2. `PUBLIC_UMAMI_ID` is set

Even when both are true, Umami's tracker is scoped to the canonical domain via the `data-domains` attribute (derived from `astro.config.mjs` → `site` + `base`). Running `astro preview` locally on `localhost` will not send events.

For local development, create `apps/web/.env` (gitignored) with:

```env
PUBLIC_UMAMI_ID=00000000-0000-0000-0000-000000000000
```

The Umami script still won't fire locally because of the production gate — the `.env` file is only useful if you specifically want to test the prod-build path via `pnpm -F @trakdown/web preview`.

## Landing page → GitHub Pages

`apps/web` auto-deploys to GitHub Pages on every push to `main` via [`.github/workflows/deploy-web.yml`](../.github/workflows/deploy-web.yml).

**Live URL:** `https://jmanuelrosa.github.io/trakdown/`

### One-time setup

1. **Enable GitHub Pages from Actions.**
   - GitHub repo → *Settings → Pages*
   - Under *Build and deployment → Source*, choose **GitHub Actions**
   - Don't choose "Deploy from a branch" — we deploy artifacts directly via the Actions workflow.

2. **Add `PUBLIC_UMAMI_ID` repository variable** (only if you want analytics).
   - GitHub repo → *Settings → Secrets and variables → Actions → Variables tab → New repository variable*
   - Name: `PUBLIC_UMAMI_ID`
   - Value: your Umami Cloud website UUID

3. **Push to `main`.** The action builds `apps/web` and publishes to GitHub Pages within a couple of minutes.

### Custom domain (later)

To serve from `trakdown.app` (or any apex / subdomain you own):

1. Buy the domain.
2. Create `apps/web/public/CNAME` with one line: `trakdown.app`.
3. Update `apps/web/astro.config.mjs`:
   ```js
   site: 'https://trakdown.app',
   base: '/',
   ```
4. Configure DNS — CNAME `www` to `jmanuelrosa.github.io`, plus A records for the apex (see [GitHub docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)).
5. GitHub repo → *Settings → Pages → Custom domain*: enter `trakdown.app`. Enable HTTPS once the cert provisions.
6. Update the `Sitemap:` URL in `apps/web/public/robots.txt`.

### What the workflow does

Two jobs, with different scopes per trigger:

| Trigger | `build` job | `deploy` job |
|---|---|---|
| `push` to `main` | runs | runs |
| `pull_request` to `main` | runs (validation only) | skipped |
| `workflow_dispatch` | runs | runs |

Behavior:

- **Path-filtered** to `apps/web/**`, lockfile, root `package.json`, and the workflow file itself — unrelated changes don't trigger builds.
- **Build job** installs deps with frozen lockfile, builds `@trakdown/web` (passing `PUBLIC_UMAMI_ID` from repo variables), and uploads `apps/web/dist` as a Pages artifact. Runs on PRs to catch broken builds before merge.
- **Deploy job** publishes the artifact via `actions/deploy-pages`. Gated to `push` and `workflow_dispatch` events only — PRs never publish. Uses a `concurrency: pages` group so GitHub Pages serial-deploy requirement is respected without blocking PR builds.

PR previews (per-PR live URLs) are **not** included — GitHub Pages doesn't expose them natively. If we want them later we can add a parallel workflow that publishes per-PR builds elsewhere (e.g. Cloudflare Pages preview).

### Troubleshooting

- **`Permission denied (pages: write)`** — the workflow needs `pages: write` and `id-token: write` permissions (already declared). If the deploy fails with auth errors, confirm Settings → Pages → Source is set to **GitHub Actions**.
- **Frozen lockfile error** — run `pnpm install` locally and commit the updated `pnpm-lock.yaml`.
- **404 on assets** — the `base: '/trakdown'` in `astro.config.mjs` must match the repo name exactly. Renaming the repo means updating both `base` and `site` together.
- **Wrong canonical URL in rendered HTML** — check `astro.config.mjs` `site` value and rebuild.

## Extension distribution

`apps/extension` is built locally with `pnpm build:ext` and shipped via GitHub release / Chrome Web Store (not auto-deployed). The output lives in `apps/extension/.output/chrome-mv3/`.
