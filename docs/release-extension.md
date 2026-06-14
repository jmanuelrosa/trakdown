# Release the extension

The Chrome MV3 extension lives at `apps/extension/`. Releases go to the Chrome Web Store via manual upload to the developer console. The Publisher API is available but isn't worth wiring up until the release cadence justifies it.

## One-time setup

Owner-side, not in the repo:

1. **Create a Chrome Web Store developer account.**
   - https://chrome.google.com/webstore/devconsole
   - One-time $5 registration fee, paid with the Google account that will own the listing.
   - Identity verification can take a day or two on first signup. The first item submission unlocks faster after that.

2. **Confirm the listing copy is current.**
   - All strings live in [`docs/marketing/chrome-web-store.md`](./marketing/chrome-web-store.md). If product positioning changed, update that file first.

3. **Capture screenshots** (only once, then reuse across releases).
   - Checklist and dimensions are in `chrome-web-store.md`.
   - Store them at `docs/marketing/screenshots/cws-*.png` so the next release can reuse the same set.

## Per-release

1. **Bump the version.** Edit `apps/extension/package.json` `"version"` field. WXT inherits this into `manifest.version` at build time. Use the same x.y.z scheme as the CLI; bump on every submission (CWS rejects re-submitting the same version number).

2. **Build the zip.**
   ```bash
   pnpm install
   pnpm -F @trakdown/extension build
   pnpm -F @trakdown/extension zip
   ```
   Output: `apps/extension/.output/<package-name>-<version>-chrome.zip` (WXT's default zip name).

3. **Sanity-check the zip.** Open `manifest.json` inside the zip and confirm:
   - `"version"` matches the package.json bump from step 1.
   - `"permissions"` is exactly `["activeTab", "clipboardWrite", "offscreen", "storage"]`.
   - `"name"` is `"trakdown"`.

4. **Upload.**
   - https://chrome.google.com/webstore/devconsole
   - First release: "Add new item" → upload the zip.
   - Subsequent releases: open the existing item → "Package" tab → upload the new zip.

5. **Fill (or update) the listing fields** from `docs/marketing/chrome-web-store.md`:
   - Name, summary, detailed description.
   - Category: Productivity. Language: English.
   - Single purpose statement.
   - Each permission justification.
   - Remote code: No.
   - Data privacy disclosures matrix and three certification checkboxes.
   - Homepage URL, privacy policy URL, support URL.
   - Screenshots (only needed on first submission and when adding shots; reusable across version bumps).

6. **Submit for review.**
   - First-ever submission: review can take days to weeks. Plan accordingly.
   - Updates after the first approval: typically reviewed within a day or two.

7. **After approval.**
   - Copy the public listing URL.
   - Update the install CTA in `apps/web/src/components/Hero.astro` and any README badge so it points at the real store entry instead of "load unpacked".
   - Tag the release in git for traceability:
     ```bash
     git tag extension-v<version>
     git push --tags
     ```
     (No workflow fires on `extension-v*` yet; the tag is purely for history.)

## Why the permission list is what it is

The manifest deliberately lists only four permissions, all narrow:

- `activeTab` — read DOM of the tab the user invoked the capture on. Strictly user-initiated. No host permissions or broad URL matches.
- `storage` — three keys in `chrome.storage.local`: `destination`, `include_frontmatter`, `last_capture`. No sync, no remote storage.
- `clipboardWrite` — writes the captured markdown when clipboard is the destination. No clipboard reads.
- `offscreen` — runs DOM parsing and Readability extraction in an offscreen document so the popup can close instantly. No network use.

There is no `scripting` permission because the content script is statically registered by WXT, not dynamically injected. There are no host permissions because `activeTab` covers the user-initiated capture flow.

If a future feature needs a new permission, add it here with a one-line justification before the manifest change lands. CWS review tracks permission additions release-over-release.

## When to consider automation

The Chrome Web Store Publisher API exists and supports `chrome-webstore-upload` style flows from CI. Worth wiring up only when at least two of these are true:

- We push more than one extension release a month.
- The same zip needs to ship to multiple stores (Edge, Firefox).
- We have a real changelog generation pipeline we'd want to chain into the release.

Until then, the manual flow above is faster than the OAuth refresh-token setup the API needs.
