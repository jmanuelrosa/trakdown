// Page-level metadata extraction for markdown frontmatter.
// Best-effort: every field is optional and falls back gracefully when meta tags
// are missing. Reads from <meta>, <html lang>, <time> elements, and any
// schema.org JSON-LD blocks present on the page.

export interface PageMetadata {
  title?: string;
  language?: string;
  description?: string;
  site?: string;
  author?: string;
  published?: string;
}

export function extractPageMetadata(doc: Document): PageMetadata {
  return {
    title: doc.title?.trim() || undefined,
    language: extractLanguage(doc),
    description: extractDescription(doc),
    site: extractSite(doc),
    author: extractAuthor(doc),
    published: extractPublished(doc),
  };
}

function extractLanguage(doc: Document): string | undefined {
  return doc.documentElement.getAttribute("lang")?.trim() || undefined;
}

function extractDescription(doc: Document): string | undefined {
  const raw =
    metaContent(doc, "description") ??
    metaContent(doc, "og:description") ??
    metaContent(doc, "twitter:description");
  return raw?.trim() || undefined;
}

function extractSite(doc: Document): string | undefined {
  return metaContent(doc, "og:site_name")?.trim() || undefined;
}

function extractAuthor(doc: Document): string | undefined {
  const fromMeta =
    metaContent(doc, "author") ??
    metaContent(doc, "article:author") ??
    metaContent(doc, "twitter:creator");
  if (fromMeta) return fromMeta.trim();
  return extractJsonLdAuthor(doc);
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
    const author = obj.author;
    if (typeof author === "string") return author;
    if (author && typeof author === "object" && "name" in author) {
      const name = (author as Record<string, unknown>).name;
      if (typeof name === "string") return name;
    }
    return undefined;
  });
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
  // Look into @graph arrays (common in schema.org docs)
  if (Array.isArray(obj["@graph"])) {
    return walkJsonLd(obj["@graph"], finder);
  }
  return undefined;
}
