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
});
