// =============================================================================
// Push wiki/ to the GitHub wiki repository
// =============================================================================
//
//   node scripts/wiki-sync.mjs            # show what would change
//   node scripts/wiki-sync.mjs --push     # commit and push it
//
// A GitHub wiki is a **separate git repository** — `<repo>.wiki.git` — with its own
// history, no pull requests and no CI. Anyone with push access can rewrite a page and
// nothing reviews it, so the source of truth lives in `wiki/` here, where a change goes
// through a PR like any other, and this script copies it out.
//
// The wiki repo does not exist until the first page is saved through the **web UI**, and
// GitHub exposes no API for wiki content. A clone of an uninitialised wiki fails with
// "Could not read from remote repository", which reads exactly like a permissions problem
// and is not one — so that case is detected and explained rather than passed through.
//
// Filenames are the page titles: `Framework-Support.md` is *Framework Support* at
// /wiki/Framework-Support. `_Sidebar.md` and `_Footer.md` render on every page. Nothing
// else in `wiki/` is special, and there are no subdirectories in the page namespace —
// `images/` is fine because it is referenced by path, not linked as a page.
// =============================================================================

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "wiki");
const REMOTE = "git@github.com:thangnm93/SenAnnotate.wiki.git";
const PUSH = process.argv.includes("--push");

const git = (cwd, ...args) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

if (!existsSync(SRC)) throw new Error(`No ${SRC}`);

const work = mkdtempSync(join(tmpdir(), "senannotate-wiki-"));

try {
  try {
    git(ROOT, "clone", "--depth", "1", REMOTE, work);
  } catch {
    console.error(
      `\nCould not clone ${REMOTE}\n\n` +
        `  The wiki repository is created lazily, when the first page is saved through\n` +
        `  the web UI — and there is no API that can do it for you. This is almost\n` +
        `  certainly what is wrong rather than an access problem.\n\n` +
        `  Fix it once:\n` +
        `    1. https://github.com/thangnm93/SenAnnotate/wiki\n` +
        `    2. "Create the first page", save anything at all\n` +
        `    3. run this again — Home.md below overwrites whatever you saved\n`,
    );
    process.exit(1);
  }

  // Copy pages, then images. Anything already in the wiki and no longer in `wiki/` is
  // left alone: a page deleted here is deleted deliberately, and deleting it there is
  // one `git rm` a human can make on purpose. Silently removing pages someone may have
  // linked to from an issue is the worse default.
  const pages = readdirSync(SRC).filter((f) => f.endsWith(".md"));
  for (const page of pages) copyFileSync(join(SRC, page), join(work, page));

  const images = join(SRC, "images");
  if (existsSync(images)) {
    mkdirSync(join(work, "images"), { recursive: true });
    for (const file of readdirSync(images)) {
      copyFileSync(join(images, file), join(work, "images", file));
    }
  }

  const status = git(work, "status", "--porcelain");
  if (!status.trim()) {
    console.log("wiki is already up to date");
    process.exit(0);
  }

  console.log(`${pages.length} pages, ${existsSync(images) ? readdirSync(images).length : 0} images\n`);
  console.log(status.trimEnd());

  if (!PUSH) {
    console.log("\n(dry run — re-run with --push to publish)");
    process.exit(0);
  }

  git(work, "add", "-A");
  git(work, "commit", "-m", `docs: sync wiki from wiki/ at ${git(ROOT, "rev-parse", "--short", "HEAD").trim()}`);
  git(work, "push");
  console.log("\npushed → https://github.com/thangnm93/SenAnnotate/wiki");
} finally {
  rmSync(work, { recursive: true, force: true });
}
