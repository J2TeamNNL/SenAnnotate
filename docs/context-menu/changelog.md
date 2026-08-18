# Changelog — annotate from the right-click menu

## What shipped

Three entries in the page's right-click menu — *Annotate this element*, *Annotate the text
"…"* (with a selection), *Toggle inspect mode*. The first two open the composer without
arming inspect mode.

Five files: `static/manifest.json` (`contextMenus`), `shared/protocol.ts`,
`background/index.ts`, `content/index.ts`, `README.md`. Plus a fixture and an e2e block.

## The API forced the design

`chrome.contextMenus.onClicked` hands you `menuItemId`, `frameId`, `pageUrl`, `linkUrl`,
`srcUrl`, `mediaType`, `selectionText`, `editable` — and **no element, no coordinates.**
There is no API that provides them; DevTools can do it because DevTools is the browser.

The first sketch assumed `OnClickData` would carry at least a position and planned to
`elementFromPoint` it in the content script. It does not, and once that is understood the
rest follows: the element has to be recorded in the page on `contextmenu` — which fires
before the menu opens — and the menu click becomes an instruction rather than data. The
message ends up carrying two booleans, because there is nothing else to carry.

## Capture phase is the load-bearing detail

Every app with its own right-click menu calls `preventDefault` **and** `stopPropagation` on
`contextmenu`. A bubble-phase listener on `document` would see nothing on any of them — and
the failure mode is not "does nothing", it is **annotates whatever was recorded last**, with
no signal that it is the wrong element. That is the same class of bug the `composer-retarget`
review spent most of its findings on, so it is guarded by a fixture (`#ctxmenu-eater`) that
cancels the event both ways.

The listener is passive and cancels nothing. The page's own menu still opens; so does
Chrome's, because the browser draws the extension's entries from the registration rather than
from the event. A right-click that shows both is the correct outcome.

## What it deliberately does not do

**It does not turn inspect mode on.** Inspect mode swallows the next click on the page, so
arming it as a side effect means the user's next ordinary click opens a composer they did not
ask for — the surprise `toolbar-collapse/` exists partly to remove. A right-click on one
element is a complete request, and nothing in `beginAnnotation`, the composer, the markers or
the report needs the mode.

**It does not clear the recorded element after use.** Reopening the menu on the same element
and picking the item twice has to work. What catches a stale record is `isConnected` at use
time plus `eligible`, not an eager reset.

**It does not handle a right-click inside an iframe.** This is the honest gap and it is a
scope cut rather than an oversight. The composer is the top frame's, and the top frame cannot
map a `frameId` to an iframe element — there is no DOM API for it, and
`webNavigation.getAllFrames` returns URLs, which do not identify an element either. So
annotating the top frame's own record would describe the wrong element with a straight face.
It reports instead.

`context.md` records the design that would fix it, because the blocker is not the plumbing —
`installChildFrame` already has a `capture()` that posts a draft up. The blocker is that
`onFrameDraft` ignores drafts while inspect mode is off, deliberately, so a hostile embedded
frame cannot pop a composer on a page the user is only reading — and this feature is
*defined* by inspect mode being off. Relaxing that needs a one-shot expectation token in the
top frame, which is a security-relevant change to the frame boundary and deserves its own
review.

## A trap in the menu lifecycle

Menu entries persist across browser restarts, and `onInstalled` fires on **update** as well
as install — so a naive `create` on the second install throws a duplicate-id error and leaves
the *previous* version's entries in place, pointing at a handler that may be gone.
`createMenus` calls `removeAll` first and creates inside its callback. `onStartup` is
deliberately not wired: the entries persist, so recreating them per launch is work for no
change.

## Verification

`npm run typecheck` and `npm run build` clean.

```
221/221 checks passed
9/9 upgrade checks passed
```

212 of those are `main`'s; 9 are new.

What the suite can and cannot reach is worth being explicit about, because a reader could
reasonably assume more is covered than is:

**Not covered.** The menu entries themselves. Playwright cannot open a native context menu
and `chrome.contextMenus` has no query API, so their titles, contexts and ordering are
unverified — the block asserts only that the worker can create one without error.

**Covered, and genuinely.** The `contextmenu` event is real and hits the real capture-phase
listener; the `annotate-context` message is sent from the real service worker over
`chrome.tabs.sendMessage` with `{ frameId: 0 }`. Only the native menu widget is stood in for.
On that path:

- the element that was right-clicked is the one annotated
- inspect mode is off before **and after** — the property the feature is built on
- what it stored is what it displayed, read out of a generated report
- a page that cancels `contextmenu` both ways does not hide the element from us
- the selection entry carries the text
- an `inFrame` click opens no composer and says why

## The test was wrong twice before the feature was right once

Worth recording in full, because both are traps rather than slips.

**`page.dispatchEvent(selector, "contextmenu", { clientX, clientY })` does not produce a
`MouseEvent`.** Playwright synthesises it as a plain `Event`, so `clientX` and `clientY` are
`undefined`, `document.elementFromPoint` resolves nothing, the recorder stores `null`, and the
menu item silently no-ops. The first run failed on a `.composer__meta` that never appeared,
with no error anywhere — the message was delivered and answered `{ ok: true }`.

What found it was a throwaway probe that logged the recorder's own view: *did the listener
run, was the target eligible, was anything recorded*. The listener had not run at all. A
`locator.click({ button: "right" })` goes through CDP and produces a real event with real
coordinates, and the same path worked first time.

**That fix has a consequence, and it is why the fixture cancels `contextmenu` at the document
level.** A real right-click also opens *Chrome's own* context menu — an OS-level widget
Playwright cannot dismiss — and this suite runs **headed**. `preventDefault` stops the menu
without stopping the event, so the capture-phase listener still sees exactly what it would on
a real page. It is also the realistic shape rather than a workaround: any app with its own
right-click menu does precisely this.

**And the fixture's three blocks needed distinct class names.** They started as three
`.ctxcard`s, which all identify as `div.ctxcard` — so the assertion about the element that
cancels `contextmenu` would have passed for the wrong reason. The same trap `retarget.html`
hit one branch earlier, which suggests it is worth a line in `CLAUDE.md` rather than a third
rediscovery.

## One flake observed, not reproduced

An earlier run of this branch reported `collapsing hides the toolbar controls` failing — a
check in `main`'s Collapse block that this branch does not touch. It did not recur on a clean
re-run of the same commit, and the `domain-rules` branch off the same `main` passed it. Noted
rather than explained: nothing here plausibly affects that path, but a reviewer seeing it once
should know it has been seen.

## Review follow-ups (PR #18)

Twelve findings, all applied. Grouped by what they were actually about, because four of them
were the same bug reached by different routes: *the menu acts on a record that was never
about this gesture.*

**The record is wrong or stale.**

- `contexts: ["all"]` includes `action` — the right-click menu of our own toolbar icon.
  Invoked from there no page right-click happened at all, so the record held whatever was
  right-clicked minutes ago and the composer opened on it. The contexts are now listed
  explicitly (`page`, `frame`, `link`, `image`, `video`, `audio`, `editable`, `selection`),
  and the comment that claimed `page` and `frame` were *excluded* — the opposite of what
  `"all"` does — is gone.
- The capture-phase listener was on `document`, which is one hop late: capture runs
  `window → document → … → target`, so a page listening on `window` still took the event
  first, and the failure was the bad one — the *previous* element annotated, silently. It is
  on `window` now.
- A keyboard-invoked menu (Menu key, <kbd>Shift</kbd>+<kbd>F10</kbd>) has synthesised
  coordinates, and with nothing focused they land near the top-left of the viewport.
  `elementFromPoint` then returns a real, eligible element that has nothing to do with the
  user — not the safe "Nothing to annotate there" path. The hit test is now only trusted when
  it agrees with `event.target` (is it, or contains it); otherwise the event target wins.
- `onClicked` treated every id that was not the toggle as an annotate request, so any entry
  added later — or left behind by a test — would open a composer. All three ids are matched
  explicitly. The `message.kind !== …` guard that followed was dead code: TypeScript had
  already narrowed it to `never`.

**The selected text.** `info.selectionText` was thrown away and the text re-derived in the
page with `window.getSelection()`. Those disagree in the case the item is most used in: a
selection inside an `<input>` or `<textarea>` is not part of the document selection, so the
page reads `""` while Chrome populates `selectionText` and *offers* the item — the quote was
silently dropped from the annotation the user explicitly asked for. It now travels on the
message, and `rightClickedText` is gone.

Pinning it took a second attempt. The obvious check — assert `window.getSelection()` reads
`""` for a selection inside an `<input>`, then assert the quote survives — **failed**: this
Chromium build *does* surface a field's selection to `getSelection()`, so the premise held in
principle and not on the machine running the suite. What separates the two implementations is
only visible where they disagree, so the check now selects one element, sends a
`selectionText` that says something else, and requires the composer to show Chrome's copy and
not the page's.

**Which element a quote is about.** The selection item annotated the deepest element under the
pointer while text mode used the range's common ancestor: the same selection across
`<p>foo <b>bar</b> baz</p>` reported `b` or `p` depending only on the entry point. Both now
call one `selectionElement()`.

**Retention.** `rightClicked` was a strong reference cleared by nothing — not after use
(deliberate), not by `setActive(false)` (an oversight, beside `hoveredElement` which is
cleared there), not across an SPA route change. Right-click a container the app then removes
and the whole detached subtree was retained for the life of the page. Both records are now
`WeakRef` and both are cleared in `setActive(false)`. `isConnected` still catches staleness at
use time; it never had anything to do with retention.

**The pick set.** A right-click during a half-built ⌘/Ctrl-click set threw the picks away and
blanked the hint that was the only trace of them. It still clears — a right-click is a fresh
subject — but it says so now.

**Menu entries offered where nothing can answer.** No `documentUrlPatterns`, so the entries
appeared on `chrome://` pages, the Web Store and PDFs, where `tabs.sendMessage` rejects into
an empty `catch`: the user picks an item and nothing happens at all. Restricted to
`http`/`https`/`file`, which is where the content scripts run. The `catch` comment no longer
argues that swallowing it is fine; what remains there is the one case a pattern cannot
express — a tab where the toolbar was hidden for the session.

**The store paperwork moved with the permission.** `store/listing-privacy.md` gained a
`contextMenus` justification block (its own header warns that a permission without one gets
the version rejected), and two blocks that this feature had made *false* were corrected: the
`<all_urls>` justification and the single-purpose text both claimed the DOM is read only after
inspect mode is turned on and an element clicked. `PRIVACY.md` gained the permission row and a
paragraph on what a right-click records. Those are the exact sentences a reviewer checks
against the code.

**The menu-entry check was self-fulfilling.** It called `removeAll()` — destroying the real
entries for the rest of the run — then created a `probe` id it never removed, and asserted only
that `chrome.contextMenus` was reachable: `createMenus` could have been deleted outright and it
would still have passed. `chrome.contextMenus` has no query API, so what it asserts now is the
**duplicate-id error** from re-creating the three real ids. That names the entries under test,
proves `createMenus` ran, leaves the menu untouched (a rejected create creates nothing), and
removes anything it did manage to create before failing.

**Manifest diff noise.** The whole file had been reformatted for a one-line addition — every
single-line array exploded, `—` rewritten as `—` — none of which survives `copyStatic()`,
which re-serialises the manifest into `dist/` anyway. Reverted to `main`'s formatting with just
`"contextMenus"` added.

### Two new fixture elements

`#ctxmixed` (`foo <b>bar</b> baz`) and `#ctxinput`, for the two selection bugs above. Distinct
class names, for the reason recorded further up this file — though the `#ctxmixed` assertion
then had to stop matching `p.ctxmixed` anyway: an element with text of its own is labelled by
that text, so the `tag.class` fallback never appears for it. It matches the tag, and asserts
the `b` the pointer was over is *absent*.

### Still not covered

The keyboard-invoked context menu. `ctx.keyboard.press("ContextMenu")` opens Chrome's own
menu, which is the OS-level widget the fixture's `preventDefault` exists to avoid, and there
is no way to cancel a menu the extension never sees. The fallback is asserted by reading, not
by test — worth knowing before trusting it.
