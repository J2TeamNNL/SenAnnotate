// =============================================================================
// Wiki illustrations
// =============================================================================
//
// The images the GitHub wiki needs and the Web Store listing never did: the toolbar on
// its own, the collapsed pill, multi-pick, text mode, the triage filter, the popup, and
// the accent picker.
//
//   SENANNOTATE_PLAYWRIGHT_DIR=… node scripts/wiki-assets.mjs
//
// Output goes to `wiki/images/` and is **committed**, unlike `store/out/` which is
// gitignored and regenerated per release. The wiki is a separate git repository with no
// build step of any kind, so an image it references has to be a real file sitting next
// to the page — there is nothing there that could generate one.
//
// PNG rather than the listing's JPEG. The listing form bans alpha and rewards small
// files; a wiki page is read at 100% on a desktop screen, where JPEG ringing around
// 11px monospace source paths is the thing you notice. These are screenshots of text.
//
// Everything here is a photograph of the built extension driven against `store/demo.html`
// — the same app the listing screenshots use, so the two sets look like one product. The
// alternative, mockups, drifts from the code silently and is only caught by someone
// noticing that a button in the docs no longer exists.
//
// The seven images already in `store/screenshots/` are copied in rather than re-shot:
// same demo, same accent, and re-shooting them would produce two subtly different
// versions of the same picture for no gain.
// =============================================================================

import { createServer } from "node:http";
import { readFile, mkdir, copyFile } from "node:fs/promises";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launchWithExtension } from "../test/verify-harness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "wiki/images");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css",
};

// -----------------------------------------------------------------------------
// Server — repo root, plus the deliberately failing API the demo calls on load
// -----------------------------------------------------------------------------

const server = createServer(async (req, res) => {
  let path = req.url.split("?")[0];

  // The report's first line is the page's pathname. `/orders` is what a real app's URL
  // looks like; `/store/demo.html` would advertise that the picture came from a file.
  if (path === "/orders") path = "/store/demo.html";

  // A real 500, so the diagnostics panel has a genuine failed request to show rather
  // than a staged one.
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

// Granted for the *fixture* origin only. The popup lives on `chrome-extension://`, which
// this does not cover, and a clipboard read there raises a prompt nothing in a headed run
// answers — the script would hang rather than fail. So the popup is photographed and
// never driven; see the popup section below.
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });

const made = [];

const shot = async (target, name, locator, clip) => {
  const file = join(OUT, name);
  const options = { path: file, type: "png", ...(clip ? { clip } : {}) };
  await (locator ? target.locator(locator).screenshot(options) : target.screenshot(options));
  made.push(name);
  console.log(`  wrote ${name}`);
};

const page = await context.newPage();
await page.goto(`${base}/orders`);
await page.locator(".toolbar").waitFor({ state: "visible", timeout: 20_000 });
// The stack badge appearing is the signal that the Vue detector has actually run.
// Shooting before it lands photographs a page that looks like it found no framework.
await page.locator(".stack-badge").waitFor({ state: "visible", timeout: 20_000 });

const centre = (box) => [box.x + box.width / 2, box.y + box.height / 2];

// Park the pointer on one of our own surfaces before a shot that is not about hovering:
// the overlay ignores itself, so the highlight clears. Empty page canvas is not empty —
// it is some container, and hovering it tints the whole viewport.
const park = async () => {
  await page.locator(".table-card-title").hover();
  await page.waitForTimeout(300);
};

// --- the toolbar, and the line under it --------------------------------------
//
// Cropped to the dock rather than the pill: the hint line is the part of this UI that
// makes the rest legible without a manual, and a picture of the pill alone would cut off
// the one element the page about it is arguing for.
await page.locator(".tool--brand").click();
await park();
await shot(page, "toolbar.png", ".toolbar-dock");

// --- multi-pick: three elements nowhere near each other -----------------------
//
// `locator.click({ modifiers })` rather than `page.mouse.click(x, y, { modifiers })`:
// the mouse API takes no `modifiers` option and silently ignores one, so the first
// attempt photographed an ordinary click — a composer open on one element — under the
// caption "three elements picked". `"ControlOrMeta"` is Playwright's own platform split,
// which is what `test/e2e.mjs` uses for the same gesture.
for (const selector of [".stat-card", ".primary-button", ".nav-item"]) {
  await page.locator(selector).first().click({ modifiers: ["ControlOrMeta"], timeout: 5_000 });
  await page.waitForTimeout(250);
}
await park();
await shot(page, "multi-pick.png");

// Escape drops the set without leaving inspect mode — the documented way out.
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// --- text mode ----------------------------------------------------------------
await page.keyboard.press("2");
await page.waitForTimeout(300);
const subtitle = await page.locator(".subtitle").boundingBox();
await page.mouse.move(subtitle.x + 4, subtitle.y + subtitle.height / 2);
await page.mouse.down();
await page.mouse.move(subtitle.x + subtitle.width * 0.72, subtitle.y + subtitle.height / 2, { steps: 18 });
await page.mouse.up();
await page.waitForTimeout(700);
await shot(page, "text-mode.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(200);
await page.keyboard.press("1");
await page.waitForTimeout(200);

// --- three real notes, so the shots below have something to be about ----------
//
// The panel, the count on the collapsed handle and the popup are all pictures of
// *state*. Shooting them on an empty page produces three screenshots of an empty list,
// which is exactly the thing a manual must not illustrate. So the notes are made the
// way a user makes them — click, type, submit — rather than written into storage.
const notes = [
  [".primary-button", "Make this the primary action and move it above the divider."],
  [".cell-name", "Customer names should link through to the customer record."],
  [".filter-chip", "This filter resets itself when the table reloads."],
];
for (const [selector, text] of notes) {
  await page.locator(selector).first().click({ timeout: 5_000 });
  await page.locator(".composer__input").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator(".composer__input").fill(text);
  // `.composer .button--primary`, not `.submit` — that class belongs to a page fixture
  // in the e2e suite, not to this UI.
  await page.locator(".composer .button--primary").click({ timeout: 5_000 });
  await page.waitForTimeout(400);
}

// --- the collapsed toolbar ----------------------------------------------------
//
// Shot only now, because the count on the handle is the whole point: an empty dot would
// not show that collapsing keeps the number in view.
// The `»` button rather than the `H` key. The last thing clicked was the composer's
// Add note, which lives in our shadow root, so the page no longer has the keyboard —
// `H` went nowhere and the first take was a picture of an expanded toolbar captioned
// "collapsed". The button is also what the page about it tells the reader to click.
await page.locator('.tool[aria-label^="Collapse toolbar"]').click();
await page.waitForTimeout(900);
await shot(page, "toolbar-collapsed.png", ".toolbar-dock");
await page.locator(".toolbar-dock").click();
await page.waitForTimeout(900);

// --- the panel, with one note ticked done -------------------------------------
//
// Ticking one is what puts something in each of the three filter buckets, so All/Open/Done
// reads as a real choice rather than three buttons over one identical list.
await page.locator('.tool[aria-label^="Annotations"]').click();
await page.locator(".panel").waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(500);
const ticks = page.locator(".entry__status");
if (await ticks.count()) {
  await ticks.first().click();
  await page.waitForTimeout(500);
}
await park();
await shot(page, "panel-triage.png");

// --- settings, scrolled to Appearance -----------------------------------------
await page.locator('.tool[aria-label^="Settings"]').click();
await page.locator(".settings").waitFor({ state: "visible", timeout: 10_000 });
await page.waitForTimeout(500);
// The accent row is the one people look for and the one furthest down the card.
await page.locator(".settings").evaluate((card) => {
  const swatches = card.querySelector("[class*='accent']");
  (swatches ?? card).scrollIntoView({ block: "center" });
});
await page.waitForTimeout(400);
await shot(page, "settings-card.png", ".settings");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// --- the popup ----------------------------------------------------------------
//
// Photographed, never driven. Its buttons reach `navigator.clipboard`, and the grant
// above does not extend to `chrome-extension://` — a click here would raise a permission
// prompt with nothing to answer it and the script would hang instead of failing.
const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
const extensionId = new URL(worker.url()).host;
const popup = await context.newPage();
await popup.setViewportSize({ width: 420, height: 640 });
await popup.goto(`chrome-extension://${extensionId}/popup.html`);
await popup.waitForTimeout(1_200);

// Clipped below the status line and the inspect toggle. Both describe *the active tab*,
// and the active tab here is the popup's own page — so a full-height shot is captioned
// "the popup" while showing "Not available on this page", which is true of this window
// and false of the popup as a user meets it. The session tools below are identical
// either way, and they are what the page using this image is about.
await shot(popup, "popup-session.png", undefined, { x: 0, y: 190, width: 420, height: 335 });
await popup.close();

// --- carry the listing screenshots across --------------------------------------
for (const name of ["inspect", "composer", "panel", "marquee", "markup", "settings", "report"]) {
  await copyFile(join(ROOT, "store/screenshots", `${name}.jpg`), join(OUT, `${name}.jpg`));
  made.push(`${name}.jpg`);
}

await cleanup();
server.close();

console.log(`\n${made.length} files in wiki/images/`);
