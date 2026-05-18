import { Readability } from "@mozilla/readability";
import { aiExtract } from "./ai-extract";
import { precleanHtmlForAi } from "./preclean";

export type ExtractSource = "readability" | "fallback" | "selection" | "picker" | "ai-clean";

export interface ExtractResult {
  html: string;
  title?: string;
  source: ExtractSource;
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
        source: "readability",
      };
    }
  } catch (err) {
    console.warn("[trakdown] readability extraction failed:", err);
  }
  return { html: doc.body.outerHTML, source: "fallback" };
}

export async function extractMainWithAi(doc: Document): Promise<ExtractResult> {
  const precleaned = precleanHtmlForAi(doc);
  const ai = await aiExtract(precleaned);
  if (ai?.html) {
    return { html: ai.html, title: doc.title, source: "ai-clean" };
  }
  // AI unavailable or returned nothing — fall back to Readability + raw HTML chain.
  return extractMain(doc);
}
