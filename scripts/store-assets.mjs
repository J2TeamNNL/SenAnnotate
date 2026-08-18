// =============================================================================
// Chrome Web Store graphic assets
// =============================================================================
//
// Produces every image the Web Store listing form asks for, into `store/out/`:
//
//   store-icon-128.png     128x128, the mark inset to 96x96 as the guidelines ask
//   screenshot-1..5.jpg    1280x800, the real extension driven against store/demo.html
//   screenshot-6..7.jpg    1280x800, README-only — the listing form takes five
//   promo-small-440.jpg    440x280
//   promo-marquee-1400.jpg 1400x560
//
// JPEG for everything except the icon: the form requires "JPEG or 24-bit PNG (no alpha)"
// for screenshots and tiles, and JPEG cannot carry an alpha channel by construction — so
// there is nothing to get wrong. The icon stays PNG because it needs transparency.
//
// The screenshots are photographs of the built extension doing its job, not mockups. That
// costs a Playwright run but means the listing cannot drift from the product.
//
//   SENANNOTATE_PLAYWRIGHT_DIR=… node scripts/store-assets.mjs
// =============================================================================

import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchWithExtension } from "../test/verify-harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "store/out");
const VUE = join(ROOT, "test/fixtures/vendor/vue.global.js");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css",
};

if (!existsSync(VUE)) {
  console.error(
    `Missing ${VUE}.\n` +
      `  The demo page is a real Vue app, so it needs the same vendored dev build the\n` +
      `  test suite uses. Run \`npm test\` once with SENANNOTATE_VUE_GLOBAL set, which\n` +
      `  copies it in, or copy a vue.global.js there yourself.`,
  );
  process.exit(1);
}

// -----------------------------------------------------------------------------
// Server — repo root, plus a deliberately failing API
// -----------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  let path = req.url.split("?")[0];

  // The report's first line is the page's pathname, so the demo is served from a path a
  // real app would have. `/store/demo.html` in a store screenshot advertises that the
  // screenshot came from a local file.
  if (path === "/orders") path = "/store/demo.html";

  // The demo calls this on load. A 500 gives the diagnostics capture a real failed
  // request to report, rather than a staged screenshot of one.
  if (path.startsWith("/api/")) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end('{"error":"summary unavailable"}');
    return;
  }

  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// -----------------------------------------------------------------------------
// Capture
// -----------------------------------------------------------------------------

await mkdir(OUT, { recursive: true });
const { context, cleanup } = await launchWithExtension({ viewport: { width: 1280, height: 800 } });

// Screenshot 5 is the *copied* report, read back off the clipboard — and a clipboard
// read without this raises a permission prompt that nothing in a headed run answers,
// so the script hangs forever instead of failing. `test/e2e.mjs` and
// `test/verify-real-sites.mjs` both grant it; this one never did, which is why it
// stopped silently after screenshot 3.
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
const made = [];

const shot = async (page, name, locator) => {
  const file = join(OUT, name);
  const options = { path: file, type: "jpeg", quality: 92 };
  await (locator ? locator.screenshot(options) : page.screenshot(options));
  made.push(name);
  console.log(`  wrote ${name}`);
};

const page = await context.newPage();
await page.goto(`${base}/orders`);
await page.locator(".toolbar").waitFor({ state: "visible", timeout: 20_000 });
// The stack badge only appears once the Vue app is found, which is the signal that the
// detector has run — screenshotting before it lands would show a page with no badge.
await page.locator(".stack-badge").waitFor({ state: "visible", timeout: 20_000 });

await page.locator(".tool--brand").click();

// The hover label is anchored to the element's left edge and does not clamp to the
// viewport, so a target near the right edge has its label clipped. Both hero shots
// therefore point at the left-hand cards, where the whole label fits.
const centre = (box) => [box.x + box.width / 2, box.y + box.height / 2];

// --- 1. inspect mode, hovering an element -----------------------------------
//
// Everything our UI shows on hover — the highlight label, a toolbar button's tooltip —
// belongs in a screenshot only when that is what the screenshot is about.
//
// Parked on one of our *own* card headers, not on empty page canvas: the overlay ignores
// itself, so the highlight clears. Empty canvas is not empty — it is some container, and
// hovering it washed the whole viewport in accent tint in the first take.
const parkPointer = async (target, selector) => {
  await target.locator(selector).hover();
  await target.waitForTimeout(400);
};

// A table cell: wide, mid-canvas, and with empty space above it for the label. Hovering a
// small element like a delta chip puts the label over neighbouring text.
const cell = await page.locator(".cell-name").first().boundingBox();
await page.mouse.move(...centre(cell), { steps: 6 });
await page.waitForTimeout(700);
// The label is what the screenshot is advertising, so check it says what we think rather
// than trusting the coordinates — a stale bounding box lands the hover somewhere else and
// the mistake is only visible by eye.
// The label carries the owning component and its source, not a description of the element,
// so that is what gets checked: a cell of the table must resolve to OrderTable.
const hovered = (await page.locator(".highlight__label").first().textContent()) ?? "";
console.log(`  hover label reads: ${hovered.trim()}`);
if (!hovered.includes("OrderTable.vue")) {
  throw new Error(`Screenshot 1 is hovering the wrong element: "${hovered.trim()}"`);
}
await shot(page, "screenshot-1-inspect.jpg");

// --- 2. the composer, showing source and component chain --------------------
const revenue = await page.locator(".stat-card").first().boundingBox();
await page.mouse.click(...centre(revenue));
await page.locator(".composer").waitFor({ state: "visible", timeout: 10_000 });
await page.locator(".composer__input").fill("Add a 7-day sparkline under this number.");
await page.waitForTimeout(300);
await shot(page, "screenshot-2-composer.jpg");
await page.locator(".composer .button--primary").click();
await page.locator(".composer").waitFor({ state: "detached", timeout: 10_000 });

// A second note, so the panel and the report both show more than one item — and so the
// report carries the `button "New order"` entry the promo tile quotes.
const button = await page.locator(".primary-button").boundingBox();
await page.mouse.click(...centre(button));
await page.locator(".composer").waitFor({ state: "visible", timeout: 10_000 });
await page.locator(".composer__input").fill("Make this the primary action.");
await page.locator(".composer .button--primary").click();
await page.locator(".composer").waitFor({ state: "detached", timeout: 10_000 });

// --- 3. the panel: the list, and what was captured automatically -------------
await page.locator('.tool[aria-label^="Annotations"]').click();
await page.locator(".panel").waitFor({ state: "visible", timeout: 10_000 });
await page.locator(".capture-summary").waitFor({ state: "visible", timeout: 10_000 });
// Park the pointer off the toolbar first: a toolbar button names itself on hover now, and
// the tooltip sat across the panel's Copy report button in the first take.
await parkPointer(page, ".panel .card__title");
await shot(page, "screenshot-3-panel.jpg");

// --- 5. the report it produces (captured here, while the panel is open) ------
await page.locator(".panel .button--primary").click();
const report = await page.evaluate(() => navigator.clipboard.readText());
if (!report || !report.includes("PrimaryButton")) {
  throw new Error(`The copied report looks wrong, refusing to ship it:\n${report.slice(0, 300)}`);
}
await page.locator('.tool[aria-label^="Annotations"]').click();

// --- 4. marquee: selecting several elements at once --------------------------
await page.keyboard.press("3");
const first = await page.locator(".stat-card").first().boundingBox();
const third = await page.locator(".stat-card").nth(2).boundingBox();
await page.mouse.move(first.x - 14, first.y - 14);
await page.mouse.down();
await page.mouse.move(third.x + third.width + 14, third.y + third.height + 14, { steps: 12 });
// Two frames, because the drag repaints on requestAnimationFrame.
await page.evaluate(
  () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
);
await shot(page, "screenshot-4-marquee.jpg");
await page.mouse.up();

// Releasing commits the selection, and committing is async — an Escape sent straight after
// lands before the composer exists and cancels nothing, leaving a three-element composer
// sitting in the corner of every shot below. Measured that way in the first take.
await page.locator(".composer").waitFor({ state: "visible", timeout: 10_000 });
await page.keyboard.press("Escape");
await page.locator(".composer").waitFor({ state: "detached", timeout: 10_000 });
// The `Copied 2 annotations` toast from the report above lasts 2.2s and would otherwise
// appear in the two shots that follow, advertising something they are not about.
await page.waitForTimeout(2400);

// --- 6. the settings card, which lives on the toolbar rather than in the popup ----
// README-only: the Web Store form takes five screenshots and these are the five above.
await page.keyboard.press("1");
await page.locator(".tool--settings").click();
await page.locator(".settings").waitFor({ state: "visible", timeout: 10_000 });
await parkPointer(page, ".settings .card__title");
await shot(page, "screenshot-6-settings.jpg");
await page.locator(".tool--settings").click();

// --- 7. the markup editor, between capturing a screenshot and saving it -----------
const target = await page.locator(".cell-name").first().boundingBox();
await page.mouse.click(...centre(target));
await page.locator(".composer").waitFor({ state: "visible", timeout: 10_000 });
await page.locator(".composer__input").fill("This column needs the store name too.");
await page.locator('.composer .button[title^="Capture"]').click();
await page.locator(".shot-editor").waitFor({ state: "visible", timeout: 15_000 });

// A drawn box, so the shot shows the editor being used rather than merely open. Drawn
// across the middle of the canvas: a shape at the edge reads as a rendering artefact.
const canvas = await page.locator(".shot-editor__canvas").boundingBox();
if (canvas) {
  await page.mouse.move(canvas.x + canvas.width * 0.12, canvas.y + canvas.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width * 0.62, canvas.y + canvas.height * 0.78, { steps: 10 });
  await page.mouse.up();
}
await parkPointer(page, ".shot-editor .card__title");
await shot(page, "screenshot-7-markup.jpg");
// Cancel: this run must leave nothing on the disk, and the composer with it.
await page.locator(".shot-editor .button--ghost").first().click();
await page.keyboard.press("Escape");

// --- the report screenshot ---------------------------------------------------
const reportPage = await context.newPage();
await reportPage.setViewportSize({ width: 1280, height: 800 });
await reportPage.goto(`${base}/store/report.html`);
// This shot is "the report, pasted where you work" — the extension's own toolbar showing
// up in the corner of it just confuses what is being pointed at. The content script is
// loaded on every page, so it is hidden rather than absent.
await reportPage.addStyleTag({
  content: `[data-senannotate-ui] { display: none !important; }`,
});
await reportPage.evaluate((text) => {
  // Colour the Markdown structure without a highlighter dependency: headings and the
  // `**Label:**` prefixes are the only two shapes in the output.
  const escape = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  document.getElementById("out").innerHTML = text
    .split("\n")
    .map((line) => {
      const safe = escape(line);
      if (line.startsWith("#")) return `<span class="md-h">${safe}</span>`;
      return safe.replace(/^(\*\*[^*]+:\*\*)/, '<span class="md-k">$1</span>');
    })
    .join("\n");
}, report);
await reportPage.waitForTimeout(300);
await shot(reportPage, "screenshot-5-report.jpg");

// --- promo tiles ------------------------------------------------------------
const tiles = await context.newPage();
await tiles.setViewportSize({ width: 1560, height: 1000 });
await tiles.goto(`${base}/store/tiles.html`);
await tiles.waitForTimeout(400);
await shot(tiles, "promo-small-440.jpg", tiles.locator("#small"));
await shot(tiles, "promo-marquee-1400.jpg", tiles.locator("#marquee"));

// --- store icon: the mark inset to 96x96 in a 128x128 canvas ----------------
//
// The Web Store asks for 128x128 with the artwork occupying the middle 96x96, so the
// icons all optically match in the listing grid. The shipped manifest icon fills more of
// its canvas by design — it has to survive 16px in the browser toolbar — so the store
// version is padded rather than reused as-is.
const icon = await context.newPage();
await icon.setViewportSize({ width: 128, height: 128 });
await icon.setContent(`
  <style>
    html, body { margin: 0; width: 128px; height: 128px; }
    body { display: grid; place-items: center; }
    img { width: 96px; height: 96px; }
  </style>
  <img src="${base}/dist/icons/icon-128.png" />
`);
await icon.locator("img").waitFor({ state: "visible" });
await icon.waitForTimeout(200);
await icon.screenshot({ path: join(OUT, "store-icon-128.png"), omitBackground: true });
made.push("store-icon-128.png");
console.log("  wrote store-icon-128.png");

// The exact report text, so the listing description can quote it without re-running this.
await writeFile(join(OUT, "report-sample.md"), report, "utf8");

await cleanup();
server.close();

console.log(`\n${made.length + 1} files in store/out/\n`);
