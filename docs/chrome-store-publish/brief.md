# Brief — ship each release to the Chrome Web Store automatically

## What was asked

> Tôi muốn mỗi lần release package mới thì cũng sẽ update lên chrome extension.

Tagging a release already builds, packs, and attaches the zip to a GitHub Release. The same
zip should also reach the Chrome Web Store without anyone opening the dashboard.

## What this does and does not buy

**Does:** `git push --tags` uploads the packed zip to the existing Store item and submits it
for review, using the same artifact the GitHub Release carries.

**Does not:**

- **Skip review.** Publishing through the API means *submitted for review*. SenAnnotate
  declares a host permission, so that review is a manual one — the version goes live days
  later, not on push. Nothing can automate that away; it is the cost of `<all_urls>`.
- **Create the item.** The first submission — listing text, graphic assets, the privacy
  form — has to be done by hand once. There is no API for the listing metadata.
- **Replace `npm test`.** CI still does not run the Playwright suite, for the reasons in
  `../ci-cd/context.md`. Auto-publishing raises the stakes of that: a tag now reaches real
  users' update channel, so running the suite before tagging matters more than it did.

## Scope

**In**

- A dependency-free publish script, API v2.
- One step in `release.yml`, after the GitHub Release is created.
- A documented setup path, and an escape hatch for uploading without submitting.

**Out**

- Automating the listing copy or the graphic assets. `store/` already generates the assets;
  uploading them is a once-per-listing job, not a per-release one.
- Any change to when releases happen. This hooks the existing tag trigger.

## Success criteria

1. Tagging with the credentials set uploads and submits; the run log names the version.
2. Tagging **without** them still succeeds — the step skips rather than failing, because the
   Store item does not exist until the first manual submission.
3. A half-configured credential set fails the run loudly, since that is what a renamed or
   rotated secret looks like and silence would mean releases quietly stop shipping.
