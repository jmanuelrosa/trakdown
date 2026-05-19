// Page-level metadata extraction for markdown frontmatter.
// Best-effort: every field is optional and falls back gracefully when meta tags
// are missing. Reads from <meta>, <html lang>, <time> elements, schema.org
// JSON-LD blocks, and (for author) common body-level conventions.

export interface PageMetadata {
  title?: string;
  language?: string;
  site?: string;
  author?: string;
  published?: string;
}

export function extractPageMetadata(doc: Document): PageMetadata {
  return {
    title: doc.title?.trim() || undefined,
    language: extractLanguage(doc),
    site: extractSite(doc),
    author: extractAuthor(doc),
    published: extractPublished(doc),
  };
}

function extractLanguage(doc: Document): string | undefined {
  return doc.documentElement.getAttribute("lang")?.trim() || undefined;
}

function extractSite(doc: Document): string | undefined {
  return metaContent(doc, "og:site_name")?.trim() || undefined;
}

function extractAuthor(doc: Document): string | undefined {
  // 1. <meta> tags — but skip URL-shaped values (e.g. <meta property="article:author"
  // content="https://example.com/authors/jane">), which point at a profile rather
  // than naming the author.
  const fromMeta = firstUsableAuthor([
    metaContent(doc, "author"),
    metaContent(doc, "article:author"),
    metaContent(doc, "twitter:creator"),
    metaContent(doc, "dc.creator"),
    metaContent(doc, "parsely-author"),
  ]);
  if (fromMeta) return fromMeta;

  // 2. JSON-LD (schema.org) — walks the @graph and nested structures.
  const fromJsonLd = extractJsonLdAuthor(doc);
  if (fromJsonLd) return fromJsonLd;

  // 3. Body-level conventions. Many news sites (e.g. xataka.com) only expose
  // the author through visible byline markup, not <head> metadata.
  return extractAuthorFromBody(doc);
}

function firstUsableAuthor(candidates: (string | null | undefined)[]): string | undefined {
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    if (isUrl(value)) continue;
    if (value.length > 120) continue;
    return value;
  }
  return undefined;
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function extractAuthorFromBody(doc: Document): string | undefined {
  // HTML spec: <a rel="author"> can appear anywhere — links to the author page.
  // We take its visible text as the name.
  const relAuthor = doc.querySelector<HTMLElement>("a[rel~='author']");
  const relText = relAuthor?.textContent?.trim();
  if (isPlausibleName(relText)) return relText;

  // Schema.org microdata: [itemprop="author"]. Could be a <meta> with content,
  // a wrapper with nested [itemprop="name"], or a span with the name as text.
  const itemprop = doc.querySelector<HTMLElement>('[itemprop="author"]');
  if (itemprop) {
    const content = itemprop.getAttribute("content")?.trim();
    if (isPlausibleName(content)) return content;

    const nameEl = itemprop.querySelector<HTMLElement>('[itemprop="name"]');
    const nameText = nameEl?.textContent?.trim();
    if (isPlausibleName(nameText)) return nameText;

    const text = itemprop.textContent?.trim();
    if (isPlausibleName(text)) return text;
  }

  // Common semantic class names used by CMSes and news templates.
  for (const selector of [
    ".author-name",
    ".byline-name",
    ".post-author-name",
    ".article-author",
    ".author",
    ".byline",
  ]) {
    const el = doc.querySelector<HTMLElement>(selector);
    const text = el?.textContent?.trim().replace(/^by\s+/i, "");
    if (isPlausibleName(text)) return text;
  }

  return undefined;
}

function isPlausibleName(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.length === 0 || value.length > 100) return false;
  if (isUrl(value)) return false;
  // Reject obvious non-names (newlines suggest we grabbed too much).
  if (/[\n\r]/.test(value)) return false;
  return true;
}

function extractPublished(doc: Document): string | undefined {
  const fromMeta =
    metaContent(doc, "article:published_time") ??
    metaContent(doc, "datePublished") ??
    metaContent(doc, "publish-date");
  const fromMetaIso = toIsoDate(fromMeta);
  if (fromMetaIso) return fromMetaIso;

  // Some sites only expose the date through <time datetime="..."> elements.
  const timeEl = doc.querySelector<HTMLTimeElement>("time[datetime]");
  const fromTime = toIsoDate(timeEl?.dateTime);
  if (fromTime) return fromTime;

  return extractJsonLdPublished(doc);
}

function toIsoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function metaContent(doc: Document, name: string): string | null {
  const byName = doc.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (byName?.content) return byName.content;
  const byProperty = doc.querySelector<HTMLMetaElement>(`meta[property="${name}"]`);
  return byProperty?.content ?? null;
}

function extractJsonLdAuthor(doc: Document): string | undefined {
  return findJsonLdValue(doc, (obj) => {
    const author = obj.author ?? obj.creator;
    return readAuthorValue(author);
  });
}

function readAuthorValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return isUrl(value) ? undefined : value.trim() || undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readAuthorValue(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === "object" && "name" in value) {
    const name = (value as Record<string, unknown>).name;
    if (typeof name === "string" && !isUrl(name)) return name.trim() || undefined;
  }
  return undefined;
}

function extractJsonLdPublished(doc: Document): string | undefined {
  return findJsonLdValue(doc, (obj) => {
    const value = obj.datePublished ?? obj.dateCreated;
    return typeof value === "string" ? toIsoDate(value) : undefined;
  });
}

function findJsonLdValue(
  doc: Document,
  finder: (obj: Record<string, unknown>) => string | undefined,
): string | undefined {
  const scripts = doc.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]');
  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script.textContent ?? "");
    } catch {
      continue;
    }
    const value = walkJsonLd(parsed, finder);
    if (value) return value;
  }
  return undefined;
}

function walkJsonLd(
  data: unknown,
  finder: (obj: Record<string, unknown>) => string | undefined,
): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = walkJsonLd(item, finder);
      if (found) return found;
    }
    return undefined;
  }
  const obj = data as Record<string, unknown>;
  const direct = finder(obj);
  if (direct) return direct;
  if (Array.isArray(obj["@graph"])) {
    return walkJsonLd(obj["@graph"], finder);
  }
  return undefined;
}
