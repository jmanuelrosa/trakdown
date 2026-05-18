import type { CaptureRequest } from "@/lib/messaging";

export default defineBackground(() => {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "pick-element") return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const req: CaptureRequest = { type: "trakdown:capture", mode: "element" };
    try {
      await chrome.tabs.sendMessage(tab.id, req);
    } catch (err) {
      console.warn(
        "[trakdown] could not start picker on this tab — reload the page if the extension was just installed.",
        err,
      );
    }
  });
});
