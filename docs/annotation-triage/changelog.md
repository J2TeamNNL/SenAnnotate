# Annotation triage — changelog

## 0. Starting point

An annotation was a comment and nothing else: no type, no status, no way out of
`chrome.storage.local` except rendered Markdown on the clipboard.

## 1. Model

`kind` and `status`, both optional, defaulted through `kindOf()` and `isDone()` so
nothing else repeats the fallback and stored notes from 0.5.x stay readable. Same call
`framework` got when it was renamed from `vue` in 0.3.0 — no migration for per-review
scratch data.

## 2. Report

`### 1. [bug] button "Save"`, and **nothing** for `ui`. That was the one design
decision worth arguing over: `ui` is what every unlabelled note defaults to, so
printing it would put a tag carrying no information on every line of every report.
The test pins both halves — the tag appears when chosen, and `[ui]` never appears.

Done notes render under a trailing `## Already fixed` rather than being filtered out.
Numbering follows the *open* notes, so "note 3" always means the third thing still to
do.

## 3. Export / import moved to `shared/`

The plan put `exportAll`/`importAll` in `content/storage.ts`. They ended up in a new
`src/shared/archive.ts` instead: the popup is the only consumer, and importing a
`content/` module into the popup bundle would have inverted the layering that
`CLAUDE.md` describes (`shared/` is what all four worlds import, not `content/`).

Import merges rather than replaces, and same-`id` collisions keep the imported copy.
Validation is a shape check, not a security boundary — the UI has no HTML sink by
design — but an entry without a `selector` throws inside `resolveElement`, so the check
earns its place on correctness grounds.

## 4. Four test failures, one cause

First run of the triage block: `[bug]` missing from heading 1, the done note still
numbered, `3 entries unfiltered` where 2 were expected, `3 entries after import`.

All four were the same thing. The block reused `test/fixtures/plain.html`, which an
earlier block in the same suite had already annotated — and annotations are keyed on
`origin + pathname` in a `chrome.storage.local` shared by every page in the context.
So the page opened with a note already on it, `### 1.` was that older untyped note, and
every count was one too high.

**Nothing was wrong with the feature.** Fixed by giving the block its own fixture
(`triage.html`) with a comment saying why. This is a standing trap for anyone adding
to the suite: a fixture that any other block annotates cannot be used for a count
assertion.

One assertion was also genuinely weak — `/### 1\. .*Heading/` matched on the comment
text rather than the element name. Rewritten to `includes("### 1.") && !includes("### 2.")`,
which is what "numbering closed up" actually means.

## 5. Tests

Eight new checks, including export and import driven through the **real popup** — the
extension id comes from `context.serviceWorkers()[0].url()`, and the file input is fed
with `setInputFiles`. A foreign JSON file is asserted to be refused, and a real export
is asserted to come back after `Clear all`.

144/144 — green after the fixture fix.
