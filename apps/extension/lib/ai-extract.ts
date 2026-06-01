// Wraps Chrome's Prompt API (Gemini Nano) for HTML → Markdown extraction.

export type AiAvailability =
  | "available"
  | "downloadable"
  | "downloading"
  | "unavailable"
  | "unsupported";

export type AiFailureReason = "unavailable" | "too-large" | "empty" | "error";

export type AiExtractOutcome =
  | { ok: true; markdown: string }
  | { ok: false; reason: AiFailureReason };

const SYSTEM_PROMPT = `You convert a web page's HTML into clean Markdown for an AI assistant to read later. The user is grabbing the page so they can paste it into Claude or ChatGPT.

OUTPUT
- Markdown only. No preamble ("Here is..."), no commentary, no closing remark, and no outer \`\`\` fence wrapping the whole response.
- Start with the page's main heading as \`# Title\` if one is visible. Otherwise start with the first paragraph of real content.

FIDELITY
- Copy the source text VERBATIM: same words, numbers, dates, names, code, and order. Never summarize, rewrite, translate, abbreviate, or invent text.
- Keep every link target: \`[text](url)\`. Keep every image: \`![alt](url)\`. Use the URLs exactly as given in the source.

KEEP
- The article, doc, issue body, code review, dashboard table, log section — whatever primary content the user came to read.
- Use GitHub Flavored Markdown: headings (#, ##, ###), tables (| ... |), fenced code blocks with a language tag when you can identify one (\`\`\`ts, \`\`\`python, \`\`\`sh — otherwise plain \`\`\`), ordered and unordered lists, task lists (- [ ] / - [x]), blockquotes (>), inline \`code\`, **bold**, *italic*.

DROP
- Site chrome: nav menus, sidebars, footers, breadcrumbs.
- Ads, cookie banners, newsletter popups, share buttons, "related articles" blocks.
- Comment sections, unless the page IS a comment thread (e.g. a Hacker News discussion).

NO ARTICLE? Return the densest coherent block of data on the page — the issue body, the table, the log lines, whatever is clearly the user's focus.

EXAMPLE
Input:
<nav>Home</nav>
<article>
  <h1>Hello, world</h1>
  <p>Today I learned <a href="/x">a thing</a>.</p>
  <pre><code class="language-ts">const x = 1;</code></pre>
</article>
<footer>© 2026</footer>

Output:
# Hello, world

Today I learned [a thing](/x).

\`\`\`ts
const x = 1;
\`\`\``;

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

export async function aiExtract(html: string): Promise<AiExtractOutcome> {
  const lm = getLanguageModel();
  if (!lm) return { ok: false, reason: "unavailable" };

  const availability = await aiAvailability();
  if (availability === "unavailable" || availability === "unsupported") {
    return { ok: false, reason: "unavailable" };
  }

  console.debug("[trakdown:ai] input", {
    chars: html.length,
    head: html.slice(0, 200),
    tail: html.slice(-200),
  });

  let session: LanguageModelSession | null = null;
  try {
    session = await lm.create({
      initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
      temperature: 0.2,
    });
    const raw = await session.prompt(html);
    const cleaned = stripCodeFences(raw.trim());
    console.debug("[trakdown:ai] output", { chars: cleaned.length });
    return cleaned ? { ok: true, markdown: cleaned } : { ok: false, reason: "empty" };
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.warn("[trakdown] AI extraction skipped: input too large for on-device model");
      return { ok: false, reason: "too-large" };
    }
    console.warn("[trakdown] AI extraction failed:", err);
    return { ok: false, reason: "error" };
  } finally {
    session?.destroy();
  }
}

function stripCodeFences(text: string): string {
  // Some models wrap the whole output in ```markdown ... ``` despite the
  // instruction not to. Strip a leading/trailing fence if present.
  return text
    .replace(/^```(?:markdown|md|html)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}
