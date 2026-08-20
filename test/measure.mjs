// =============================================================================
// Unit checks for the pure modules
// =============================================================================
//
// `measure.ts` and the formatters in `output.ts` are arithmetic and string building:
// the e2e suite can reach them only through a browser, a click and a clipboard read,
// which is a terrible feedback loop for a sign error. They are bundled here with the
// esbuild that already builds the extension — no test framework, no new dependency,
// the same `check()` shape `e2e.mjs` uses.
//
//   node test/measure.mjs
// =============================================================================

import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

let failures = 0;
function check(name, ok, detail = "") {
  if (ok) {
    console.log(`  ok  ${name}`);
    return;
  }
  failures++;
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Bundle a TS module to ESM in a temp dir and import it. */
async function load(entry, outName) {
  const dir = mkdtempSync(join(tmpdir(), "senannotate-unit-"));
  const outfile = join(dir, outName);
  await build({
    entryPoints: [join(ROOT, entry)],
    outfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",
  });
  const module = await import(pathToFileURL(outfile).href);
  rmSync(dir, { recursive: true, force: true });
  return module;
}

/** DOMRect is not in Node; the engine only needs these six fields. */
function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

const { roundPx, measureGap } = await load("src/content/measure.ts", "measure.mjs");

// --- roundPx -----------------------------------------------------------------
check("roundPx trims trailing zeros", roundPx(24.0) === 24, String(roundPx(24.0)));
check("roundPx keeps a sub-pixel gap", roundPx(0.5) === 0.5, String(roundPx(0.5)));
check("roundPx goes to two places", roundPx(12.3456) === 12.35, String(roundPx(12.3456)));
check("roundPx normalises negative zero", Object.is(roundPx(-0.001), 0), String(roundPx(-0.001)));

// --- measureGap: apart --------------------------------------------------------
// A at x 0..100, B at x 124..224 — 24px of clear space, same row.
const apart = measureGap(rect(0, 0, 100, 40), rect(124, 0, 100, 40));
check("a clear horizontal gap is positive", apart.gap.x === 24, JSON.stringify(apart.gap));
check("rows on the same line have no vertical gap", apart.gap.y === -40, JSON.stringify(apart.gap));
check("aligned top edges read 0", apart.edges.top === 0, String(apart.edges.top));
check("nothing is contained", apart.containment === "none", apart.containment);

// --- measureGap: touching -----------------------------------------------------
const touching = measureGap(rect(0, 0, 100, 40), rect(100, 0, 50, 40));
check("touching edges read 0", touching.gap.x === 0, String(touching.gap.x));

// --- measureGap: overlapping --------------------------------------------------
const overlap = measureGap(rect(0, 0, 100, 40), rect(88, 0, 100, 40));
check("an overlap is negative", overlap.gap.x === -12, String(overlap.gap.x));

// --- measureGap: containment --------------------------------------------------
const inside = measureGap(rect(0, 0, 200, 100), rect(20, 10, 100, 40));
check("b inside a is detected", inside.containment === "b-inside-a", inside.containment);
check("b inside a keeps usable edges", inside.edges.left === 20, String(inside.edges.left));

const outside = measureGap(rect(20, 10, 100, 40), rect(0, 0, 200, 100));
check("a inside b is detected", outside.containment === "a-inside-b", outside.containment);

// --- measureGap: edges and centre ---------------------------------------------
const shifted = measureGap(rect(0, 0, 100, 40), rect(8, 0, 80, 40));
check("left edge delta is signed", shifted.edges.left === 8, String(shifted.edges.left));
check("right edge delta is signed", shifted.edges.right === -12, String(shifted.edges.right));
check("centre delta is computed", shifted.center.x === -2, String(shifted.center.x));

// --- sub-pixel survives end to end --------------------------------------------
const hairline = measureGap(rect(0, 0, 100, 40), rect(100.5, 0, 100, 40));
check("a 0.5px gap is not rounded away", hairline.gap.x === 0.5, String(hairline.gap.x));

console.log(failures ? `\n${failures} failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
