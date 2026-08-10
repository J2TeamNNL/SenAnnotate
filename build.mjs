// =============================================================================
// Build — three bundles + static passthrough
// =============================================================================
//
//   inspector.js   IIFE, MAIN world content script
//   content.js     IIFE, ISOLATED world content script
//   background.js  ESM, service worker
//   popup.js       IIFE, extension popup page
//
// MV3 content scripts are not ES modules, hence IIFE for the two of them.
// =============================================================================

import { context, build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(ROOT, "dist");
const WATCH = process.argv.includes("--watch");
const DEV = WATCH || process.argv.includes("--dev");

/**
 * Copies static/ verbatim into dist/, then overwrites the manifest's version from
 * package.json.
 *
 * Without this the version ships from two uncoordinated places: the zip's filename comes
 * from package.json (scripts/pack.mjs) while the manifest inside it comes from
 * static/manifest.json. Bumping one and forgetting the other produces an archive whose
 * name and contents disagree, which is invisible until someone opens it.
 *
 * The stamp lives in here rather than beside the call site so `npm run dev` gets it too —
 * a watched build should not differ from a released one.
 */
function copyStatic() {
  cpSync(resolve(ROOT, "static"), DIST, { recursive: true });

  const { version } = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const manifestPath = resolve(DIST, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

const shared = {
  bundle: true,
  target: ["chrome111"],
  logLevel: "info",
  sourcemap: DEV ? "inline" : false,
  minify: !DEV,
  legalComments: "none",
  // styles.css is imported as a string and injected into the shadow root
  loader: { ".css": "text" },
  define: { __DEV__: JSON.stringify(DEV) },
};

const targets = [
  { in: "src/inspector/index.ts", out: "inspector.js", format: "iife" },
  { in: "src/content/index.ts", out: "content.js", format: "iife" },
  { in: "src/background/index.ts", out: "background.js", format: "esm" },
  { in: "src/popup/index.ts", out: "popup.js", format: "iife" },
];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
copyStatic();

const configs = targets.map((t) => ({
  ...shared,
  entryPoints: [resolve(ROOT, t.in)],
  outfile: resolve(DIST, t.out),
  format: t.format,
}));

if (WATCH) {
  const contexts = await Promise.all(configs.map((c) => context(c)));
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("\nwatching… (reload the unpacked extension after each rebuild)\n");
} else {
  await Promise.all(configs.map((c) => build(c)));
  console.log(`\nbuilt → ${DIST}\n`);
}
