import type { ExtractSource } from "./extract";

export type CaptureMode = "page" | "page-ai" | "selection" | "element";

export interface CaptureRequest {
  type: "trakdown:capture";
  mode: CaptureMode;
}

export interface CaptureResponse {
  ok: boolean;
  markdown?: string;
  source?: ExtractSource;
  error?: string;
  pending?: boolean;
}
