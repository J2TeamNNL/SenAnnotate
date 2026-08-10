// =============================================================================
// Verify: real websites
// =============================================================================
//
// `e2e.mjs` proves the fixtures work. This proves the claim the fixtures cannot:
// that the extension behaves sensibly on pages nobody wrote for it, with real CSP
// and real framework markup, and that a page with no framework produces a report
// that never mentions Vue.
//
// REQUIRES NETWORK. Kept out of `npm test` for that reason — a hermetic suite
// should not go dark when a third-party site is down or redesigned. Assertions are
// deliberately loose (does a toolbar appear, is the badge hidden, does the report
// name the element) so a copy change upstream does not read as a regression here.
//
//   npm run verify:sites
// =============================================================================

import { join } from "node:path";
import {
  SHOTS,
  annotateAndCopy,
  check,
  launchWithExtension,
  report,
  reportLine,
} from "./verify-harness.mjs";

const SITES = [
  {
    label: "example.com (plain HTML)",
    url: "https://example.com/",
    clickable: "h1",
    shot: "real-example.png",
  },
  {
    label: "react.dev (React, own CSP)",
    url: "https://react.dev/",
    clickable: "h1",
    shot: "real-reactdev.png",
  },
];

async function verifySite(context, { label, url, clickable, shot }) {
  const page = await context.newPage();
  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: new URL(url).origin,
    });

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator(".toolbar").waitFor({ state: "visible", timeout: 20_000 });
    check(`${label}: toolbar is injected`, true);

    // boot() retries for ~1.5s before concluding there is no framework, so a
    // late-hydrating app is not misreported. Outwait it.
    await page.waitForTimeout(2_500);
    const badgeVisible = await page.locator(".stack-badge").isVisible();
    check(`${label}: no stack badge`, !badgeVisible, `badge visible: ${badgeVisible}`);

    const output = await annotateAndCopy(page, clickable, "Verification note.");

    check(
      `${label}: report omits Stack and never says Vue`,
      !output.includes("Stack:") && !/Vue/.test(output),
      output.slice(0, 250),
    );
    check(
      `${label}: report still identifies the element`,
      /### 1\. /.test(output) && reportLine(output, "Location") !== null,
      output.slice(0, 250),
    );

    await page.screenshot({ path: join(SHOTS, shot) });
    console.log(`        → screenshots/${shot}`);
    console.log(
      output
        .split("\n")
        .slice(0, 7)
        .map((line) => `        | ${line}`)
        .join("\n"),
    );
  } catch (error) {
    check(`${label}: completed without error`, false, String(error).split("\n")[0]);
  } finally {
    await page.close();
  }
}

const { context, cleanup } = await launchWithExtension();
try {
  for (const site of SITES) {
    await verifySite(context, site);
  }
} finally {
  await cleanup();
}

report();
