import { type ExtractResult, ExtractSource, extractMain } from "@trakdown/core/extract";
import { type AiFailureReason, aiExtract } from "./ai-extract";
import { precleanHtmlForAi } from "./preclean";

export { type ExtractResult, ExtractSource, extractMain };

// AI mode's return shape. Differs from ExtractResult because the AI can
// output Markdown directly, skipping the HTML→Markdown step downstream.
export interface AiCaptureResult {
  body: string;
  bodyFormat: "html" | "markdown";
  title?: string;
  source: ExtractSource;
  aiFailureReason?: AiFailureReason;
}

// Run Readability first, then feed its main-content HTML to the on-device
// model. Readability's output is typically 5–15K chars vs the 50K+ a raw
// precleaned body can produce, so the AI stays under Gemini Nano's context
// window on long pages. The model returns Markdown directly — no Turndown
// roundtrip on the AI path.
export async function extractMainWithAi(doc: Document): Promise<AiCaptureResult> {
  const baseline = extractMain(doc);
  const candidate = baseline.source === ExtractSource.Page ? baseline.html : precleanHtmlForAi(doc);

  const ai = await aiExtract(candidate);
  if (ai.ok) {
    return {
      body: ai.markdown,
      bodyFormat: "markdown",
      title: baseline.title ?? doc.title,
      source: ExtractSource.AI,
    };
  }

  return {
    body: baseline.html,
    bodyFormat: "html",
    title: baseline.title,
    source: baseline.source,
    aiFailureReason: ai.reason,
  };
}
