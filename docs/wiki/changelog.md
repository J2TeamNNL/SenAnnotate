# Changelog

## Started

Surveyed what existed before writing anything:

- `store/screenshots/` already holds seven real photographs of the extension, produced
  by `scripts/store-assets.mjs` driving the built extension against `store/demo.html`.
  Reusing them was better than re-shooting: same demo app, same accent, consistent.
- `README.md` (649 lines), `TESTER-GUIDE.md` (299) and `docs/README.md` (292) between
  them already contain most of the *facts*. The work is organisation and images, not
  discovery.

## Wiki repo could not be cloned

`git clone git@github.com:thangnm93/SenAnnotate.wiki.git` fails with *"Could not read
from remote repository"* even though `has_wiki` is `true` and the account has push
access to the parent repo.

This is not a permissions problem: a GitHub wiki's git repository is created lazily,
when the first page is saved through the web UI. There is no REST endpoint for wiki
content either, so it cannot be bootstrapped from here.

Consequence for the plan: everything is prepared in `wiki/` and pushed in one step
afterwards, rather than committed page by page.

## Screenshots

`scripts/wiki-assets.mjs` written against `scripts/store-assets.mjs`. Three takes were
wrong in ways only visible by eye, which is the argument for looking at every generated
image rather than trusting the exit code:

1. **`page.mouse.click(x, y, { modifiers })` silently ignores `modifiers`.** That option
   belongs to `locator.click`, not to the mouse API. The multi-pick shot was therefore an
   ordinary click — one composer, one element — captioned "three elements picked".
   `test/e2e.mjs` already used `locator.click({ modifiers: ["ControlOrMeta"] })` for the
   same gesture; copying that fixed it.
2. **`H` did not collapse the toolbar.** The last thing clicked was the composer's *Add
   note*, which lives in our shadow root, so the page no longer had the keyboard and the
   keypress went nowhere. The shot was of an expanded toolbar labelled "collapsed". Now
   it clicks the `»` button, which is also what the page tells the reader to do.
3. **The panel and the count were shot before any notes existed.** Three pictures of an
   empty list. The script now makes three notes the way a user would — click, type,
   submit — before any shot that is about state.

A fourth was a judgement call rather than a bug: the popup opened as a tab reports
*"Not available on this page"*, because the active tab **is** the popup. True of that
window, false of the popup as a user meets it. The image is clipped below the status line
to the session tools, which are identical either way.

`.submit` is a fixture class in the e2e suite, not a class in this UI — the composer's
button is `.composer .button--primary`.

## Pages

Twenty, plus `_Sidebar.md` and `_Footer.md`. 2,850 lines, 14 images, no broken
`[[link]]` and no missing image (checked by script, not by eye).

Numbers quoted in the pages were read out of the source rather than copied from prose:
the 900px embed ceiling and the sensitive-parameter list from
`src/inspector/diagnostics.ts`, the settings option labels from `src/shared/types.ts`,
the report's row order from `src/shared/output.ts`, the mode hint strings from
`src/content/ui/toolbar.ts`.

## Publishing

`scripts/wiki-sync.mjs` copies `wiki/` into a clone of the wiki repo. It does **not**
delete pages that disappeared from `wiki/`: a page someone linked to from an issue should
not vanish because a file was renamed here, and one deliberate `git rm` in the wiki repo
is the better cost.

The wiki repo still does not exist, so the first push waits on a page being created
through the web UI. The script detects exactly that failure and says so, rather than
letting a clone error read as a permissions problem.
