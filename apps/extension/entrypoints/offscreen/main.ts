// Offscreen document: writes captured Markdown to the clipboard from inside
// the extension process. Uses execCommand("copy") on a hidden <textarea>
// rather than navigator.clipboard.writeText — the latter still enforces
// Chrome's "document must be focused" rule even from an offscreen doc, which
// defeats the whole reason we're here. execCommand("copy") works because
// the textarea takes synthetic focus before the call. This is the pattern
// Chrome's own offscreen-clipboard sample uses.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isOffscreenWriteRequest(msg)) return;
  try {
    copyToClipboard(msg.text);
    sendResponse({ ok: true });
  } catch (err) {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

function copyToClipboard(text: string): void {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  // Keep the textarea out of any layout and visually invisible. It still
  // needs to be in the DOM and focusable for execCommand to operate on it.
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.setAttribute("readonly", "");
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("execCommand('copy') returned false");
}

function isOffscreenWriteRequest(
  value: unknown,
): value is { type: "trakdown:offscreen-write"; text: string } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown; text?: unknown };
  return v.type === "trakdown:offscreen-write" && typeof v.text === "string";
}
