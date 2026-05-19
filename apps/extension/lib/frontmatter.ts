// Tiny purpose-built YAML frontmatter serializer.
// Restricted to flat string|number values — no nested objects or arrays.
// We hand-roll this instead of pulling in a YAML lib to keep the content-script
// bundle small.

export type FrontmatterValue = string | number | undefined;
export type FrontmatterMap = Record<string, FrontmatterValue>;

export function buildFrontmatter(meta: FrontmatterMap): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined || value === "") continue;
    lines.push(`${key}: ${serializeValue(value)}`);
  }
  lines.push("---", "");
  return lines.join("\n");
}

function serializeValue(value: string | number): string {
  if (typeof value === "number") return String(value);
  if (needsQuoting(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function needsQuoting(value: string): boolean {
  if (value.length === 0) return true;
  // YAML flow indicators and other reserved characters.
  if (/[:#[\]{}|>*&!%@`,'"]/.test(value)) return true;
  // Leading whitespace or characters that have meaning at the start of a line.
  if (/^[-?\s]/.test(value)) return true;
  // Embedded line breaks or tabs.
  if (/[\n\r\t]/.test(value)) return true;
  // YAML boolean / null aliases — quote to preserve as strings.
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(value)) return true;
  // Looks like a number — quote so YAML keeps it as a string when intended.
  if (/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(value)) return true;
  return false;
}
