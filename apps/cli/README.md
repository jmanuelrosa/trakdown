# @trakdown/cli

Capture any web page — public or behind a login — as clean markdown.

Requires Node 22+. Uses your installed Chrome by default; falls back to Playwright's bundled Chromium with one extra command.

## Install

### From npm (recommended)

```bash
# One-off
pnpm dlx @trakdown/cli <url>

# Or install globally
pnpm add -g @trakdown/cli
trakdown <url>
```

If Chrome isn't installed on your machine, run `pnpm dlx playwright install chromium` once.

### From source (for contributors)

```bash
pnpm install                                            # from the repo root
pnpm -F @trakdown/cli exec playwright install chromium  # only if Chrome isn't installed
```

The CLI uses your installed Chrome browser by default (`channel: 'chrome'`).

## Usage

```bash
# Public page → writes ./<title-slug>.md
trakdown https://example.com

# Authenticated page → opens browser, you log in, press Enter, capture proceeds
trakdown https://app.fossa.com/projects/xyz --auth

# Multiple URLs in one invocation → one login covers all
trakdown https://app.fossa.com/projects/a https://app.fossa.com/projects/b --auth -o ./captures/

# Skip the YAML frontmatter
trakdown https://example.com --no-frontmatter
```

From the repo root (working on the CLI itself), use `pnpm cli -- <url>` instead of `trakdown`:

```bash
pnpm cli -- https://example.com --auth
```

Tip: for any workflow that captures more than one or two pages, pass `-o ./captures/` (or any directory) so files don't pile up in cwd.

## Flags

| Flag                | Effect                                                                                  |
|---------------------|-----------------------------------------------------------------------------------------|
| `--auth`            | Opens a headed browser. Log in, press Enter in the terminal, capture proceeds.          |
| `-o <path>`         | Output destination. Ends in `.md` or names an existing file → use as filename (single URL only). Otherwise treated as directory (created if missing). |
| `--no-frontmatter`  | Skip the YAML frontmatter; output is markdown body only.                                |
| `--help`            | Print usage.                                                                            |
| `--version`         | Print version.                                                                          |

## Behavior

- **Output**: files only, never stdout for content. stdout emits one absolute file path per capture written. Per-URL status (`OK` / `FAILED`) goes to stderr.
- **Exit code**: `0` if every URL succeeded, `1` if any failed.
- **Naming**: slugified page title, fallback to URL slug, fallback to `capture-<timestamp>.md`. Collisions append `-2`, `-3`, … — never overwrites.
- **No session persistence**: each `--auth` invocation requires a fresh login. By design.
- **No login-wall detection**: `--auth` is required for authenticated pages; without it the CLI captures whatever the public/anonymous page renders (often a login page).

## Out of scope (v0)

- `--selector <css>` subtree scoping
- `--wait <ms|selector>` custom wait conditions
- AI Deep Clean (use the extension)
- Session persistence across invocations
- Auto-detection of login walls
