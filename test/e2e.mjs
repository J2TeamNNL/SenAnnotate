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

// Playwright (with its browsers) and a Vue 3 global build are not dependencies of this
// package — the extension itself ships none, and the suite is not worth adding three
// runtimes for. Both are supplied by the person running the suite:
//
//   SENANNOTATE_PLAYWRIGHT_DIR  a directory whose node_modules contains playwright
//   SENANNOTATE_VUE_GLOBAL      path to a vue.global.js dev build (copied in once)
//
// There is deliberately no default. A hardcoded guess only works on the machine it was
// written on, and a wrong guess fails later and more confusingly than an unset variable.
const PLAYWRIGHT_HOST = process.env.SENANNOTATE_PLAYWRIGHT_DIR || null;
const VUE_SOURCE = process.env.SENANNOTATE_VUE_GLOBAL || null;
const VUE_VENDORED = join(FIXTURES, "vendor/vue.global.js");

async function ensureVueFixture() {
  // Copied in on first run and kept (gitignored), so the variable is only needed once.
  if (existsSync(VUE_VENDORED)) return;

  if (!VUE_SOURCE) {
    throw new Error(
      `No Vue 3 dev build available.\n` +
        `  Set SENANNOTATE_VUE_GLOBAL to a vue.global.js, or drop one at:\n` +
        `    ${VUE_VENDORED}\n` +
        `  It ships in the vue package as vue/dist/vue.global.js.`,
    );
  }
  if (!existsSync(VUE_SOURCE)) {
    throw new Error(`SENANNOTATE_VUE_GLOBAL points at a file that does not exist:\n  ${VUE_SOURCE}`);
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
      `SENANNOTATE_PLAYWRIGHT_DIR is not set.\n` +
        `  Point it at a directory whose node_modules contains playwright and its\n` +
        `  browsers, e.g. any project where you have run:\n` +
        `    npm i -D playwright && npx playwright install chromium`,
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
    // Forensic element identification
    // -------------------------------------------------------------------------
    //
    // Everything below comes out of `src/content/identify.ts`, which had no coverage
    // at all: the pre-existing checks only ever asserted the element *name*. These
    // pin the rest of its observable output.
    //
    // Note the ordering: the detail level has to be Forensic *before* annotating.
    // `capture.ts` gates the forensic fields on the setting at capture time, so
    // switching the dropdown afterwards adds nothing to an existing annotation.

    const forensic = await context.newPage();
    await forensic.goto(`${base}/vue3-app.html`);
    await forensic.waitForSelector(".base-button");
    await forensic.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });
    await forensic.waitForTimeout(800);

    await forensic.locator('.tool[title^="Annotations"]').click();
    await forensic.locator(".panel").waitFor({ state: "visible", timeout: 10_000 });
    await forensic.locator(".panel select").selectOption("forensic");
    await forensic.waitForTimeout(400);
    await forensic.locator('.tool[title^="Annotations"]').click();
    await forensic.waitForTimeout(300);

    await forensic.locator(".tool--brand").click();
    await forensic.locator(".base-button").first().click({ force: true });
    await forensic.locator(".composer").waitFor({ state: "visible", timeout: 10_000 });
    await forensic.locator(".composer__input").fill("Forensic coverage.");
    await forensic.locator(".composer .button--primary").click();
    await forensic.locator(".composer").waitFor({ state: "detached", timeout: 10_000 });

    await forensic.locator('.tool[title^="Annotations"]').click();
    await forensic.locator(".panel").waitFor({ state: "visible", timeout: 10_000 });
    await forensic.locator(".panel .button--primary").click();
    const forensicReport = await forensic.evaluate(() => navigator.clipboard.readText());

    // Put the detail level back. It lives in chrome.storage.sync, so leaving it on
    // Forensic silently changes every later check in this file — which is exactly what
    // happened the first time this test was written.
    await forensic.locator(".panel select").selectOption("standard");
    await forensic.waitForTimeout(400);
    await forensic.close();

    /** One assertion per identify.ts export, so a regression names the function. */
    const forensicLine = (label) =>
      forensicReport.split("\n").find((l) => l.startsWith(`**${label}:**`)) ?? "";

    check(
      "identifyElement names an element by tag and text",
      forensicReport.includes('### 1. button "Save changes"'),
      forensicReport.slice(0, 200),
    );
    check(
      "buildSelector produces a rooted, nth-of-type qualified selector",
      /^\*\*Selector:\*\* `.*button:nth-of-type\(\d+\)`$/.test(forensicLine("Selector")),
      forensicLine("Selector"),
    );
    check(
      "getFullElementPath walks from body with tag#id.class segments",
      /^\*\*Full DOM path:\*\* body > div#app > .*button\.base-button$/.test(
        forensicLine("Full DOM path"),
      ),
      forensicLine("Full DOM path"),
    );
    // Author-written class names are kept whole. The previous implementation dropped the
    // last hyphenated segment as if it were a build hash, turning `base-button` into
    // `base` and `sidebar__title` into `sidebar_` — a worse grep target and a less
    // specific selector. Only segments that actually look like hashes are stripped now.
    check(
      "getElementClasses keeps author-written class names whole",
      forensicLine("Classes") === "**Classes:** base-button",
      forensicLine("Classes"),
    );
    check(
      "getNearbyText brackets the surrounding text",
      /^\*\*Context:\*\* \[before: ".*"\] Save changes \[after: ".*"\]$/.test(forensicLine("Context")),
      forensicLine("Context"),
    );
    check(
      "getForensicComputedStyles emits semicolon-separated declarations",
      /^\*\*Computed styles:\*\* color: .*; background-color: .*; font-size: .*$/.test(
        forensicLine("Computed styles"),
      ),
      forensicLine("Computed styles").slice(0, 160),
    );
    check(
      "getAccessibilityInfo reports focusability",
      forensicLine("Accessibility").includes("focusable"),
      forensicLine("Accessibility"),
    );
    check(
      "getNearbyElements names siblings with their classes and text",
      /^\*\*Nearby elements:\*\* h2\.sidebar__title "Navigation", button\.base-button "Discard"/.test(
        forensicLine("Nearby elements"),
      ),
      forensicLine("Nearby elements"),
    );

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

    // Checks that the *tool* claims no framework. Deliberately not `!/Vue/` over the
    // whole report: plain.html's own copy says "No Vue here", and forensic detail
    // surfaces page text, so that assertion failed for the page being right.
    check(
      "non-framework reports claim no framework",
      !plainReport.includes("Stack:") &&
        !plainReport.includes("**Components:**") &&
        !plainReport.includes("**Owner:**"),
      plainReport.slice(0, 300),
    );

    // -------------------------------------------------------------------------
    // React, Svelte, Angular
    // -------------------------------------------------------------------------
    //
    // Each fixture reproduces the framework's DOM shapes rather than loading the
    // real runtime — the same approach vue2-app.html already takes. It keeps the
    // suite hermetic and lets shapes be tested that a real build could not show
    // us on demand, such as a React 19 node with no `_debugSource`.

    /**
     * Annotate `selector` on `path` and return { badge, hover, report }.
     *
     * Clears any stored annotations first. Annotations persist per origin+pathname, and
     * these fixtures are visited more than once in the same browser profile — without
     * this, the second visit's report still contains the first visit's annotation and
     * every assertion reads the wrong section.
     */
    async function driveFramework(path, selector) {
      const page = await context.newPage();
      await page.goto(`${base}/${path}`);
      await page.locator(".toolbar").waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(2_000); // outwait boot()'s late-hydration retry

      if ((await page.locator(".marker").count()) > 0) {
        await page.locator('.tool[title^="Annotations"]').click();
        await page.locator(".panel").waitFor({ state: "visible", timeout: 10_000 });
        await page.locator('.panel .icon-button[title^="Clear all"]').click();
        await page.waitForTimeout(300);
        await page.locator('.tool[title^="Annotations"]').click();
        await page.waitForTimeout(300);
      }

      const badge = (await page.locator(".stack-badge").textContent())?.trim() ?? "";

      await page.locator(".tool--brand").click();
      await page.locator(selector).first().hover();
      await page.waitForTimeout(700);
      const hover = (await page.locator(".highlight__label").textContent())?.trim() ?? "";

      await page.locator(selector).first().click({ force: true });
      await page.locator(".composer").waitFor({ state: "visible", timeout: 10_000 });
      await page.locator(".composer__input").fill("Framework detector check.");
      await page.locator(".composer .button--primary").click();
      await page.locator(".composer").waitFor({ state: "detached", timeout: 10_000 });

      await page.locator('.tool[title^="Annotations"]').click();
      await page.locator(".panel").waitFor({ state: "visible", timeout: 10_000 });
      await page.locator(".panel .button--primary").click();
      const report = await page.evaluate(() => navigator.clipboard.readText());

      await page.close();
      return { badge, hover, report };
    }

    // React ---------------------------------------------------------------------
    const react = await driveFramework("react-app.html", ".save");
    check("React is detected and versioned", /^React 18 18\./.test(react.badge), `badge "${react.badge}"`);
    check(
      "React ancestry is walked via fiber.return",
      react.report.includes("**Components:** <App> <Toolbar> <SaveButton>"),
      react.report.slice(0, 400),
    );
    check(
      "React internals and HOC wrappers are filtered out",
      !react.report.includes("StrictMode") && !react.report.includes("Memo"),
      react.report.slice(0, 400),
    );
    check(
      "React source comes from _debugSource with line and column",
      react.report.includes("**Source:** src/components/SaveButton.jsx:12:5"),
      react.report.slice(0, 400),
    );

    // No _debugSource of its own, but an ancestor has one — walks up, exactly as the
    // Vue tracer and Svelte's __svelte_meta do.
    const reactInherited = await driveFramework("react-app.html", ".intro");
    check(
      "a node without its own _debugSource walks up to an ancestor that has one",
      reactInherited.report.includes("<Intro>") &&
        reactInherited.report.includes("**Source:** src/App.jsx:4:3"),
      reactInherited.report.slice(0, 400),
    );

    // React 19 shape: names survive, `_debugSource` is gone from the whole chain. Must
    // report components and omit Source rather than inventing a path.
    const react19 = await driveFramework("react-app.html", ".orphan");
    check(
      "React 19 (no _debugSource anywhere) still reports its components",
      react19.report.includes("<Shell> <OrphanButton>"),
      react19.report.slice(0, 400),
    );
    check(
      "React 19 reports no Source line rather than inventing one",
      !react19.report.includes("**Source:**"),
      react19.report.slice(0, 400),
    );

    // Svelte --------------------------------------------------------------------
    const svelte = await driveFramework("svelte-app.html", ".save");
    check("SvelteKit is detected and versioned", /^SvelteKit 5\./.test(svelte.badge), `badge "${svelte.badge}"`);
    check(
      "Svelte source comes from __svelte_meta with line and column",
      svelte.report.includes("**Source:** src/lib/SaveButton.svelte:12:5"),
      svelte.report.slice(0, 400),
    );
    check(
      "Svelte ancestry is recovered from distinct loc.file values",
      svelte.report.includes("**Components:** <+page> <Toolbar> <SaveButton>"),
      svelte.report.slice(0, 400),
    );

    // An element with no __svelte_meta of its own must inherit from its ancestors.
    const svelteBare = await driveFramework("svelte-app.html", ".bare");
    check(
      "an element without its own __svelte_meta walks up to an ancestor",
      svelteBare.report.includes("**Source:** src/routes/+page.svelte"),
      svelteBare.report.slice(0, 400),
    );

    // Angular -------------------------------------------------------------------
    const angular = await driveFramework("angular-app.html", ".save");
    check("Angular is detected and versioned", /^Angular 18 18\./.test(angular.badge), `badge "${angular.badge}"`);
    check(
      "Angular ancestry is walked via ng.getComponent",
      angular.report.includes("**Components:** <AppComponent> <ToolbarComponent> <SaveButtonComponent>"),
      angular.report.slice(0, 400),
    );
    check(
      "Angular reports no Source line, having no authoring positions",
      !angular.report.includes("**Source:**"),
      angular.report.slice(0, 400),
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
