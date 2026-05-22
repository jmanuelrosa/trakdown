# Security policy

## Supported versions

Only the latest release is supported. trakdown is in active v0 development; there is no LTS branch.

| Version | Supported |
|---|---|
| Latest `main` | ✅ |
| Tagged releases (when published) | ✅ — most recent only |
| Older tags | ❌ |

## Reporting a vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

Use [GitHub's private vulnerability reporting](https://github.com/jmanuelrosa/trakdown/security/advisories/new) — the report stays private between you and the maintainer until a fix is shipped.

Include:

- A clear description of the issue
- Steps to reproduce
- The affected component (extension / landing page / CI)
- Any proof-of-concept code or payload
- Your assessed severity (CVSS 3.1 if you have it)

## Response expectations

trakdown is maintained by one person on personal time. Reasonable expectations:

- **Acknowledgement** of the report within 5 business days
- **Initial assessment** within 14 days
- **Fix or mitigation** timeline depends on severity — critical and high are blockers, medium and low are scheduled

You will be kept in the loop until the fix is published.

## Scope

**In scope:**

- The Chrome extension (`apps/extension`) — element picker, capture flows, AI Deep Clean, clipboard handling, permissions usage
- The landing page (`apps/web`, served at <https://jmanuelrosa.github.io/trakdown/>)
- The build / deploy CI workflows under `.github/`

**Out of scope:**

- Vulnerabilities in upstream dependencies — please report to the upstream maintainer; we will bump on advisory disclosure
- Social engineering, physical attacks, or non-technical issues
- Theoretical issues without a clear exploit path
- Issues in browsers, the operating system, or Chrome's on-device AI runtime

## What trakdown does *not* collect

For context when evaluating attack surface:

- No accounts, no remote API, no server — the extension runs entirely in-browser
- Page content captured by the extension never leaves the user's machine
- The landing page uses Umami Cloud only when `UMAMI_WEBSITE_ID` is configured; even then no personal data is collected and tracking is scoped to the canonical domain via `data-domains`

## Supply-chain controls already in place

trakdown's [`.npmrc`](.npmrc) and [`pnpm-workspace.yaml`](pnpm-workspace.yaml) enforce strict install-time defaults to limit supply-chain attack surface:

- `ignore-scripts=true` — package install scripts blocked by default; per-package opt-in via `allowBuilds:` in [`pnpm-workspace.yaml`](pnpm-workspace.yaml)
- `min-release-age=3` (days) — packages must be ≥72h old before they install (mitigates fast-moving package compromises); mirrored as `minimumReleaseAge: 4320` (minutes) in [`pnpm-workspace.yaml`](pnpm-workspace.yaml)
- `save-exact=true` and `trust-policy=no-downgrade` — pinned, monotonic versions
- `block-exotic-subdeps=true` — refuses transitive dependencies from non-registry sources (git, tarballs, `file:`)
- `node-options="--permission"` — Node's permission model is enabled during install

In addition:

- **[Socket](https://socket.dev/)** monitors every pull request that touches `package.json` / `pnpm-lock.yaml`, flagging newly-introduced packages with risky behavior (install scripts, network access, obfuscated code, typosquats, suspicious maintainer changes) directly on the PR before merge
- **GitLeaks** + **Bearer** scans run on every PR via [`.github/workflows/pull_request.yml`](.github/workflows/pull_request.yml)
- **Dependabot Alerts** surface upstream advisories ([`.github/dependabot.yml`](.github/dependabot.yml) runs in security-alerts-only mode)

## Acknowledgements

trakdown does not currently offer a bug bounty. Reporters who follow this policy will be credited in the changelog with their consent once the fix is published.
