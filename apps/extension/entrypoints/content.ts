import { type ExtractResult, extractMain, extractMainWithAi } from "@/lib/extract";
import { buildFrontmatter, type FrontmatterMap } from "@/lib/frontmatter";
import { htmlToMarkdown } from "@/lib/markdown";
import type { CaptureRequest, CaptureResponse } from "@/lib/messaging";
import { extractPageMetadata } from "@/lib/metadata";
import { activatePicker, cancelPicker, isPickerActive, showToast } from "@/lib/picker";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (isCheckSelectionRequest(msg)) {
        const sel = window.getSelection();
        const hasSelection = sel ? sel.toString().trim() !== "" : false;
        sendResponse({ hasSelection });
        return false;
      }
      if (isCancelPickerRequest(msg)) {
        const cancelled = cancelPicker();
        sendResponse({ cancelled });
        return false;
      }
      if (!isCaptureRequest(msg)) return;
      void handleCapture(msg).then(sendResponse);
      return true;
    });
  },
});

function isCaptureRequest(value: unknown): value is CaptureRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "trakdown:capture"
  );
}

function isCheckSelectionRequest(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "trakdown:check-selection"
  );
}

function isCancelPickerRequest(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "trakdown:cancel-picker"
  );
}

async function handleCapture(msg: CaptureRequest): Promise<CaptureResponse> {
  // If a picker is still on-screen and the user picks a different mode from
  // the popup, treat the new mode as the user's current intent: cancel the
  // picker first so its overlay/banner clean up before the new capture runs.
  if (msg.mode !== "element" && isPickerActive()) {
    cancelPicker();
  }

  if (msg.mode === "element") {
    if (isPickerActive()) {
      return { ok: false, error: "picker already active" };
    }
    void runPicker();
    return { ok: true, pending: true, source: "picker" };
  }

  if (msg.mode === "page-ai") {
    void runAiCapture();
    return { ok: true, pending: true, source: "ai-clean" };
  }

  try {
    const captured = capture(msg.mode);
    if (!captured) {
      if (msg.mode === "selection") {
        return { ok: false, error: "no text selected on the page" };
      }
      return { ok: false, error: `unsupported mode "${msg.mode}"` };
    }
    const markdown = buildMarkdown({
      body: htmlToMarkdown(captured.html),
      titleOverride: captured.title,
    });
    return { ok: true, markdown, source: captured.source };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function capture(mode: CaptureRequest["mode"]): ExtractResult | null {
  switch (mode) {
    case "page":
      return extractMain(document);
    case "selection":
      return captureSelection();
    default:
      return null;
  }
}

function captureSelection(): ExtractResult | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.toString().trim() === "") {
    return null;
  }
  const container = document.createElement("div");
  for (let i = 0; i < sel.rangeCount; i++) {
    container.appendChild(sel.getRangeAt(i).cloneContents());
  }
  return { html: container.innerHTML, source: "selection" };
}

async function runPicker(): Promise<void> {
  const result = await activatePicker();
  if (!result) return;

  try {
    const markdown = buildMarkdown({
      body: htmlToMarkdown(result.element.outerHTML),
      selector: result.selector,
    });
    await navigator.clipboard.writeText(markdown);
    showToast(`Copied ${markdown.length.toLocaleString()} chars`);
  } catch (err) {
    console.warn("[trakdown] picker capture failed:", err);
    showToast(`Capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
  }
}

async function runAiCapture(): Promise<void> {
  showToast("AI cleaning page…");
  try {
    const result = await extractMainWithAi(document);
    const markdown = buildMarkdown({
      body: htmlToMarkdown(result.html),
      titleOverride: result.title,
    });
    await navigator.clipboard.writeText(markdown);
    const tag = result.source === "ai-clean" ? "AI clean" : `${result.source} fallback`;
    showToast(`Copied ${markdown.length.toLocaleString()} chars (${tag})`);
  } catch (err) {
    console.warn("[trakdown] AI capture failed:", err);
    showToast(`AI capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
  }
}

interface BuildMarkdownOpts {
  body: string;
  titleOverride?: string;
  selector?: string;
}

function buildMarkdown(opts: BuildMarkdownOpts): string {
  const meta = extractPageMetadata(document);
  const url = new URL(location.href);
  const title = (opts.titleOverride ?? meta.title ?? document.title).trim() || location.href;

  const wordCount = countWords(opts.body);
  const readingTime = wordCount > 0 ? Math.max(1, Math.round(wordCount / 200)) : undefined;

  const fm: FrontmatterMap = {
    title,
    source: location.href,
    domain: url.hostname,
    captured_at: new Date().toISOString(),
    site: meta.site,
    language: meta.language,
    author: meta.author,
    published: meta.published,
    word_count: wordCount || undefined,
    reading_time_min: readingTime,
    excerpt: makeExcerpt(opts.body),
    selector: opts.selector,
  };

  return buildFrontmatter(fm) + opts.body;
}

function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[#>*_~\-[\]()]/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function makeExcerpt(markdown: string, maxLen = 180): string | undefined {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_~]/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return undefined;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}
