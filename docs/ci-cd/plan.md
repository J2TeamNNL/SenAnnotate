# Plan — CI/CD

Three files: one modified, two created. Ordered so the thing both workflows depend on
lands and is verified first.

## 1. `build.mjs` — stamp the version

After `copyStatic()`, read `package.json`'s `version` and write it into
`dist/manifest.json`. Keep it in `copyStatic()`'s call path so every build gets it —
including `npm run dev`, so a watched build is not subtly different from a released one.

**Verify:** `npm run build`, then confirm `dist/manifest.json` reports `package.json`'s
version. Then temporarily set `static/manifest.json` to a bogus version, rebuild, and
confirm `dist/manifest.json` still reports the correct one — that is the actual
behaviour being added, and copying a file is easy to get right by accident.

Add `"engines": { "node": ">=20" }` to `package.json` in the same step: `>=20` rather
than pinning 22, because 20 is genuinely sufficient and a floor is more useful than a
lock.

## 2. `.github/workflows/ci.yml`

Trigger: `push` and `pull_request` on `main`.

```
actions/checkout@v4
actions/setup-node@v4      node-version: 22, cache: npm
npm ci
npm run typecheck
npm run build
npm run pack
actions/upload-artifact@v4  name: senannotate-zip
                            path: senannotate-*.zip
                            retention-days: 14
```

`npm run pack` already runs `build` itself, so the explicit `build` step is redundant for
producing output — it is kept because it fails with a clearer message than a pack failure
would, and costs nothing.

**Verify:** push the branch, open the run, confirm green and that the artifact downloads
and unzips to a loadable extension.

## 3. `.github/workflows/release.yml`

Trigger: `push` on tags matching `v*.*.*`. Needs `permissions: contents: write`.

```
actions/checkout@v4
actions/setup-node@v4      node-version: 22, cache: npm
guard: TAG=${GITHUB_REF_NAME#v}
       PKG=$(node -p "require('./package.json').version")
       [ "$TAG" = "$PKG" ] || { echo "::error::tag v$TAG != package.json $PKG"; exit 1; }
npm ci
npm run pack
gh release create "$GITHUB_REF_NAME" senannotate-*.zip --generate-notes
                            env: GH_TOKEN: ${{ github.token }}
```

The guard runs **before** `npm ci` so a mismatch fails in seconds without installing
anything.

Use `node -p "require('./package.json').version"` rather than `jq` — Node is already set
up, and it avoids depending on another tool being present.

**Verify:** two runs.
1. **Mismatch first.** Push a tag whose version does not match `package.json`; confirm the
   workflow fails at the guard and **no release is created**. Then delete the tag locally
   and remotely. Testing the failure path first means the guard is proven before it is
   relied on.
2. **Then the real one.** Bump `package.json`, commit, tag to match, push; confirm a
   Release appears with the zip attached and the version inside the manifest is correct.

## 4. Document the release procedure

Add a short "Releasing" section to `README.md` under Development: bump `package.json`,
commit, tag `vX.Y.Z`, push tags — and note that the tag must match or the workflow fails.
Without this the guard is a trap for whoever tags next.

## Risks

- **`permissions: contents: write` omitted** → release step 403s. Most likely first-run
  failure.
- **`zip` missing on the runner** → `pack` fails. Confirm on the first run; fix is an
  `apt-get install zip` step or a Node zip implementation.
- **A tag pushed before its commit** → the workflow builds a tree without the version
  bump and the guard correctly rejects it. Push the commit first, then the tag.
- **`upload-artifact` path glob** — `senannotate-*.zip` assumes the archive lands at the
  repo root, which `pack.mjs` does. If pack's output location ever changes, the artifact
  step silently uploads nothing; `upload-artifact@v4` warns but does not fail by default.
