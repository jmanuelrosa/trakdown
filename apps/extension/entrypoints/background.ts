import { getDestination } from "@/lib/destination";
import type { CaptureMode, CaptureRequest } from "@/lib/messaging";

// Map each declared command name (see wxt.config.ts) to a capture mode the
// content script understands.
const COMMAND_TO_MODE: Record<string, CaptureMode> = {
  "capture-element": "element",
  "capture-selection": "selection",
  "capture-page": "page",
  "capture-page-ai": "page-ai",
};

const OFFSCREEN_URL = "offscreen.html";

export default defineBackground(() => {
  chrome.commands.onCommand.addListener(async (command) => {
    const mode = COMMAND_TO_MODE[command];
    if (!mode) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const destination = await getDestination();
    const req: CaptureRequest = { type: "trakdown:capture", mode, destination };
    try {
      await chrome.tabs.sendMessage(tab.id, req);
    } catch (err) {
      console.warn(
        "[trakdown] could not dispatch capture on this tab — reload the page if the extension was just installed.",
        err,
      );
    }
  });

  // Clipboard writes from content scripts hit Chrome's "document must be
  // focused" restriction whenever the user clicks into DevTools or another
  // window during a capture. Route every write through an offscreen page so
  // the operation runs in the extension process and ignores tab focus.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!isCopyRequest(msg)) return;
    void writeClipboardViaOffscreen(msg.text)
      .then(() => sendResponse({ ok: true }))
      .catch((err) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true;
  });
});

function isCopyRequest(value: unknown): value is { type: "trakdown:copy"; text: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; text?: unknown };
  return v.type === "trakdown:copy" && typeof v.text === "string";
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_URL),
    reasons: [chrome.offscreen.Reason.CLIPBOARD],
    justification: "Write captured Markdown to the clipboard without requiring a focused tab.",
  });
}

async function writeClipboardViaOffscreen(text: string): Promise<void> {
  await ensureOffscreenDocument();
  const res = (await chrome.runtime.sendMessage({
    type: "trakdown:offscreen-write",
    text,
  })) as { ok: boolean; error?: string } | undefined;
  if (!res?.ok) {
    throw new Error(res?.error ?? "offscreen clipboard write failed");
  }
}
