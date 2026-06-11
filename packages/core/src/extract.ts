import { Readability } from "@mozilla/readability";

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
