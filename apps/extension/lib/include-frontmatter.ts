// User preference: include YAML frontmatter on every capture, or deliver
// the body alone. Default on — most AI workflows benefit from the source URL
// and title context. Persisted in chrome.storage.local so the popup toggle
// and the keyboard-shortcut path stay in sync (the content script reads this
// at capture time, regardless of which path triggered it).

const STORAGE_KEY = "include_frontmatter";
const DEFAULT = true;

export async function getIncludeFrontmatter(): Promise<boolean> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY];
  return typeof value === "boolean" ? value : DEFAULT;
}

export async function setIncludeFrontmatter(value: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
}
