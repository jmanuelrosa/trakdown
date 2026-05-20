// Where a capture's markdown ends up. User-selectable in the popup; persisted
// across sessions in chrome.storage.local so the keyboard shortcut and popup
// agree on the same destination.

export const Destination = {
  Clipboard: "clipboard",
  Download: "download",
} as const;

export type Destination = (typeof Destination)[keyof typeof Destination];

const STORAGE_KEY = "destination";
const DEFAULT: Destination = Destination.Clipboard;

export async function getDestination(): Promise<Destination> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY];
  return isDestination(value) ? value : DEFAULT;
}

export async function setDestination(value: Destination): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
}

function isDestination(value: unknown): value is Destination {
  return value === Destination.Clipboard || value === Destination.Download;
}
