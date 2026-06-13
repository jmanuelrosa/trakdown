import { chmodSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const pkgPath = resolve(here, "../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const outfile = resolve(here, "../dist/index.js");

await build({
  entryPoints: [resolve(here, "../src/index.ts")],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  external: ["playwright-core"],
  banner: { js: "#!/usr/bin/env node" },
  define: {
    "process.env.TRAKDOWN_VERSION": JSON.stringify(pkg.version),
  },
  legalComments: "none",
  logLevel: "info",
});

chmodSync(outfile, 0o755);
