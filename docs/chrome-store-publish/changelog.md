# Changelog

## Built

`scripts/publish-store.mjs` and one step at the end of `release.yml`. Tagging now uploads the
packed zip to the Web Store item and submits it for review, using the same artifact the
GitHub Release carries.

## Two things the research changed

**The obvious recipe was already dying.** Nearly every published example of this uses
`www.googleapis.com/chromewebstore/v1.1`. Checking the current docs rather than writing from
memory turned up the sunset date: **15 October 2026**, about two months out. A v1.1 script
would have worked for one or two releases and then failed, at the least convenient moment —
mid-review of a version people were waiting for. v2 also moves the publisher id into the
path, so it is not a hostname swap.

**Refresh tokens have a seven-day trap.** The refresh-token flow is the one most CI examples
use, and while the OAuth consent screen sits in "Testing", Google expires the token after
seven days. The failure arrives a week after a setup that visibly worked, as `invalid_grant`,
with nothing having changed. A service-account key does not expire, so that is the documented
path; the refresh-token flow is kept only for anyone who already has one.

## Verified

The end-to-end path needs an item that does not exist yet, so what could be checked locally
was, and the rest is honestly marked as unverified until the first real release.

- **Skip path** — no credentials: prints the reason, exit 0. This is the one that matters
  today, because it is what every tag does until the listing goes live.
- **Partial config** — `CWS_EXTENSION_ID` alone: exit 1 naming what is missing.
- **The hand-rolled JWT** — signed with a throwaway RSA key, Google answered
  `invalid_grant: account not found`. It parsed the assertion and **accepted the signature**,
  rejecting only the fake account; a mis-signed one answers `Invalid JWT Signature`. This was
  worth doing rather than assuming: base64url and `createSign` are exactly where a silent,
  always-broken token would come from, and the symptom would have looked like a credential
  problem for as long as anyone cared to look.
- `npm run typecheck` clean — `tsconfig.json` includes `scripts/`.

**Not verified:** the upload and publish calls themselves. First tagged release after the
secrets are set is the real test.

## The thing worth being clear about

This does not make releases reach users faster. Publishing via the API means *submitted for
review*, and SenAnnotate's host permission makes that review a manual one — days, not
minutes. What it removes is the dashboard round-trip and the chance of shipping a zip that
is not the one the GitHub Release carries.

It also raises the stakes on a decision recorded in `../ci-cd/context.md`: CI deliberately
does not run the Playwright suite, so `npm test` before tagging is a manual gate. A tag now
reaches the update channel of everyone who installed from the Store, so that gate matters
more than it did when a tag only produced a zip.

## First real run: rejected, and what it taught

`v0.5.3` was the first tag to exercise the upload. It failed:

```
400 FAILED_PRECONDITION  NOT_UPDATEABLE
"You may not edit or publish an item that is in review."
```

The listing's first submission was still in review, and the Store **refuses any upload while
that is true**. Worth correcting an earlier claim in this record: it does not queue the new
version, and it does not replace the pending submission — it rejects the request outright.

Two flaws this exposed, both now fixed:

**The error advice was wrong for this case.** The upload failure printed the version-conflict
hint — "0.5.3 is not higher than what is already on the Store" — which is the most common
cause but not this one, and it points at bumping a version that was never the problem. The
message now branches on `NOT_UPDATEABLE` and says to wait for review instead.

**There was no retry path.** Re-running `release.yml` cannot work: it would try to create a
GitHub Release that already exists. So `store-publish.yml` takes a tag as a
`workflow_dispatch` input, rebuilds and repacks from it, and publishes — the same build path
as the original, runnable whenever the Store is willing to accept it. Its tag input is
validated against `^v[0-9]+\.[0-9]+\.[0-9]+$` before it is used as a checkout ref: dispatch
needs write access so it is not an anonymous surface, but an input that decides which code
gets published to real users deserves the constraint.

**The step ordering paid off.** Because the Store call runs after `gh release create`, the
GitHub Release for `v0.5.3` and its zip were published normally and only the Store step went
red. That was the stated reason for the ordering, and it held the first time it mattered.
