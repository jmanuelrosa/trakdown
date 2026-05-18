# Analytics

The landing page uses **Umami Cloud** for privacy-friendly analytics. Setup is env-driven (one variable: `UMAMI_WEBSITE_ID`) — see [`docs/deploy.md`](./deploy.md).

**Local / preview traffic is excluded by two layers:**

1. The Umami `<script>` is only injected when `import.meta.env.PROD === true`. The dev server (`pnpm dev:web`) never loads Umami at all.
2. The script tag carries `data-domains` derived from the canonical `site` URL in `astro.config.mjs`. If the script ever does load on a non-matching host (e.g. `astro preview` on `localhost`), Umami's tracker checks `window.location.hostname` before sending and bails on mismatch.

## What is tracked

### Built-in (Umami default — no custom event needed)

- **Pageviews** — visits to `/` and any other path
- **Referrers** — where the visitor came from
- **Time on page** — pageview duration
- **Country / browser / OS** — visitor metadata

### Custom events

| Event | Triggered by | Properties |
|---|---|---|
| `install_click` | Either "Install for Chrome" button | `location`: `hero` \| `final-cta` |
| `github_click` | Any GitHub link | `location`: `nav` \| `final-cta` \| `footer` \| `footer-credit` \| `issues` \| `roadmap` \| `license` |
| `demo_click` | "See it in action →" button (hero) | — |
| `nav_click` | Header nav links (How it works / FAQ) | `target`: `how` \| `faq` |
| `scroll_depth` | User scrolls past 25/50/75/100% of page (each fires once per session) | `depth`: `25` \| `50` \| `75` \| `100` |
| `section_view` | A page section enters the viewport (each fires once per session) | `section`: `hero` \| `demo` \| `proof` \| `problem` \| `how` \| `benefits` \| `comparison` \| `faq` \| `install` |
| `engaged_time` | The visitor actively engages (tab visible + interacted in last 30s) for 60s or 180s — each fires once per session | `seconds`: `60` \| `180` |
| `faq_view` | An individual FAQ question enters the viewport — once per question per session | `question`: slug of the question text (e.g. `why-a-chrome-extension-and-not-a-cli`) |

## Implementation

- **Click events** use Umami's auto-discovery via `data-umami-event` and `data-umami-event-*` attributes — no custom JS for these.
- **Scroll + section events** are fired from [`apps/web/src/components/Analytics.astro`](../apps/web/src/components/Analytics.astro) using `IntersectionObserver` and a passive scroll listener with `requestAnimationFrame` debouncing.
- Both rely on `window.umami?.track(...)` with optional chaining — if Umami isn't loaded (env vars missing), the tracking calls noop.

## How to answer the questions you actually care about

| Question | Where to look |
|---|---|
| Are people finding the site? | Pageviews + referrers |
| Are install CTAs working? | `install_click` event, segmented by `location` |
| Which CTA position converts better — hero or final? | Compare `install_click` counts by `location` |
| Are people reading or bouncing? | `scroll_depth` distribution (% reaching 50, 75, 100) |
| Are visitors actually engaging (not just leaving a tab open)? | `engaged_time` event — ratio of `seconds: 60` to `seconds: 180` shows whether the page holds attention past the first minute |
| Where do people drop off? | `section_view` funnel from `hero` down to `install` |
| Which FAQ objections matter most? | `faq_view` event, segmented by `question` |
| Is the developer audience showing serious interest? | `github_click` total count |

## Not tracked (and why)

- **Per-row comparison-table view** — every visitor scrolls past all rows; ~5 events per visitor with no signal
- **Hover / mouseover events** — almost always noise
- **Pageview duration as custom event** — Umami tracks this natively; `engaged_time` is the active-engagement version

## Adding a new event

Two paths:

**For clicks on elements:**
```astro
<a href="..." data-umami-event="event_name" data-umami-event-some-prop="value">
  Click me
</a>
```

**For everything else (scroll, time, IntersectionObserver, etc.):**
Edit `apps/web/src/components/Analytics.astro` and call `track(name, props)` (already defined locally with the `window.umami?.track()` noop-safe wrapper).
