import { existsSync } from "node:fs";
import { join } from "node:path";

const DIACRITICS = /[̀-ͯ]/g;

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugifyUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    const combined = path ? `${u.hostname}-${path}` : u.hostname;
    return slugifyTitle(combined) || u.hostname.replace(/[^a-z0-9]+/gi, "-");
  } catch {
    return "capture";
  }
}

export function timestampSlug(): string {
  return `capture-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

export function resolveCollision(dir: string, baseName: string, ext = ".md"): string {
  let candidate = join(dir, `${baseName}${ext}`);
  let n = 2;
  while (existsSync(candidate)) {
    candidate = join(dir, `${baseName}-${n}${ext}`);
    n += 1;
  }
  return candidate;
}
