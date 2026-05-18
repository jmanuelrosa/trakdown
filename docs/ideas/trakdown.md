# trakdown

## Problem Statement
How might we extract content from authenticated web pages — where the vendor's
own CLI can't reach — into clean markdown, so it can be fed to any AI tool
without copy/paste mangling structure?

## Recommended Direction
A single Chrome extension. Three capture modes:

1. **Element picker** (primary): activate the extension, hover any DOM region
   on the page (highlighted overlay, React DevTools-style), click to capture
   just that subtree as markdown. Solves the dashboard case — grab the FOSSA
   vulnerabilities table, the Linear issue description, the Jira comment
   thread, without the surrounding nav cruft.
2. **Text selection**: select text on the page, hit the extension shortcut,
   get markdown of the selection with structure preserved (tables, code,
   lists, links).
3. **Full page**: Readability/Defuddle-style fallback for article-shaped pages.

Output destinations are user choice at capture time: clipboard (default) or
download as `.md`. The extension does not store, sync, or route — once the
markdown leaves, it's the user's problem (which is the point).

Authentication is solved trivially by virtue of running as a content script:
the extension reads the rendered DOM in the user's already-authenticated tab.
No cookies handling, no session replay, no auth code at all.

## Key Assumptions to Validate
- [ ] Element picker is the primary mode users reach for — validate by
      logging mode usage in early dogfooding
- [ ] HTML-to-markdown via Turndown + GFM plugin preserves enough structure
      (tables, code, nested lists) to be useful for AI consumption — verify
      on 5 concrete target pages: FOSSA vulns, Linear issue, Jira ticket,
      Notion doc, GitHub PR
- [ ] Authenticated SPAs render the DOM far enough by the time the user
      clicks "capture" — should be true by definition (user sees it), but
      lazy-loaded sections may need a scroll-first step
- [ ] Markdown pasted into Claude/ChatGPT renders tables and code correctly

## MVP Scope
**In:**
- Chrome extension (MV3), single browser, no store submission required for v0
- Three capture modes: element picker, selection, full page
- Keyboard shortcut for each (configurable)
- HTML→markdown via Turndown + GFM plugin (tables, strikethrough, task lists)
- Output: clipboard (default), download `.md` (alt)
- Tiny popup UI: mode selector + last-captured preview
- Source URL prepended to every capture as a header

**Out:**
- CLI (deferred to v0.x — Playwright path for non-auth pages)
- Firefox/Safari port
- Per-domain extraction rules (deferred — see whether Turndown handles
  the target pages well enough first)
- window.ai integration (deferred — only worth it if rule-based output
  proves insufficient)
- Settings sync, cloud, accounts, server-side anything
- Destinations beyond clipboard/file (no "send to Obsidian," no "open
  in Claude")
- Multi-page or multi-tab capture
- Read-later / queue features

## Not Doing (and Why)
- **CLI in v0** — auth is the whole point; CLI can't solve it without a
  headless browser; defer to v0.x as a complement for public pages.
- **Per-domain rules engine** — premature; first prove Turndown defaults
  fail on real pages before adding a rules abstraction.
- **window.ai / on-device AI** — bonus mode, not load-bearing; revisit
  only after measuring where rules-based extraction actually breaks.
- **Destinations / routing** — out of scope by design; the user owns what
  happens to the markdown after capture.
- **Cross-browser** — Chrome is where you (and most target users) live;
  port if and when there's demand.

## Open Questions
- Activation: browser action click, keyboard shortcut, or both? Default
  shortcut for each mode?
- Element picker: nearest-block-ancestor heuristic on hover, or pure
  element-under-cursor (with arrow keys to expand selection up the tree)?
- Preview-before-copy or copy-immediately?
- Per-capture toggle for "include source URL header"?
- License — MIT for max adoption, or AGPL to keep any forks open?
- Distribution path — GitHub releases + unpacked install for v0, Chrome
  Web Store once stable?
