// =============================================================================
// Shared harness for the `verify-*` scripts
// =============================================================================
//
// `e2e.mjs` is hermetic: it serves its own fixtures and always runs. The
// `verify-*` scripts are different — each needs something the suite cannot
// guarantee (network access, or a dev server someone started). They are kept out
// of `npm test` for that reason and share this module instead, so neither the
// suite nor its fixtures are entangled with them.
//
// Every path here is resolved relative to this file. Nothing absolute — these
// scripts started life in a scratchpad and hardcoding survived the move once
// already.
// =============================================================================

import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(HERE, "..");
export const DIST = join(ROOT, "dist");
export const SHOTS = join(HERE, "screenshots");

// Borrowed from the monorepo rather than vendored, exactly as `e2e.mjs` does it.
const PLAYWRIGHT_HOST = resolve(ROOT, "../../storefront_playwright_test");

// -----------------------------------------------------------------------------
// Reporting — same shape as e2e.mjs so output reads identically
// -----------------------------------------------------------------------------

export const results = [];

export function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail && !ok ? ` — ${detail}` : ""}`);
}

export function report() {
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}

// -----------------------------------------------------------------------------
// Browser
// -----------------------------------------------------------------------------

/**
 * Launch a headed Chromium with the built extension loaded. Extensions need a
 * persistent context and a headed one — the old headless shell does not load them.
 *
 * Returns the context plus the teardown that removes its throwaway profile.
 */
export async function launchWithExtension({ viewport = { width: 1280, height: 800 } } = {}) {
  if (!existsSync(DIST)) {
    throw new Error(`No build at ${DIST}. Run \`npm run build\` first.`);
  }

  const require = createRequire(join(PLAYWRIGHT_HOST, "package.json"));
  const { chromium } = require("playwright");

  mkdirSync(SHOTS, { recursive: true });
  const profile = mkdtempSync(join(tmpdir(), "senannotate-verify-"));
  const context = await chromium.launchPersistentContext(profile, {
    headless: false,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    viewport,
  });

  return {
    context,
    async cleanup() {
      await context.close();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

/** Fail early and legibly rather than letting Playwright report a bare ECONNREFUSED. */
export async function requireReachable(url, hint) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(`${url} is not reachable (${String(error).split("\n")[0]}).${hint ? `\n${hint}` : ""}`);
  }
}

// -----------------------------------------------------------------------------
// Driving the extension
// -----------------------------------------------------------------------------

/**
 * Turn on inspect mode, annotate `selector`, then copy the report and return it.
 *
 * The copy deliberately goes through the real panel button rather than reading
 * state directly: the clipboard path is where user-activation bugs live.
 */
export async function annotateAndCopy(page, selector, note) {
  await page.locator(".tool--brand").click();
  await page.locator(selector).first().click({ timeout: 15_000, force: true });
  await page.locator(".composer").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".composer__input").fill(note);
  await page.locator(".composer .button--primary").click();
  await page.locator(".composer").waitFor({ state: "detached", timeout: 15_000 });

  await page.locator('.tool[title^="Annotations"]').click();
  await page.locator(".panel").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".panel .button--primary").click();
  return page.evaluate(() => navigator.clipboard.readText());
}

/** The report's `**Source:**` / `**Components:**` / … line, or null. */
export function reportLine(report, label) {
  return report.split("\n").find((line) => line.startsWith(`**${label}:**`)) ?? null;
}
