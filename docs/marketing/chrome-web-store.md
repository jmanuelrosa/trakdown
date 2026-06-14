# Chrome Web Store listing

Everything the developer console asks for, ready to paste. Update this file when copy changes; the dev console form is just a mirror.

The submission walkthrough lives in [`docs/release-extension.md`](../release-extension.md).

## Name

```
trakdown
```

## Summary (≤ 132 chars)

```
Capture any web page as clean markdown for AI workflows. Picker, selection, or full page. Works on auth-walled pages.
```

## Category

Productivity.

## Language

English (default). No other locales yet.

## Detailed description

> Pasted into the "Description" field of the dev console. Plain text; CWS doesn't render markdown. Keep paragraphs short, use blank lines to break sections.

```
trakdown turns the web page you're looking at into clean markdown you can hand to an LLM. Pick any element, select any text, or grab the full page. Output is structured: tables stay tables, code blocks stay fenced, lists nest, source URL is preserved at the top.

It works on pages behind a login. The extension runs in your already-logged-in browser tab, so dashboards, internal tools, and customer admin panels capture the same way public pages do.

Capture modes
- Picker: hover any element, arrow keys to resize the selection, click to capture.
- Selection: highlight a passage, run the shortcut, get just that range.
- Full page: Readability-based main-content extraction with a raw HTML fallback.
- AI Deep Clean (optional): the pre-cleaned DOM passes through Chrome's on-device Gemini Nano for a tighter result. Runs locally, no network call.

Output goes to your clipboard or your Downloads folder, set via the popup toggle. Each capture can include a YAML frontmatter header (source URL, title, captured-at timestamp, language, author) or be raw body only.

Keyboard shortcuts: ⌘⇧K picks an element, ⌘⇧J captures the selection, ⌘⇧Y grabs the full page, ⌘⇧U runs AI Deep Clean. Rebind any of them at chrome://extensions/shortcuts.

Privacy
- Page content never leaves your machine. No trakdown server, no third-party API, no analytics ping carrying what you captured.
- Three preferences are saved in chrome.storage.local: destination, frontmatter toggle, and a 180-character preview of your last capture (so the popup can show what you grabbed last).
- AI Deep Clean uses Chrome's built-in Gemini Nano, on-device.

Full privacy policy: https://jmanuelrosa.github.io/trakdown/privacy
Source: https://github.com/jmanuelrosa/trakdown
License: MIT
```

## Single purpose statement

> CWS-required, plain English, single sentence.

```
Capture any web page, region, or selection as clean markdown for AI workflows.
```

## Permission justifications

> One short paragraph per permission. CWS asks for these inline on the listing form. Stay specific — vague justifications get rejected.

### `activeTab`

```
Lets trakdown read the DOM of the tab the user just invoked a capture on. The extension never touches a page until the user explicitly triggers one of the four capture modes (picker, selection, full page, AI page). No background reads, no broad host permissions.
```

### `storage`

```
Stores three small preferences in chrome.storage.local: the chosen destination (clipboard or download), whether captures include a YAML frontmatter header, and a 180-character preview of the last capture for the popup recap card. No remote storage. No syncing across devices.
```

### `clipboardWrite`

```
Writes the captured markdown to the user's clipboard when "clipboard" is the chosen destination. The extension never reads the clipboard.
```

### `offscreen`

```
Used to run DOMParser and Readability extraction in an offscreen document so the popup can close immediately without losing the in-flight capture. The picker and AI modes can take several seconds; the popup's lifecycle is too short for that work. The offscreen document does no network requests.
```

## Remote code

> CWS asks: "Does your extension execute or load remote code?"

**No.** All JavaScript ships inside the bundle. AI Deep Clean uses Chrome's built-in `LanguageModel` API (Gemini Nano), which is part of the browser, not remote code.

## Data privacy disclosures

> CWS has a Data Privacy tab with a matrix of data types and three certification checkboxes. Mark every data-type row as **not collected**.

| Data type | Collected? |
|---|---|
| Personally identifiable information | No |
| Health information | No |
| Financial / payment information | No |
| Authentication information | No |
| Personal communications | No |
| Location | No |
| Web history | No |
| User activity | No |
| Website content | No (captured markdown stays on-device; clipboard / Downloads are user destinations, not collection) |

Three certifications, all **TRUE**:

- I do not sell or transfer user data to third parties, apart from the approved use cases.
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## URLs to paste in the form

- Homepage URL: `https://jmanuelrosa.github.io/trakdown/`
- Privacy policy URL: `https://jmanuelrosa.github.io/trakdown/privacy`
- Support URL: `https://github.com/jmanuelrosa/trakdown/issues`

## Screenshots

> CWS requires at least one, allows up to five. Format: PNG, 1280×800 or 640×400. The first three are the minimum useful set; the fourth is optional polish.

| # | Shot | Caption (≤ 76 chars) |
|---|---|---|
| 1 | Picker hover state — teal overlay on a real page element | Pick any element. Arrow keys resize the selection. |
| 2 | Popup open showing destination + frontmatter toggles + last-capture card | Clipboard or download. Frontmatter optional. Your call. |
| 3 | The resulting markdown in an editor (Obsidian / VS Code / a code block) | Clean markdown. Tables, code, lists, source URL preserved. |
| 4 (optional) | Capture toast on-page after a keyboard shortcut fires | ⌘⇧K, capture in flight, no popup needed. |

Capture them from a freshly built extension load (`pnpm -F @trakdown/extension build`, load unpacked from `apps/extension/.output/chrome-mv3/`). Use a public page so the screenshots don't leak anything from your own dashboards.

Save them next to this file as `docs/marketing/screenshots/cws-1.png` … `cws-4.png` so future versions of this listing can reuse the same set.

## Promotional tile

Optional. Skip until we have a designer pass. The CWS listing renders fine without one.
