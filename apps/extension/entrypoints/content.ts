import { Destination } from "@/lib/destination";
import { buildFilename, triggerDownload } from "@/lib/download";
import { type ExtractResult, ExtractSource, extractMain, extractMainWithAi } from "@/lib/extract";
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
      if (isShowToastRequest(msg)) {
        showToast(msg.message, { variant: msg.variant ?? "success" });
        sendResponse({ shown: true });
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

function isShowToastRequest(
  value: unknown,
): value is { type: "trakdown:show-toast"; message: string; variant?: "success" | "error" } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; message?: unknown };
  return v.type === "trakdown:show-toast" && typeof v.message === "string";
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
    void runPicker(msg.destination);
    return { ok: true, pending: true, source: ExtractSource.Picker };
  }

  if (msg.mode === "page-ai") {
    void runAiCapture(msg.destination);
    return { ok: true, pending: true, source: ExtractSource.AI };
  }

  try {
    const captured = capture(msg.mode);
    if (!captured) {
      if (msg.mode === "selection") {
        showToast("Select text on the page first, then try again.", { variant: "error" });
        return { ok: false, error: "no text selected on the page" };
      }
      return { ok: false, error: `unsupported mode "${msg.mode}"` };
    }
    const markdown = buildMarkdown({
      body: htmlToMarkdown(captured.html),
      titleOverride: captured.title,
    });
    await deliver(markdown, msg.destination, sourceTag(captured.source), captured.title);
    return { ok: true, source: captured.source };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(`Capture failed: ${message}`, { variant: "error" });
    return { ok: false, error: message };
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
  return { html: container.innerHTML, source: ExtractSource.Selection };
}

async function runPicker(destination: Destination): Promise<void> {
  const result = await activatePicker();
  if (!result) return;

  try {
    const markdown = buildMarkdown({
      body: htmlToMarkdown(result.element.outerHTML),
      selector: result.selector,
    });
    await deliver(markdown, destination, "element picker");
  } catch (err) {
    console.warn("[trakdown] picker capture failed:", err);
    showToast(`Capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
  }
}

async function runAiCapture(destination: Destination): Promise<void> {
  showToast("AI capturing page…");
  try {
    const result = await extractMainWithAi(document);
    const markdown = buildMarkdown({
      body: htmlToMarkdown(result.html),
      titleOverride: result.title,
    });
    const tag = result.source === ExtractSource.AI ? "AI" : `${result.source} fallback`;
    await deliver(markdown, destination, tag, result.title);
  } catch (err) {
    console.warn("[trakdown] AI capture failed:", err);
    showToast(`AI capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
  }
}

// Routes the captured markdown to whichever destination the user picked and
// surfaces the result via the on-page toast. The toast wording diverges
// (Copied N chars vs Saved <filename>) so the user can tell at a glance which
// destination just ran — useful when the toggle was left on the other one.
async function deliver(
  markdown: string,
  destination: Destination,
  tag: string,
  titleOverride?: string,
): Promise<void> {
  if (destination === Destination.Download) {
    const filename = buildFilename({
      title: titleOverride ?? document.title,
      url: location.href,
    });
    triggerDownload(markdown, filename);
    showToast(`Saved ${filename} (${tag})`);
    return;
  }
  await navigator.clipboard.writeText(markdown);
  showToast(`Copied ${markdown.length.toLocaleString()} chars (${tag})`);
}

function sourceTag(source: ExtractSource): string {
  if (source === ExtractSource.AI) return "AI";
  return source;
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
