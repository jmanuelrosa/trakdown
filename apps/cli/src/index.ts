import type { Page } from "playwright-core";
import { parseCliArgs } from "./args.ts";
import { CliBrowser, captureUrl, promptForLogin } from "./capture.ts";
import { resolveCollision, slugifyTitle, slugifyUrl, timestampSlug } from "./naming.ts";
import { type ResolvedDestination, resolveDestination, writeMarkdown } from "./output.ts";

const VERSION = process.env.TRAKDOWN_VERSION ?? "0.0.0-dev";

const HELP = `trakdown — capture web pages as markdown

Usage:
  trakdown <url> [<url> ...] [--auth] [-o <path>] [--no-frontmatter]

Flags:
  --auth              Open Chrome, log in, then capture (no session persists between calls)
  -o, --out <path>    File (.md) for a single URL, or directory for one or many
  --no-frontmatter    Skip YAML frontmatter; output body only
  -h, --help          Show this help
  -v, --version       Show version

Output:
  - Files only. stdout emits one absolute file path per capture.
  - Per-URL status (OK / FAILED) is printed to stderr.
  - Exit code 0 if all URLs captured, 1 if any failed.
`;

const parsed = parseCliArgs(process.argv.slice(2));
if ("error" in parsed) {
  process.stderr.write(`Error: ${parsed.error}\n\n${HELP}`);
  process.exit(2);
}

if (parsed.help) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (parsed.version) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

if (parsed.urls.length === 0) {
  process.stderr.write(`Error: no URLs given.\n\n${HELP}`);
  process.exit(2);
}

let destination: ResolvedDestination;
try {
  destination = resolveDestination(parsed.outPath, parsed.urls.length);
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}

const browser = new CliBrowser(!parsed.auth);
try {
  await browser.launch();
} catch (err) {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

if (parsed.auth) {
  const loginPage = await browser.newPage();
  await loginPage.goto("about:blank").catch(() => {});
  await promptForLogin();
  await loginPage.close().catch(() => {});
}

let anyFailed = false;
for (const url of parsed.urls) {
  let page: Page | undefined;
  try {
    page = await browser.newPage();
    const result = await captureUrl(page, {
      url,
      includeFrontmatter: !parsed.noFrontmatter,
    });
    const baseName = slugifyTitle(result.title) || slugifyUrl(result.url) || timestampSlug();
    const filePath =
      destination.kind === "file" ? destination.path : resolveCollision(destination.path, baseName);
    writeMarkdown(filePath, result.markdown);
    process.stderr.write(`→ ${url}  OK\n`);
    process.stdout.write(`${filePath}\n`);
  } catch (err) {
    anyFailed = true;
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`→ ${url}  FAILED: ${message}\n`);
  } finally {
    await page?.close().catch(() => {});
  }
}

await browser.close();
process.exit(anyFailed ? 1 : 0);
