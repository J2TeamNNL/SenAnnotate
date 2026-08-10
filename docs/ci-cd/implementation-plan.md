# CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every push to `main` typechecks, builds and packs with the zip downloadable as an artifact; pushing a `vX.Y.Z` tag publishes a GitHub Release with that zip attached, refusing to run if the tag disagrees with `package.json`.

**Architecture:** Two independent GitHub Actions workflows sharing no state — `ci.yml` on push/PR, `release.yml` on tags. Neither runs the Playwright suite, which cannot work on a bare runner (see `context.md`). One change to `build.mjs` makes `package.json` the only version that reaches a shipped artifact, so the two workflows never disagree about what they are building.

**Tech Stack:** GitHub Actions (`checkout@v4`, `setup-node@v4`, `upload-artifact@v4`), the pre-installed `gh` CLI, Node 22, esbuild, TypeScript.

## Global Constraints

- **Spec:** `docs/ci-cd/{brief,context,plan}.md`. Read `context.md` first — it explains why e2e is absent, which otherwise looks like an oversight.
- **CI must not run `npm test`.** It needs Playwright with browsers, a Vue dev build, and vite plus the Vue plugin — none of them dependencies of this package, all supplied externally. A runner has nothing to supply. It also needs a *headed* Chromium.
- **Node:** `node-version: 22` in both workflows; `"engines": { "node": ">=20" }` in `package.json` — floor, not pin.
- **`release.yml` requires `permissions: contents: write`.** The default token is read-only; without this, creating a release fails with 403.
- **Artifact retention: 14 days.**
- **Commits:** Conventional Commits. **Never** add a `Co-Authored-By` or `Claude-Session` trailer.
- **Zero new dependencies.** devDependencies stay `esbuild`, `typescript`, `@types/chrome`.
- **This session cannot observe workflow runs** — no `gh` CLI, no token, private repo. Every step below is verified by running the workflow's own commands locally; the two steps that genuinely require GitHub are marked **[NEEDS USER]**.
- **Working directory:** the repo root. Edits require a worktree (`EnterWorktree`) in a background session.

---

### Task 1: Make `package.json` the only version that ships

`build.mjs`'s `copyStatic()` copies `static/manifest.json` verbatim, so its `version` is what ends up in `dist/`. Meanwhile `scripts/pack.mjs` names the archive from `package.json`. Bump one and the zip's filename disagrees with the manifest inside it. This task removes that possibility before any release pipeline is built on top of it.

**Files:**
- Modify: `build.mjs` — imports (line 14), `copyStatic()` (lines 24-26)
- Modify: `package.json` — add `engines`
- Modify: `package-lock.json` — via npm, not by hand

**Interfaces:**
- Produces: `dist/manifest.json` whose `version` always equals `package.json`'s, regardless of what `static/manifest.json` says. Tasks 2 and 3 both rely on this, and on `scripts/pack.mjs` continuing to name the archive `senannotate-<package.json version>.zip` at the repo root.

- [ ] **Step 1: Write the failing check**

There is no unit-test framework here — the e2e suite is the only harness and it cannot run in CI. So the check is a command, and it is made to fail honestly first by pointing `static/manifest.json` at a version that must not survive a build.

Temporarily set the `version` in `static/manifest.json` to `0.0.0-wrong`:

```bash
node -e "
const fs = require('node:fs');
const p = 'static/manifest.json';
const m = JSON.parse(fs.readFileSync(p, 'utf8'));
m.version = '0.0.0-wrong';
fs.writeFileSync(p, JSON.stringify(m, null, 2) + '\n');
console.log('static/manifest.json version =', m.version);
"
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
npm run build >/dev/null 2>&1
node -e "
const pkg = require('./package.json').version;
const dist = require('./dist/manifest.json').version;
console.log('package.json:', pkg, '| dist/manifest.json:', dist);
if (pkg !== dist) { console.error('FAIL: versions differ'); process.exit(1); }
console.log('PASS');
"
```

Expected: `package.json: 0.2.0 | dist/manifest.json: 0.0.0-wrong` then `FAIL: versions differ`, exit 1.

If this *passes* at this point, stop — something already stamps the version and this task's premise is wrong.

- [ ] **Step 3: Implement the stamp**

In `build.mjs`, extend the `node:fs` import on line 14:

```js
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
```

Then replace `copyStatic()` (lines 24-26):

```js
/**
 * Copies static/ verbatim into dist/, then overwrites the manifest's version from
 * package.json.
 *
 * Without this, the version ships from two uncoordinated places: the zip's filename
 * comes from package.json (scripts/pack.mjs) while the manifest inside it comes from
 * static/manifest.json. Bumping one and forgetting the other produces an archive whose
 * name and contents disagree, which is invisible until someone opens it.
 */
function copyStatic() {
  cpSync(resolve(ROOT, "static"), DIST, { recursive: true });

  const { version } = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const manifestPath = resolve(DIST, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
```

It goes inside `copyStatic()` rather than beside its call site so that `npm run dev` gets it too — a watched build should not differ from a released one.

- [ ] **Step 4: Run the check to verify it passes**

```bash
npm run build >/dev/null 2>&1
node -e "
const pkg = require('./package.json').version;
const dist = require('./dist/manifest.json').version;
console.log('package.json:', pkg, '| dist/manifest.json:', dist);
if (pkg !== dist) { console.error('FAIL: versions differ'); process.exit(1); }
console.log('PASS');
"
```

Expected: `package.json: 0.2.0 | dist/manifest.json: 0.2.0` then `PASS`.

- [ ] **Step 5: Restore `static/manifest.json`**

```bash
git checkout static/manifest.json
grep '"version"' static/manifest.json
```

Expected: `"version": "0.2.0"` — back to the committed value. The stamp keeps working; `static/manifest.json` is simply no longer authoritative.

- [ ] **Step 6: Confirm the stamp survives a real build and the manifest is still valid JSON**

```bash
npm run build 2>&1 | tail -2
node -e "
const m = require('./dist/manifest.json');
console.log('version:', m.version, '| manifest_version:', m.manifest_version, '| name:', m.name);
if (m.manifest_version !== 3) { console.error('FAIL: manifest_version corrupted'); process.exit(1); }
console.log('PASS');
"
```

Expected: `version: 0.2.0 | manifest_version: 3 | name: SenAnnotate — visual annotator`, then `PASS`. Rewriting JSON risks mangling the rest of the file, so this checks a neighbouring field too.

- [ ] **Step 7: Add the Node floor**

In `package.json`, add after `"type": "module",`:

```json
  "engines": {
    "node": ">=20"
  },
```

- [ ] **Step 8: Regenerate the lockfile and prove `npm ci` still works**

Editing `package.json` can desynchronise the lockfile, and `npm ci` — which both workflows run — **fails hard** on a mismatch rather than repairing it. Catch that here rather than in CI:

```bash
npm install --package-lock-only
npm ci
```

Expected: both succeed. `npm ci` deletes and reinstalls `node_modules`, so it takes longer than `npm install`; that is the point — it is exactly what the runner does.

- [ ] **Step 9: Confirm the toolchain still works after the reinstall**

```bash
npm run typecheck && npm run pack && ls senannotate-*.zip
```

Expected: typecheck silent, pack prints `packed → …/senannotate-0.2.0.zip`, and the file is listed.

- [ ] **Step 10: Commit**

```bash
git add build.mjs package.json package-lock.json
git commit -m "build: stamp dist/manifest.json version from package.json

The zip's filename came from package.json while the manifest inside it came
from static/manifest.json, copied verbatim. Nothing reconciled them, so
bumping one shipped an archive whose name and contents disagreed. Also adds
an engines floor so the Node requirement is stated once."
```

---

### Task 2: `ci.yml` — check every push

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: Task 1's guarantee that `npm run pack` emits `senannotate-<package.json version>.zip` at the repo root — the artifact glob depends on it.

- [ ] **Step 1: Create the workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - run: npm run typecheck

      # Redundant with `pack`, which builds first — kept because it fails with a
      # clearer message than a pack failure would, and esbuild takes milliseconds.
      - run: npm run build

      - run: npm run pack

      # Lets a build from any commit be downloaded and loaded into Chrome without
      # cutting a release. `if-no-files-found: error` because a silent empty upload
      # would look identical to a successful one.
      - uses: actions/upload-artifact@v4
        with:
          name: senannotate-zip
          path: senannotate-*.zip
          if-no-files-found: error
          retention-days: 14
```

Note the deliberate `if-no-files-found: error` — the default is `warn`, which would let a broken pack path pass as green.

**The Playwright suite is intentionally absent.** See Global Constraints.

- [ ] **Step 2: Validate the YAML parses**

A malformed workflow does not fail loudly — GitHub may simply not run it, which reads as "nothing happened".

```bash
node -e "
const fs = require('node:fs');
const text = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
// No YAML parser is available without adding a dependency, so assert the structural
// essentials instead: the keys that must exist, and no tab characters (tabs are
// invalid YAML indentation and are easy to introduce by accident).
const required = ['name:', 'on:', 'jobs:', 'runs-on:', 'steps:', 'actions/checkout@v4', 'actions/setup-node@v4', 'actions/upload-artifact@v4'];
const missing = required.filter((k) => !text.includes(k));
if (missing.length) { console.error('FAIL missing:', missing); process.exit(1); }
if (text.includes('\t')) { console.error('FAIL: tab character in YAML'); process.exit(1); }
console.log('PASS: structure and indentation look sane');
"
```

Expected: `PASS: structure and indentation look sane`.

- [ ] **Step 3: Run the workflow's exact command sequence locally**

This is the real verification available without GitHub. If these four commands pass here on a clean install, the only remaining failure modes are runner-specific (a missing system tool).

```bash
npm ci && npm run typecheck && npm run build && npm run pack && ls -la senannotate-*.zip
```

Expected: all succeed; the zip is listed.

- [ ] **Step 4: Check the runner has the system tools `pack` shells out to**

`scripts/pack.mjs` shells out to two system commands. Confirm which:

```bash
grep -n 'execFileSync' scripts/pack.mjs
```

Expected: two hits — `cp` (line 37) and `zip` (line 40). `cp` is coreutils and always present; `zip` is the uncertain one on `ubuntu-latest`. It is expected to be present there; **if the first CI run fails at the pack step, this is why** — the fix is adding `- run: sudo apt-get install -y zip` before it. Do not pre-emptively add that step: an unnecessary install on every run is worse than a one-line fix if it turns out to be needed.

- [ ] **Step 5: Prove a type error would actually turn CI red**

Spec success criterion 2 is "a commit that breaks `tsc` turns `ci.yml` red". A workflow step fails when its command exits non-zero, so this reduces to checking that `npm run typecheck` does exit non-zero — worth confirming rather than assuming, and far cheaper than pushing a deliberately broken commit to `main`.

```bash
printf 'const wrong: number = "not a number";\n' > src/__citest.ts
npm run typecheck > /dev/null 2>&1; echo "typecheck exit code: $?"
rm src/__citest.ts
```

Expected: a non-zero exit code (tsc uses 2 for type errors). A failing step fails the job, so a non-zero exit is exactly what turns the run red.

Then confirm the temporary file is gone — leaving it behind would break the very check it was proving:

```bash
git status --short
```

Expected: only `.github/workflows/ci.yml` as untracked; no `src/__citest.ts`.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck, build and pack on every push to main

Uploads the packed zip as a 14-day artifact so any commit can be loaded into
Chrome without cutting a release. Does not run the Playwright suite: it
resolves Playwright and Vue from sibling monorepo directories a bare checkout
does not have, and needs a headed Chromium."
```

---

### Task 3: `release.yml` — publish on a tag

**Files:**
- Create: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: Task 1's version stamp, so the manifest inside the released zip matches the tag.

- [ ] **Step 1: Create the workflow**

```yaml
name: Release

on:
  push:
    tags: ["v*.*.*"]

# The default workflow token is read-only. Without this, `gh release create` fails
# with 403 — which reads like an auth problem rather than a missing permission.
permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      # Runs before `npm ci` so a mismatch costs seconds, not a full install.
      # `node -p` rather than jq: Node is already here, jq is one more assumption.
      - name: Check the tag matches package.json
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          PKG="$(node -p "require('./package.json').version")"
          echo "tag=$TAG package.json=$PKG"
          if [ "$TAG" != "$PKG" ]; then
            echo "::error::Tag v$TAG does not match package.json version $PKG. Bump package.json, or delete and re-push the tag."
            exit 1
          fi

      - run: npm ci

      - run: npm run pack

      - name: Create the release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "$GITHUB_REF_NAME" senannotate-*.zip --generate-notes
```

- [ ] **Step 2: Validate the YAML parses and the permission is present**

```bash
node -e "
const fs = require('node:fs');
const text = fs.readFileSync('.github/workflows/release.yml', 'utf8');
const required = ['tags:', 'contents: write', 'GITHUB_REF_NAME', 'gh release create', '--generate-notes', 'GH_TOKEN'];
const missing = required.filter((k) => !text.includes(k));
if (missing.length) { console.error('FAIL missing:', missing); process.exit(1); }
if (text.includes('\t')) { console.error('FAIL: tab character in YAML'); process.exit(1); }
console.log('PASS');
"
```

Expected: `PASS`. `contents: write` is asserted explicitly because omitting it is the single most likely first-run failure.

- [ ] **Step 3: Prove the guard logic rejects a mismatch**

Run the guard's exact shell locally with a deliberately wrong tag:

```bash
GITHUB_REF_NAME=v9.9.9
TAG="${GITHUB_REF_NAME#v}"
PKG="$(node -p "require('./package.json').version")"
echo "tag=$TAG package.json=$PKG"
if [ "$TAG" != "$PKG" ]; then echo "GUARD WOULD FAIL (correct)"; else echo "GUARD WOULD PASS (wrong!)"; fi
```

Expected: `tag=9.9.9 package.json=0.2.0` then `GUARD WOULD FAIL (correct)`.

- [ ] **Step 4: Prove the guard accepts a match**

A guard that rejects everything is equally broken, so check both directions:

```bash
GITHUB_REF_NAME=v0.2.0
TAG="${GITHUB_REF_NAME#v}"
PKG="$(node -p "require('./package.json').version")"
echo "tag=$TAG package.json=$PKG"
if [ "$TAG" = "$PKG" ]; then echo "GUARD WOULD PASS (correct)"; else echo "GUARD WOULD FAIL (wrong!)"; fi
```

Expected: `tag=0.2.0 package.json=0.2.0` then `GUARD WOULD PASS (correct)`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: publish a GitHub Release when a v*.*.* tag is pushed

Refuses to release if the tag disagrees with package.json, checked before
install so a mismatch costs seconds. Needs contents:write — the default
workflow token is read-only and would 403 on release creation."
```

---

### Task 4: Document the release procedure

The tag-must-match rule is a trap for whoever tags next unless it is written down where they will look.

**Files:**
- Modify: `README.md` — the `## Development` section

- [ ] **Step 1: Add a Releasing subsection**

Insert immediately after the `### The two verify-* scripts` subsection (which ends at
`README.md:291`) and before `## Layout` (`README.md:292`).

The block below is the literal Markdown to insert — it is fenced with four backticks here
so the inner three-backtick blocks survive; insert its **contents**, not the outer fence.

````markdown
### Releasing

CI checks every push to `main` (typecheck, build, pack) and attaches the packed zip to
the run as a 14-day artifact, so any commit can be loaded into Chrome without cutting a
release.

To publish a release:

```bash
# 1. Run the full suite — CI does not, see docs/ci-cd/context.md
npm test

# 2. Bump the version. package.json is the only place; the build stamps
#    dist/manifest.json from it.
#    …edit "version" in package.json…

git commit -am "chore: release 0.3.0"

# 3. Tag it. The tag must match package.json exactly or the workflow refuses
#    to release.
git tag v0.3.0
git push && git push --tags
```

`.github/workflows/release.yml` then builds, packs, and creates a GitHub Release with
`senannotate-<version>.zip` attached and generated release notes.

If the tag and `package.json` disagree, the workflow fails before installing anything and
creates nothing. Fix `package.json`, then delete and re-push the tag:

```bash
git tag -d v0.3.0 && git push origin :refs/tags/v0.3.0
```
````

- [ ] **Step 2: Verify the README's own instructions are accurate**

Every command quoted above must be one that actually exists. Check the two that are easy to get wrong:

```bash
node -e "
const s = require('./package.json').scripts;
for (const k of ['test', 'pack', 'build', 'typecheck']) {
  if (!s[k]) { console.error('FAIL: no npm script named', k); process.exit(1); }
}
console.log('PASS: every npm script referenced by the README exists');
"
grep -c "Releasing" README.md
```

Expected: `PASS: …` and `1`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document the release procedure and the tag-match rule"
```

---

### Task 5: Land it and confirm on GitHub **[NEEDS USER]**

Everything so far is verified locally. Two things can only be observed on GitHub, and this session has no `gh` CLI and no token for a private repo — so these steps produce a request, not a claim.

**Files:** none

- [ ] **Step 1: Push to `main`**

The workflows must exist on `main` before a tag can use them.

```bash
git push origin HEAD:main
```

Then confirm the push landed rather than trusting the exit code:

```bash
echo "local:  $(git rev-parse HEAD)"
echo "origin: $(git ls-remote origin refs/heads/main | cut -f1)"
```

Expected: identical.

- [ ] **Step 2: Ask the user to confirm `ci.yml` ran green**

Report to the user: the push should have triggered **CI** at
`https://github.com/thangnm93/SenAnnotate/actions`. Ask them to confirm:
1. the run is green;
2. the run page has a `senannotate-zip` artifact;
3. downloading and unzipping it yields a folder with `manifest.json` that Chrome loads.

**If the pack step failed:** it is almost certainly missing `zip` on the runner — add
`- run: sudo apt-get install -y zip` before `- run: npm run pack` in `ci.yml`.

Do not proceed to Step 3 until CI is confirmed green. Tagging on top of a broken pipeline
just produces a second failure to debug.

- [ ] **Step 3: Test the guard's failure path first, with a deliberately wrong tag**

Prove the guard works *before* relying on it for a real release.

```bash
git tag v9.9.9
git push origin v9.9.9
```

Ask the user to confirm at the Actions tab that **Release** ran and **failed at "Check the
tag matches package.json"**, and that **no release was created** at
`https://github.com/thangnm93/SenAnnotate/releases`.

Then remove the tag:

```bash
git tag -d v9.9.9
git push origin :refs/tags/v9.9.9
```

- [ ] **Step 4: Cut the real release**

`package.json` is already `0.2.0` and that version has never been released, so no bump is
needed — tag it as-is.

```bash
git tag v0.2.0
git push origin v0.2.0
```

Ask the user to confirm a Release `v0.2.0` exists with `senannotate-0.2.0.zip` attached,
and — the point of Task 1 — that `manifest.json` inside that zip reads `"version": "0.2.0"`.

> This creates a real, user-visible GitHub Release. That is the intended outcome (a first
> release of the current code in a private repo), but it is an outward-facing action: if
> the user would rather not publish yet, stop after Step 3 and leave Task 5 incomplete.

- [ ] **Step 5: Record what actually happened**

Replace the `### Build` `_Not started._` placeholder in `docs/ci-cd/changelog.md` with what
was done, what CI reported, whether `zip` turned out to be present on the runner, and
anything that differed from this plan.

- [ ] **Step 6: Commit and push the log**

```bash
git add docs/ci-cd/changelog.md
git commit -m "docs: record the CI/CD build log"
git push origin HEAD:main
```

---

## Risks

- **`permissions: contents: write` omitted** → 403 at release creation. Asserted in Task 3 Step 2 precisely because it is the likeliest first-run failure.
- **`zip` absent on `ubuntu-latest`** → pack fails. Diagnosis and one-line fix are in Task 2 Step 4 and Task 5 Step 2. Not pre-emptively installed, because an unnecessary apt install on every run costs more than the fix would.
- **`npm ci` failing on a desynchronised lockfile** — the real reason Task 1 Step 8 runs it locally. `npm ci` refuses to reconcile, unlike `npm install`.
- **`upload-artifact` silently uploading nothing** if pack's output path ever changes. Mitigated with `if-no-files-found: error`.
- **Tag pushed before its commit** → the workflow builds a tree without the bump and the guard correctly rejects it. `git push && git push --tags`, in that order, as documented in Task 4.
- **This plan cannot self-verify the GitHub half.** Steps needing the user are marked; treat their absence of confirmation as "unverified", not "working".
