// Save markdown to disk by synthesizing an <a download> click. Works inside
// either the popup (its own HTML doc) or a content script (uses the active
// page's documentElement). Avoids the chrome.downloads permission — keeps the
// install warning surface unchanged.

export function triggerDownload(
  markdown: string,
  filename: string,
  doc: Document = document,
): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  doc.documentElement.appendChild(a);
  a.click();
  a.remove();
  // Revoke after a tick so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildFilename(opts: { title?: string; url: string; date?: Date }): string {
  const date = opts.date ?? new Date();
  const stamp = isoDate(date);
  const stem = slugify(opts.title ?? "") || slugify(hostnameOf(opts.url)) || "capture";
  return `${stem}-${stamp}.md`;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
