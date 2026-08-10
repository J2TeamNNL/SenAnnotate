// =============================================================================
// End-to-end test
// =============================================================================
//
// Loads the built extension into a real Chromium, drives the toolbar against a
// Vue 3 fixture, and asserts the report actually names the right .vue file.
//
// Playwright is not a dependency of this package — it is resolved from the
// monorepo, where it is already installed with its browsers.
//
//   node test/e2e.mjs
// =============================================================================

import { createServer } from "node:http";
import { copyFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = join(ROOT, "dist");
const FIXTURES = join(HERE, "fixtures");

// Borrowed from the monorepo rather than vendored into this package: Playwright
// (with its browsers) and the Vue 3 global build are both already installed there.
//
// Found by walking up rather than by counting `../` segments, because a fixed depth
// breaks the moment this runs from anywhere but the project root — a git worktree under
// .claude/worktrees/ resolves `../..` to .claude/ and the suite dies before launching a
// browser.
const MONOREPO = findMonorepoRoot(ROOT);
const PLAYWRIGHT_HOST = MONOREPO ? join(MONOREPO, "storefront_playwright_test") : null;
const VUE_SOURCE = MONOREPO
  ? join(MONOREPO, "storefront_v5/node_modules/vue/dist/vue.global.js")
  : null;
const VUE_VENDORED = join(FIXTURES, "vendor/vue.global.js");

/** Nearest ancestor directory containing `storefront_playwright_test`, or null. */
function findMonorepoRoot(from) {
  let current = from;
  for (let depth = 0; depth < 8; depth++) {
    if (existsSync(join(current, "storefront_playwright_test"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

async function ensureVueFixture() {
  if (existsSync(VUE_VENDORED)) return;
  if (!VUE_SOURCE || !existsSync(VUE_SOURCE)) {
    throw new Error(
      `Vue 3 dev build not found${VUE_SOURCE ? ` at ${VUE_SOURCE}` : " (no monorepo root above " + ROOT + ")"}. ` +
        `Install storefront_v5's dependencies, or drop a copy of vue.global.js at ${VUE_VENDORED}.`,
    );
  }
  mkdirSync(dirname(VUE_VENDORED), { recursive: true });
  await copyFile(VUE_SOURCE, VUE_VENDORED);
}

// -----------------------------------------------------------------------------
// Harness
// -----------------------------------------------------------------------------

const results = [];

function check(name, condition, detail = "") {
  results.push({ name, ok: !!condition, detail });
  console.log(`${condition ? "  ok  " : " FAIL "} ${name}${detail && !condition ? ` — ${detail}` : ""}`);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function startServer() {
  const server = createServer(async (request, response) => {
    const path = (request.url ?? "/").split("?")[0];
    try {
      const file = join(FIXTURES, path === "/" ? "vue3-app.html" : path);
      if (!file.startsWith(FIXTURES)) throw new Error("outside fixtures");
      const body = await readFile(file);
      response.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end("not found");
    }
  });

  return new Promise((done) => {
    server.listen(0, "127.0.0.1", () => done({ server, port: server.address().port }));
  });
}

// -----------------------------------------------------------------------------

async function main() {
  await ensureVueFixture();

  if (!existsSync(join(FIXTURES, "prod", "tracer", "app.js"))) {
    console.log("building production fixtures (first run only)…");
    const { buildProdFixtures } = await import("./build-prod-fixtures.mjs");
    await buildProdFixtures();
  }

  if (!PLAYWRIGHT_HOST) {
    throw new Error(
      `No monorepo root found above ${ROOT} — expected an ancestor containing ` +
        `storefront_playwright_test, which is where Playwright and its browsers live.`,
    );
  }
  const require = createRequire(join(PLAYWRIGHT_HOST, "package.json"));
  const { chromium } = require("playwright");

  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const profile = mkdtempSync(join(tmpdir(), "senannotate-e2e-"));

  // Extensions require a persistent context, and a headed one: the old headless
  // shell does not load them.
  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });

  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });

    // -------------------------------------------------------------------------
    // Vue 3
    // -------------------------------------------------------------------------
    const page = await context.newPage();
    await page.goto(`${base}/vue3-app.html`);
    await page.waitForSelector(".base-button");

    const toolbar = page.locator(".toolbar");
    await toolbar.waitFor({ state: "visible", timeout: 10_000 });
    check("toolbar is injected", await toolbar.isVisible());

    const stackBadge = page.locator(".stack-badge");
    const stackText = (await stackBadge.textContent())?.trim() ?? "";
    check("Vue 3 is detected and versioned", /^Vue 3 \d+\./.test(stackText), `badge read "${stackText}"`);

    // Regression: a dev build must not be reported as production. The old check
    // looked at the mount container, which never carries `__vueParentComponent`,
    // so every real app looked like a production build.
    check(
      "a dev build is not mislabelled as production",
      (await stackBadge.getAttribute("data-warn")) === null,
      `title read "${await stackBadge.getAttribute("title")}"`,
    );

    // Turn on inspect mode and hover the button.
    await page.locator(".tool--brand").click();
    await page.locator(".base-button").first().hover();

    const hoverLabel = page.locator(".highlight__label");
    await hoverLabel.waitFor({ state: "visible", timeout: 5_000 });
    const hoverText = (await hoverLabel.textContent())?.trim() ?? "";
    check(
      "hover names the owning component",
      hoverText.includes("<BaseButton>"),
      `label read "${hoverText}"`,
    );
    check(
      "hover shows the exact source line",
      hoverText.includes("src/components/BaseButton.vue:12:5"),
      `label read "${hoverText}"`,
    );

    // Click to annotate.
    await page.locator(".base-button").first().click();
    const composer = page.locator(".composer");
    await composer.waitFor({ state: "visible", timeout: 5_000 });

    const composerText = (await composer.textContent()) ?? "";
    check(
      "composer reports the source file",
      composerText.includes("src/components/BaseButton.vue:12:5"),
      composerText.slice(0, 200),
    );
    check(
      "composer reports the component ancestry",
      composerText.includes("<App> <TheSidebar> <BaseButton>"),
      composerText.slice(0, 200),
    );
    check(
      "composer reports the component props",
      composerText.includes('label="Save changes"'),
      composerText.slice(0, 200),
    );

    await page.locator(".composer__input").fill("This button should be the primary action.");
    await page.locator(".composer .button--primary").click();
    await composer.waitFor({ state: "detached", timeout: 5_000 });

    check("a marker appears", (await page.locator(".marker").count()) === 1);
    check("the toolbar count updates", (await page.locator(".count").textContent()) === "1");

    // Copy the report.
    await page.locator('.tool[title^="Annotations"]').click();
    await page.locator(".panel").waitFor({ state: "visible", timeout: 5_000 });
    await page.locator(".panel .button--primary").click();

    const report = await page.evaluate(() => navigator.clipboard.readText());
    check(
      "report includes the source line",
      report.includes("**Source:** src/components/BaseButton.vue:12:5"),
      report.slice(0, 300),
    );
    check(
      "report includes the component ancestry",
      report.includes("**Components:** <App> <TheSidebar> <BaseButton>"),
      report.slice(0, 300),
    );
    check(
      "report includes the typed feedback",
      report.includes("This button should be the primary action."),
      report.slice(0, 300),
    );
    check("report names the stack", report.includes("Vue 3"), report.slice(0, 300));

    // Persistence across a reload.
    await page.reload();
    await page.waitForSelector(".base-button");
    await page.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForTimeout(600);
    check("annotations survive a reload", (await page.locator(".marker").count()) === 1);

    // -------------------------------------------------------------------------
    // vite-plugin-vue-tracer (current Nuxt DevTools)
    // -------------------------------------------------------------------------
    const tracer = await context.newPage();
    await tracer.goto(`${base}/vue3-tracer.html`);
    await tracer.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });

    check(
      "tracer pages write no data-v-inspector attributes",
      (await tracer.locator("[data-v-inspector]").count()) === 0,
    );

    await tracer.locator(".tool--brand").click();
    await tracer.locator(".base-button").click();
    await tracer.locator(".composer").waitFor({ state: "visible", timeout: 5_000 });

    const tracerText = (await tracer.locator(".composer").textContent()) ?? "";
    check(
      "tracer gives an exact line and column",
      tracerText.includes("app/components/BaseButton.vue:42:7"),
      tracerText.slice(0, 200),
    );
    await tracer.locator(".composer .icon-button").click();

    // An uninstrumented child must inherit its nearest recorded ancestor.
    await tracer.locator(".badge").click();
    await tracer.locator(".composer").waitFor({ state: "visible", timeout: 5_000 });
    const badgeText = (await tracer.locator(".composer").textContent()) ?? "";
    check(
      "an uninstrumented child walks up to its recorded ancestor",
      badgeText.includes("app/components/BaseButton.vue:42:7"),
      badgeText.slice(0, 200),
    );

    // -------------------------------------------------------------------------
    // Vue 2 shape
    // -------------------------------------------------------------------------
    const legacy = await context.newPage();
    await legacy.goto(`${base}/vue2-app.html`);
    await legacy.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });

    const legacyBadge = (await legacy.locator(".stack-badge").textContent())?.trim() ?? "";
    check("Vue 2 is detected", legacyBadge.startsWith("Vue 2"), `badge read "${legacyBadge}"`);

    await legacy.locator(".tool--brand").click();
    await legacy.locator(".add-to-cart").click();
    const legacyComposer = legacy.locator(".composer");
    await legacyComposer.waitFor({ state: "visible", timeout: 5_000 });

    const legacyText = (await legacyComposer.textContent()) ?? "";
    check(
      "Vue 2 ancestry is walked via $parent",
      legacyText.includes("<App> <ProductCard> <AddToCartButton>"),
      legacyText.slice(0, 200),
    );
    check(
      "Vue 2 source comes from $options.__file",
      legacyText.includes("src/components/AddToCartButton.vue"),
      legacyText.slice(0, 200),
    );

    // -------------------------------------------------------------------------
    // Diagnostics — the tester workflow on a page that misbehaves
    // -------------------------------------------------------------------------
    const buggy = await context.newPage();
    await buggy.goto(`${base}/buggy.html`);
    await buggy.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });

    // Use the app first, the way a tester would, before reaching for the toolbar.
    const SECRET_INPUT = "SHOULD-NOT-APPEAR@example.com";
    await buggy.locator("#email").fill(SECRET_INPUT);
    await buggy.locator(".save").click();
    await buggy.waitForTimeout(600);

    // Then annotate the thing that looked wrong.
    await buggy.locator(".tool--brand").click();
    await buggy.locator("#headline").click();
    await buggy.locator(".composer").waitFor({ state: "visible", timeout: 5_000 });
    await buggy.locator(".composer__input").fill("Saving does nothing and the page errors.");
    await buggy.locator(".composer .button--primary").click();
    await buggy.locator(".composer").waitFor({ state: "detached", timeout: 5_000 });

    await buggy.locator('.tool[title^="Annotations"]').click();
    await buggy.locator(".panel").waitFor({ state: "visible", timeout: 5_000 });

    const summary = buggy.locator(".capture-summary");
    await summary.waitFor({ state: "visible", timeout: 5_000 });
    const summaryText = (await summary.textContent())?.trim() ?? "";
    check(
      "the panel shows what was captured",
      /console error/.test(summaryText) && /failed request/.test(summaryText),
      `summary read "${summaryText}"`,
    );

    await buggy.locator(".panel .button--primary").click();
    const bugReport = await buggy.evaluate(() => navigator.clipboard.readText());

    check("report has steps to reproduce", bugReport.includes("## Steps to reproduce"));
    check(
      "steps name the field without its value",
      bugReport.includes("Edited Email address"),
      bugReport.slice(0, 400),
    );
    check("steps record the click", /Clicked button "Save changes"/.test(bugReport));
    // The headline was only ever clicked to annotate it, never as part of using
    // the app — so it must not show up as a step towards reproducing anything.
    check(
      "annotating is not recorded as a repro step",
      !/Clicked h1 "Account settings"/.test(bugReport),
      bugReport.slice(0, 500),
    );

    check("report has a console errors section", bugReport.includes("## Console errors"));
    check(
      "console.error calls are captured",
      bugReport.includes("Settings form failed validation"),
      bugReport.slice(0, 600),
    );
    check(
      "unhandled rejections are captured",
      bugReport.includes("saveProfile() timed out"),
      bugReport.slice(0, 600),
    );
    check(
      "uncaught throws are captured",
      bugReport.includes("Cannot read properties of undefined"),
      bugReport.slice(0, 600),
    );

    check("report has a failed requests section", bugReport.includes("## Failed requests"));
    check(
      "failing fetch is captured with its status",
      /404.*GET \/api\/seller\/profile/.test(bugReport),
      bugReport.slice(0, 800),
    );
    check(
      "failing XHR is captured",
      /POST \/api\/seller\/settings/.test(bugReport),
      bugReport.slice(0, 800),
    );

    // The two privacy guarantees, asserted rather than assumed.
    check(
      "credentials in URLs are redacted",
      bugReport.includes("access_token=%5Bredacted%5D") || bugReport.includes("access_token=[redacted]"),
      bugReport.slice(0, 800),
    );
    check("the raw token never appears", !bugReport.includes("SUPERSECRET123"));
    check("typed input values never appear", !bugReport.includes(SECRET_INPUT));

    // -------------------------------------------------------------------------
    // Production builds — what a QA tester actually gets
    // -------------------------------------------------------------------------
    // Three minified production builds of the same app. This is the measurement
    // behind the "what works on production?" answer in the README.
    const prodResults = {};

    for (const variant of ["stock", "devtools", "tracer"]) {
      const prod = await context.newPage();
      await prod.goto(`${base}/prod/${variant}/index.html`);
      await prod.waitForSelector(".base-button");
      await prod.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });
      await prod.waitForTimeout(1_200);

      await prod.locator(".tool--brand").click();
      await prod.locator(".base-button").first().click();
      await prod.locator(".composer").waitFor({ state: "visible", timeout: 5_000 });

      prodResults[variant] = {
        badge: (await prod.locator(".stack-badge").textContent())?.trim() ?? "",
        composer: (await prod.locator(".composer").textContent()) ?? "",
      };
      await prod.close();
    }

    // Stock: the metadata genuinely is not in the page. Annotating must still work.
    check(
      "stock production build reports no component data",
      !prodResults.stock.composer.includes("<BaseButton>"),
      prodResults.stock.composer.slice(0, 200),
    );
    check(
      "stock production build still identifies the element",
      prodResults.stock.composer.includes('button "Save changes"'),
      prodResults.stock.composer.slice(0, 200),
    );
    check(
      "stock production build is flagged as production",
      prodResults.stock.badge.length > 0,
      `badge read "${prodResults.stock.badge}"`,
    );

    // __VUE_PROD_DEVTOOLS__ alone: real component names survive minification,
    // because the SFC compiler emits `__name` in production too.
    check(
      "__VUE_PROD_DEVTOOLS__ restores the component tree on production",
      prodResults.devtools.composer.includes("<App> <TheSidebar> <BaseButton>"),
      prodResults.devtools.composer.slice(0, 200),
    );
    // @vitejs/plugin-vue re-attaches `__file` once devtools are enabled, but in a
    // production build it deliberately stores only the basename
    // (`isProduction ? path.basename(filename) : filename`). So you get a filename
    // to grep for, not a path, and never a line number.
    check(
      "__VUE_PROD_DEVTOOLS__ gives a bare filename, not a path",
      prodResults.devtools.composer.includes("BaseButton.vue") &&
        !prodResults.devtools.composer.includes("src/components/BaseButton.vue"),
      prodResults.devtools.composer.slice(0, 250),
    );
    check(
      "__VUE_PROD_DEVTOOLS__ alone gives no line number",
      !/\.vue:\d+/.test(prodResults.devtools.composer),
      prodResults.devtools.composer.slice(0, 250),
    );

    // Plus the tracer (which needs sourcemaps at build time): exact positions.
    check(
      "the tracer restores exact source positions on production",
      /src\/components\/BaseButton\.vue:\d+:\d+/.test(prodResults.tracer.composer),
      prodResults.tracer.composer.slice(0, 250),
    );

    // -------------------------------------------------------------------------
    // Non-Vue page — must degrade, not break
    // -------------------------------------------------------------------------
    // Served over http rather than `setContent`, which would leave the page on
    // about:blank where content scripts do not run.
    const plain = await context.newPage();
    await plain.goto(`${base}/plain.html`);
    await plain.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });

    // The retry in boot() waits 1.5s before giving up on a late-hydrating app.
    await plain.waitForTimeout(2_000);
    const plainBadgeVisible = await plain.locator(".stack-badge").isVisible();
    check(
      "non-framework pages show no stack badge",
      !plainBadgeVisible,
      `badge visible: ${plainBadgeVisible}`,
    );

    await plain.locator(".tool--brand").click();
    await plain.locator(".cta").click();
    await plain.locator(".composer").waitFor({ state: "visible", timeout: 5_000 });
    const plainComposer = (await plain.locator(".composer").textContent()) ?? "";
    check(
      "non-Vue pages still annotate",
      plainComposer.includes('button "Click me"'),
      plainComposer.slice(0, 200),
    );

    await plain.locator(".composer__input").fill("Make this button wider.");
    await plain.locator(".composer .button--primary").click();
    await plain.locator(".composer").waitFor({ state: "detached", timeout: 5_000 });

    await plain.locator('.tool[title^="Annotations"]').click();
    await plain.locator(".panel").waitFor({ state: "visible", timeout: 5_000 });
    await plain.locator(".panel .button--primary").click();
    const plainReport = await plain.evaluate(() => navigator.clipboard.readText());

    check(
      "non-framework reports omit the Stack line and never mention Vue",
      !plainReport.includes("Stack:") && !/Vue/.test(plainReport),
      plainReport.slice(0, 300),
    );
  } finally {
    await context.close();
    server.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

main()
  .then(() => {
    const failed = results.filter((result) => !result.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  })
  .catch((error) => {
    console.error("\nharness error:", error);
    process.exit(1);
  });
