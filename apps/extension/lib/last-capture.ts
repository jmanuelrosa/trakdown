// A small record of the most recent successful capture, surfaced in the popup
// as the "last-captured preview" from the MVP spec. Lives in chrome.storage.local
// (same surface as the destination preference) so the page content never leaves
// the user's machine — the excerpt is bounded to 180 chars to keep this tiny.

import type { Destination } from "./destination";
import type { ExtractSource } from "./extract";
import type { CaptureMode } from "./messaging";

export interface LastCapture {
  mode: CaptureMode;
  source: ExtractSource;
  destination: Destination;
  url: string;
  domain: string;
  title: string;
  excerpt: string;
  charCount: number;
  capturedAt: string;
}

const STORAGE_KEY = "last_capture";

export async function getLastCapture(): Promise<LastCapture | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY];
  return isLastCapture(value) ? value : null;
}

export async function setLastCapture(value: LastCapture): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
}

function isLastCapture(value: unknown): value is LastCapture {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.mode === "string" &&
    typeof v.source === "string" &&
    typeof v.destination === "string" &&
    typeof v.url === "string" &&
    typeof v.domain === "string" &&
    typeof v.title === "string" &&
    typeof v.excerpt === "string" &&
    typeof v.charCount === "number" &&
    typeof v.capturedAt === "string"
  );
}
