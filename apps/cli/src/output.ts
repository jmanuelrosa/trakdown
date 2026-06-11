import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export interface ResolvedDestination {
  kind: "file" | "dir";
  path: string;
}

export function resolveDestination(
  outPath: string | undefined,
  urlCount: number,
): ResolvedDestination {
  if (!outPath) {
    return { kind: "dir", path: process.cwd() };
  }
  const abs = isAbsolute(outPath) ? outPath : resolve(process.cwd(), outPath);
  const endsWithMd = abs.toLowerCase().endsWith(".md");
  const existsAsFile = existsSync(abs) && statSync(abs).isFile();
  if (endsWithMd || existsAsFile) {
    if (urlCount > 1) {
      throw new Error(`Multiple URLs need an output directory; got file: ${abs}`);
    }
    return { kind: "file", path: abs };
  }
  return { kind: "dir", path: abs };
}

export function writeMarkdown(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content, "utf8");
}
