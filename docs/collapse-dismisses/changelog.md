# Changelog

## The change

Three lines in `toggleCollapsed`:

```ts
if (next) {
  setActive(false);
  togglePanel(false);
}
```

Plus a deleted CSS rule and a rewritten docstring.

## What it cost, and why that was the right price

`"a collapsed toolbar still annotates"` was a real, deliberate feature with a test
pinning it. It is gone. The trade-off was put to the user explicitly before any code
changed — the sharp edge it removes (a dismissed toolbar still swallowing every page
click) was judged worse than the workflow it deletes.

## The failure worth recording

The collapse block's own assertions were rewritten first and passed. The suite then
failed **somewhere else entirely** — `test/e2e.mjs:851`, in the modal block:

```
harness error: locator.waitFor: Timeout 5000ms exceeded.
  - waiting for locator('.composer') to be visible
```

That block presses `h` twice to prove a collapse does not dismiss the page's modal, then
clicks inside the dialog expecting a composer. Inspect mode had gone with the first
press, and the expand does not hand it back.

Nothing in that block is about collapsing. It failed because the behaviour change is
real and reaches further than the feature that caused it — which is the whole argument
for running the full suite rather than the block you edited. The fix was to ask for
inspect mode again between the presses, exactly as a user now would; the new assertions
were not weakened to accommodate it.

## Restructuring the collapse block

The annotation now has to be made before collapsing, because you can no longer annotate
after it. Rather than drop `"the collapsed handle shows no count with nothing noted
yet"`, the block collapses twice: once empty to pin the no-count case and the two new
dismissals, then expand → re-arm → annotate → collapse again to pin the count.

## Verification

```
190/190 checks passed
9/9 upgrade checks passed
```

Four new assertions: inspect mode off after a collapse, an open panel closed by it, a
page click afterwards belonging to the page, and expanding *not* turning inspect back
on. Two removed: the armed-handle marker and annotating while collapsed.
