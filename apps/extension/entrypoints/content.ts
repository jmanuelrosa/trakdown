import { extractMain, extractMainWithAi, type ExtractResult } from "@/lib/extract";
import { htmlToMarkdown } from "@/lib/markdown";
import type { CaptureRequest, CaptureResponse } from "@/lib/messaging";
import { activatePicker, isPickerActive, showToast } from "@/lib/picker";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
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

async function handleCapture(msg: CaptureRequest): Promise<CaptureResponse> {
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
      return { ok: false, error: `mode "${msg.mode}" not yet implemented` };
    }
    const body = htmlToMarkdown(captured.html);
    const header = buildHeader(captured.title);
    return { ok: true, markdown: header + body, source: captured.source };
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
    const body = htmlToMarkdown(result.element.outerHTML);
    const header = buildHeader();
    const markdown = header + body;
    await navigator.clipboard.writeText(markdown);
    showToast(`Copied ${markdown.length.toLocaleString()} chars`);
  } catch (err) {
    console.warn("[trakdown] picker capture failed:", err);
    showToast(
      `Capture failed: ${err instanceof Error ? err.message : String(err)}`,
      { variant: "error" },
    );
  }
}

async function runAiCapture(): Promise<void> {
  showToast("AI cleaning page…");
  try {
    const result = await extractMainWithAi(document);
    const body = htmlToMarkdown(result.html);
    const header = buildHeader(result.title);
    const markdown = header + body;
    await navigator.clipboard.writeText(markdown);
    const tag = result.source === "ai-clean" ? "AI clean" : `${result.source} fallback`;
    showToast(`Copied ${markdown.length.toLocaleString()} chars (${tag})`);
  } catch (err) {
    console.warn("[trakdown] AI capture failed:", err);
    showToast(
      `AI capture failed: ${err instanceof Error ? err.message : String(err)}`,
      { variant: "error" },
    );
  }
}

function buildHeader(titleOverride?: string): string {
  const title = (titleOverride ?? document.title).trim() || location.href;
  return `# ${title}\n\n[Source](${location.href})\n\n---\n\n`;
}
