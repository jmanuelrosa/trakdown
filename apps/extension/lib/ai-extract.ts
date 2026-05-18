// Wraps Chrome's Prompt API (Gemini Nano) for HTML content extraction.

export type AiAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported";

const SYSTEM_PROMPT = `You extract main content from web pages.

Rules:
- Output ONLY HTML, no commentary, no markdown code fences.
- Keep all main content VERBATIM. Do not rewrite, summarize, or paraphrase.
- Remove navigation, sidebars, footers, ads, cookie banners, modals, and site chrome.
- Preserve tables, code blocks, lists, headings, and links exactly as they appear in the input.
- If there is no obvious primary content (the page is pure UI), return the largest semantically coherent block of text or data.`;

function getLanguageModel(): LanguageModelStatic | undefined {
  if (typeof LanguageModel !== "undefined" && LanguageModel) return LanguageModel;
  if (typeof window !== "undefined" && window.ai?.languageModel) {
    return window.ai.languageModel;
  }
  return undefined;
}

export async function aiAvailability(): Promise<AiAvailability> {
  const lm = getLanguageModel();
  if (!lm) return "unsupported";
  try {
    return await lm.availability();
  } catch {
    return "unsupported";
  }
}

export async function aiExtract(html: string): Promise<{ html: string } | null> {
  const lm = getLanguageModel();
  if (!lm) return null;

  const availability = await aiAvailability();
  if (availability === "unavailable" || availability === "unsupported") return null;

  let session: LanguageModelSession | null = null;
  try {
    session = await lm.create({
      initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
      temperature: 0.2,
    });
    const raw = await session.prompt(html);
    const cleaned = stripCodeFences(raw.trim());
    return cleaned ? { html: cleaned } : null;
  } catch (err) {
    console.warn("[trakdown] AI extraction failed:", err);
    return null;
  } finally {
    session?.destroy();
  }
}

function stripCodeFences(text: string): string {
  // Some models wrap output in ```html ... ``` despite instructions.
  return text
    .replace(/^```(?:html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
