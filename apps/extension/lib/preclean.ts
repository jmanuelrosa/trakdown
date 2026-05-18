// Aggressive DOM cleanup before sending HTML to an on-device LLM.
// Goal: reduce token count so the model gets signal-rich input that fits its context window.

const REMOVE_TAGS = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
];

const REMOVE_ATTRS = [
  "style",
  "class",
  "id",
  "data-testid",
  "data-cy",
  "data-qa",
  "onclick",
  "onload",
  "onerror",
  "onmouseover",
  "onmouseout",
  "tabindex",
];

export function precleanHtmlForAi(doc: Document): string {
  const cloned = doc.cloneNode(true) as Document;
  const root = cloned.body ?? cloned.documentElement;
  if (!root) return doc.body?.outerHTML ?? "";

  // Drop entire tag types (scripts, styles, embeds, decorative SVGs, etc.)
  for (const tag of REMOVE_TAGS) {
    for (const el of cloned.querySelectorAll(tag)) {
      el.remove();
    }
  }

  // Remove HTML comments
  const commentWalker = cloned.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  let comment = commentWalker.nextNode();
  while (comment !== null) {
    comments.push(comment);
    comment = commentWalker.nextNode();
  }
  for (const c of comments) c.parentNode?.removeChild(c);

  // Remove hidden / decorative elements
  for (const el of root.querySelectorAll('[hidden], [aria-hidden="true"]')) {
    el.remove();
  }

  // Strip noisy attributes everywhere
  for (const el of root.querySelectorAll("*")) {
    for (const attr of REMOVE_ATTRS) {
      el.removeAttribute(attr);
    }
    // Drop any data-* attribute that survived
    const dataAttrs = Array.from(el.attributes).filter((a) => a.name.startsWith("data-"));
    for (const a of dataAttrs) el.removeAttribute(a.name);
  }

  // Collapse runs of whitespace to single spaces in text nodes (keep newlines)
  const textWalker = cloned.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let textNode = textWalker.nextNode();
  while (textNode !== null) {
    textNodes.push(textNode as Text);
    textNode = textWalker.nextNode();
  }
  for (const text of textNodes) {
    if (text.nodeValue) {
      text.nodeValue = text.nodeValue.replace(/[ \t\f\v]+/g, " ");
    }
  }

  return root.outerHTML;
}
