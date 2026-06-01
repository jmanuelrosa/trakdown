import { Destination } from "@/lib/destination";
import { buildFilename, triggerDownload } from "@/lib/download";
import {
  type AiCaptureResult,
  type ExtractResult,
  ExtractSource,
  extractMain,
  extractMainWithAi,
} from "@/lib/extract";
import { buildFrontmatter, type FrontmatterMap } from "@/lib/frontmatter";
import { setLastCapture } from "@/lib/last-capture";
import { htmlToMarkdown } from "@/lib/markdown";
import type { CaptureMode, CaptureRequest, CaptureResponse } from "@/lib/messaging";
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

  // Validate sync modes eagerly so "no selection" toasts before the popup
  // closes. Delivery is deferred so navigator.clipboard.writeText runs with
  // the page focused — see waitForFocus inside deliver().
  const captured = capture(msg.mode);
  if (!captured) {
    if (msg.mode === "selection") {
      showToast("Select text on the page first, then try again.", { variant: "error" });
      return { ok: false, error: "no text selected on the page" };
    }
    return { ok: false, error: `unsupported mode "${msg.mode}"` };
  }
  void runSyncCapture(captured, msg.destination, msg.mode);
  return { ok: true, pending: true, source: captured.source };
}

async function runSyncCapture(
  captured: ExtractResult,
  destination: Destination,
  mode: CaptureMode,
): Promise<void> {
  try {
    const body = htmlToMarkdown(captured.html);
    const markdown = buildMarkdown({ body, titleOverride: captured.title });
    await deliver(markdown, destination, sourceTag(captured.source), captured.title);
    await rememberCapture({
      mode,
      source: captured.source,
      destination,
      body,
      markdown,
      title: captured.title,
    });
  } catch (err) {
    console.warn("[trakdown] capture failed:", err);
    showToast(`Capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
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
    const body = htmlToMarkdown(result.element.outerHTML);
    const markdown = buildMarkdown({ body, selector: result.selector });
    await deliver(markdown, destination, "element picker");
    await rememberCapture({
      mode: "element",
      source: ExtractSource.Picker,
      destination,
      body,
      markdown,
    });
  } catch (err) {
    console.warn("[trakdown] picker capture failed:", err);
    showToast(`Capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
  }
}

async function runAiCapture(destination: Destination): Promise<void> {
  showToast("AI capturing page…", { persist: true });
  try {
    const result = await extractMainWithAi(document);
    const body = result.bodyFormat === "markdown" ? result.body : htmlToMarkdown(result.body);
    const markdown = buildMarkdown({ body, titleOverride: result.title });
    await deliver(markdown, destination, aiCaptureTag(result), result.title);
    await rememberCapture({
      mode: "page-ai",
      source: result.source,
      destination,
      body,
      markdown,
      title: result.title,
    });
  } catch (err) {
    console.warn("[trakdown] AI capture failed:", err);
    showToast(`AI capture failed: ${err instanceof Error ? err.message : String(err)}`, {
      variant: "error",
    });
  }
}

function aiCaptureTag(result: AiCaptureResult): string {
  if (result.source === ExtractSource.AI) return "AI";
  switch (result.aiFailureReason) {
    case "too-large":
      return `${result.source} (AI input too large)`;
    case "unavailable":
      return `${result.source} (AI unavailable)`;
    case "empty":
      return `${result.source} (AI returned nothing)`;
    case "error":
      return `${result.source} (AI error)`;
    default:
      return `${result.source} fallback`;
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
  const filenameOpts = { title: titleOverride ?? document.title, url: location.href };

  if (destination === Destination.Download) {
    const filename = buildFilename(filenameOpts);
    triggerDownload(markdown, filename);
    showToast(`Saved ${filename} (${tag})`);
    return;
  }

  // Route the clipboard write through the background service worker, which
  // owns an offscreen document for the actual writeText call. The offscreen
  // page runs in the extension process and isn't subject to Chrome's
  // "document must be focused" rule — so this works whether the user is on
  // the page, in DevTools, or in another window entirely.
  try {
    await copyViaBackground(markdown);
    showToast(`Copied ${markdown.length.toLocaleString()} chars (${tag})`);
  } catch (err) {
    // Offscreen unavailable / rejected for some other reason. Never drop
    // the capture — save it as a file and tell the user where it went.
    const filename = buildFilename(filenameOpts);
    triggerDownload(markdown, filename);
    const reason = err instanceof Error ? err.message : "clipboard error";
    showToast(`Couldn't copy (${reason}). Saved ${filename} instead.`, { variant: "error" });
  }
}

async function copyViaBackground(text: string): Promise<void> {
  const res = (await chrome.runtime.sendMessage({ type: "trakdown:copy", text })) as
    | { ok: boolean; error?: string }
    | undefined;
  if (!res?.ok) {
    throw new Error(res?.error ?? "clipboard write failed");
  }
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

interface RememberOpts {
  mode: CaptureMode;
  source: ExtractSource;
  destination: Destination;
  body: string;
  markdown: string;
  title?: string;
}

async function rememberCapture(opts: RememberOpts): Promise<void> {
  try {
    const url = new URL(location.href);
    const title = (opts.title ?? document.title).trim() || location.href;
    await setLastCapture({
      mode: opts.mode,
      source: opts.source,
      destination: opts.destination,
      url: location.href,
      domain: url.hostname,
      title,
      excerpt: makeExcerpt(opts.body) ?? "",
      charCount: opts.markdown.length,
      capturedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Storage write isn't load-bearing — the capture already landed; the
    // user just won't see the preview on next popup open. Swallow.
    console.warn("[trakdown] failed to persist last capture:", err);
  }
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
