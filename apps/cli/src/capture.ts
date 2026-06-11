import {
  buildFrontmatter,
  type ExtractResult,
  type ExtractSource,
  extractMain,
  extractPageMetadata,
  type FrontmatterMap,
  htmlToMarkdown,
} from "@trakdown/core";
import { parseHTML } from "linkedom";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright-core";

export interface CaptureOptions {
  url: string;
  includeFrontmatter: boolean;
}

export interface CaptureResult {
  url: string;
  title: string;
  markdown: string;
  wordCount: number;
  source: ExtractSource;
}

export class CliBrowser {
  #browser: Browser | null = null;
  #context: BrowserContext | null = null;
  readonly #headless: boolean;

  constructor(headless: boolean) {
    this.#headless = headless;
  }

  async launch(): Promise<void> {
    try {
      this.#browser = await chromium.launch({
        channel: "chrome",
        headless: this.#headless,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not launch Chrome (${message}). Install Chrome or run: pnpm exec playwright install chromium`,
      );
    }
    this.#context = await this.#browser.newContext();
  }

  async newPage(): Promise<Page> {
    if (!this.#context) throw new Error("Browser not launched");
    return this.#context.newPage();
  }

  async close(): Promise<void> {
    await this.#context?.close().catch(() => {});
    await this.#browser?.close().catch(() => {});
  }
}

export async function captureUrl(page: Page, options: CaptureOptions): Promise<CaptureResult> {
  await page.goto(options.url, { waitUntil: "load", timeout: 30_000 });
  const html = await page.content();
  const { document } = parseHTML(html);
  const doc = document as unknown as Document;
  const meta = extractPageMetadata(doc);
  const extracted: ExtractResult = extractMain(doc);
  const body = htmlToMarkdown(extracted.html);
  const title = (extracted.title ?? meta.title ?? options.url).trim();
  const wordCount = countWords(body);
  const finalUrl = page.url();
  const urlObj = safeUrl(finalUrl) ?? safeUrl(options.url);

  let markdown = body;
  if (options.includeFrontmatter) {
    const fm: FrontmatterMap = {
      title,
      source: finalUrl,
      domain: urlObj?.hostname,
      captured_at: new Date().toISOString(),
      word_count: wordCount,
      language: meta.language,
      site: meta.site,
      author: meta.author,
      published: meta.published,
      via: "cli",
      excerpt: buildExcerpt(body),
    };
    markdown = buildFrontmatter(fm) + body;
  }

  return {
    url: finalUrl,
    title,
    markdown,
    wordCount,
    source: extracted.source,
  };
}

export async function promptForLogin(): Promise<void> {
  process.stderr.write(
    "→ Browser opened. Log in to whatever you need (the session is reused for all captures).\n",
  );
  process.stderr.write("→ When you're done, press Enter here to continue. ");
  await new Promise<void>((wait) => {
    const onData = () => {
      process.stdin.off("data", onData);
      process.stdin.pause();
      wait();
    };
    process.stdin.resume();
    process.stdin.once("data", onData);
  });
  process.stderr.write("\n");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildExcerpt(body: string, max = 180): string {
  const stripped = body
    .replace(/[#>*`_[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return `${stripped.slice(0, max - 1)}…`;
}

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
