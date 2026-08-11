# Plan

## 1. `scripts/publish-store.mjs`

Dependency-free, API v2. Shape:

1. Decide whether it is configured at all — skip (exit 0) on nothing, fail on partial.
2. Resolve the zip: `process.argv[2]`, else `senannotate-<package.json version>.zip`.
3. Get an access token — service-account JWT if `CWS_SERVICE_ACCOUNT_JSON` is set, else the
   refresh-token flow.
4. `POST …:upload` with the zip as the body.
5. `POST …:publish`, unless `CWS_UPLOAD_ONLY=true`.

Error handling is the substance rather than the happy path: every failure prints Google's
response body verbatim, because their messages are terse and summarising them sends you
looking in the wrong place. The upload failure adds the version-must-be-higher hint, which is
the most common cause by far, and the publish failure says the upload already succeeded so
the draft can be submitted by hand.

## 2. One step in `release.yml`

After `gh release create`, for the reason in `context.md`. Secrets scoped to the step. No
`${{ }}` inside `run:`.

## 3. Verify without a real credential

The parts that can be checked locally, and were:

- nothing set → prints the skip reason, exit 0
- partial (`CWS_EXTENSION_ID` only) → exit 1 naming the missing value
- service-account JWT signed with a throwaway RSA key → Google returns
  `invalid_grant: account not found`, proving the assertion was parsed and its signature
  accepted
- `npm run typecheck` — `tsconfig.json` includes `scripts/`, so the new file is covered

The end-to-end path cannot be verified until the item exists and the secrets are set; the
first tagged release after setup is the real test, and the run log names the version it
submitted.

## 4. Document

This folder, plus the README's Releasing section, plus a pointer from `docs/README.md`.
