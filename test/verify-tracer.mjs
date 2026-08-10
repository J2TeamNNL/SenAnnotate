// =============================================================================
// Verify: file:line:column against a real vite-plugin-vue-tracer
// =============================================================================
//
// `e2e.mjs` covers line/column against a fixture that reproduces the tracer's
// global store. This checks the real plugin in a real Nuxt dev server, which is a
// genuinely different signal — and it is the exact thing v0.1.0 got wrong: it
// looked for `data-v-inspector` attributes that current Nuxt no longer emits, and
// fell back to file-level silently. So this reads the plugin's own store out of the
// page rather than pattern-matching the output, because a `:12:5` in a report does
// not by itself prove the tracer is what produced it.
//
// REQUIRES A RUNNING NUXT DEV SERVER with devtools enabled. Kept out of
// `npm test` for that reason.
//
//   cd ../../storefront_v5
//   TMPDIR=/tmp/nx ./node_modules/.bin/nuxt dev --port 3005
//   # then, here:
//   npm run verify:tracer            # defaults to http://localhost:3005/
//   npm run verify:tracer -- <url>
//
// The short TMPDIR is required on macOS: Nuxt's vite-node unix socket path
// otherwise exceeds the 104-byte limit, the socket silently fails to bind, and
// every request 500s. Invoke the local binary directly rather than through `npx`,
// which under a shell wrapper can stay alive while logging nothing.
// =============================================================================

import { join } from "node:path";
import {
  SHOTS,
  check,
  launchWithExtension,
  report,
  reportLine,
  requireReachable,
} from "./verify-harness.mjs";

const url = process.argv[2] ?? "http://localhost:3005/";

// Elements likely to be rendered by a component, best first. Tried in order so
// this does not hinge on one selector surviving a redesign.
const CANDIDATES = ["a[href] img", "img", "a[href]", "button", "h1", "h2"];

await requireReachable(
  url,
  "Start a Nuxt dev server with devtools enabled first — see the header of this file.",
);

const { context, cleanup } = await launchWithExtension({ viewport: { width: 1440, height: 900 } });

try {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(url).origin,
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator(".toolbar").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(6_000); // let the app hydrate so Vue writes its expandos

  // --- Is the real tracer recording? `page.evaluate` runs in the page's own world,
  //     which is the only place this global is visible.
  const tracer = await page.evaluate(() => {
    const store = globalThis.__vue_tracer__;
    if (!store) return { present: false };
    return {
      present: true,
      hasData: !!store.hasData,
      keys: Object.keys(store),
      fileCount: store.fileToVNode instanceof Map ? store.fileToVNode.size : null,
    };
  });
  console.log("tracer store:", JSON.stringify(tracer));

  check("real vite-plugin-vue-tracer store is present", tracer.present);
  check("tracer has recorded positions", tracer.hasData, `hasData=${tracer.hasData}`);
  check("tracer recorded more than one file", (tracer.fileCount ?? 0) > 1, `fileCount=${tracer.fileCount}`);

  const badge = (await page.locator(".stack-badge").textContent())?.trim() ?? "";
  check("framework badge names Vue or Nuxt", /Vue|Nuxt/.test(badge), `badge "${badge}"`);

  // --- Hover a component-rendered element, preferring one that yields line+column.
  await page.locator(".tool--brand").click();

  let hover = "";
  let used = null;
  for (const selector of CANDIDATES) {
    const target = page.locator(selector).first();
    if ((await target.count()) === 0) continue;
    try {
      await target.scrollIntoViewIfNeeded({ timeout: 5_000 });
      await target.hover({ timeout: 5_000 });
      await page.waitForTimeout(1_200);
      hover = (await page.locator(".highlight__label").textContent())?.trim() ?? "";
      used = selector;
      if (/:\d+:\d+/.test(hover)) break;
    } catch {
      // try the next candidate
    }
  }

  if (!used) throw new Error(`none of these were hoverable on ${url}: ${CANDIDATES.join(", ")}`);
  console.log(`\nhovered "${used}" → label: "${hover}"`);
  check("hover label carries line and column", /:\d+:\d+/.test(hover), `label "${hover}"`);

  // --- Annotate it and read the report. Inspect mode is already on, so this does
  //     the composer/copy dance inline rather than via annotateAndCopy.
  await page.locator(used).first().click({ timeout: 15_000, force: true });
  await page.locator(".composer").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".composer__input").fill("Tracer line-number check.");
  await page.locator(".composer .button--primary").click();
  await page.locator(".composer").waitFor({ state: "detached", timeout: 15_000 });

  await page.locator('.tool[title^="Annotations"]').click();
  await page.locator(".panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".panel .button--primary").click();
  const output = await page.evaluate(() => navigator.clipboard.readText());

  await page.screenshot({ path: join(SHOTS, "tracer-dev-server.png") });

  const source = reportLine(output, "Source");
  const components = reportLine(output, "Components");
  console.log(`\n${source}\n${components}`);

  check("report source line has file:line:column", /^\*\*Source:\*\* \S+:\d+:\d+$/.test(source ?? ""), String(source));
  check("report has a component ancestry", components !== null, String(components));
  console.log(`        → screenshots/tracer-dev-server.png`);
} finally {
  await cleanup();
}

report();
