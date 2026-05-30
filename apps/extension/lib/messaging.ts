import type { Destination } from "./destination";
import type { ExtractSource } from "./extract";

export type CaptureMode = "page" | "page-ai" | "selection" | "element";

export interface CaptureRequest {
  type: "trakdown:capture";
  mode: CaptureMode;
  destination: Destination;
}

// Output (clipboard write or download) lives entirely in the content script
// now — the popup and background just dispatch. The response carries enough
// for the dispatcher to surface a fallback status when it can't reach the
// page at all (e.g. chrome:// URLs), but on success it's just an ack.
export interface CaptureResponse {
  ok: boolean;
  source?: ExtractSource;
  error?: string;
  pending?: boolean;
}
