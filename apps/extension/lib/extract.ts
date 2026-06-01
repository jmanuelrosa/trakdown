import { Readability } from "@mozilla/readability";
import { type AiFailureReason, aiExtract } from "./ai-extract";
import { precleanHtmlForAi } from "./preclean";

// Enum-shaped object literal with a derived type. Acts like an enum at call
// sites (ExtractSource.Page, ExtractSource.AI, …) while staying tree-shakeable
// and compatible with TS strip-types (Node 22+ --experimental-strip-types).
export const ExtractSource = {
  Page: "page",
  Fallback: "fallback",
  Selection: "selection",
  Picker: "picker",
  AI: "ai",
} as const;

export type ExtractSource = (typeof ExtractSource)[keyof typeof ExtractSource];

export interface ExtractResult {
  html: string;
  title?: string;
  source: ExtractSource;
}

// AI mode's return shape. Differs from ExtractResult because the AI can
// output Markdown directly, skipping the HTML→Markdown step downstream.
export interface AiCaptureResult {
  body: string;
  bodyFormat: "html" | "markdown";
  title?: string;
  source: ExtractSource;
  aiFailureReason?: AiFailureReason;
}

export function extractMain(doc: Document): ExtractResult {
  try {
    const cloned = doc.cloneNode(true) as Document;
    const article = new Readability(cloned).parse();
    if (article?.content?.trim()) {
      const title = article.title?.trim();
      return {
        html: article.content,
        title: title || undefined,
        source: ExtractSource.Page,
      };
    }
  } catch (err) {
    console.warn("[trakdown] page extraction failed:", err);
  }
  return { html: doc.body.outerHTML, source: ExtractSource.Fallback };
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
