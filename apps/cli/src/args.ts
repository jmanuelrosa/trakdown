import { parseArgs } from "node:util";

export interface CliArgs {
  urls: string[];
  auth: boolean;
  noFrontmatter: boolean;
  outPath?: string;
  help: boolean;
  version: boolean;
}

export interface CliArgsError {
  error: string;
}

export function parseCliArgs(argv: string[]): CliArgs | CliArgsError {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      options: {
        auth: { type: "boolean" },
        "no-frontmatter": { type: "boolean" },
        out: { type: "string", short: "o" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
      allowPositionals: true,
      strict: true,
    });
    return {
      urls: positionals,
      auth: Boolean(values.auth),
      noFrontmatter: Boolean(values["no-frontmatter"]),
      outPath: typeof values.out === "string" ? values.out : undefined,
      help: Boolean(values.help),
      version: Boolean(values.version),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
