# Context — the top layer, and what it does to an overlay extension

Everything below was measured on Chromium 148 with the built extension loaded, not read from
a spec. The scratch scripts are gone; the numbers are what they printed.

## The top layer is not a z-index

Chrome keeps a separate painting layer, above the whole normal stacking order, for elements
that ask to be modal or fullscreen. `z-index` does not reach into it. Our host is
`position: fixed; inset: 0; z-index: 2147483647` on `documentElement` — the maximum integer,
and later in tree order than anything in `body`, so it wins every ordinary comparison. Against
a top-layer dialog it loses unconditionally.

Measured with a `showModal()` dialog open and inspect mode on:

```
elementFromPoint(<centre of our toolbar button>)  →  <dialog>
Playwright:  <dialog open id="native"> from <body> subtree intercepts pointer events
```

## Inertness is the half that cannot be styled around

While a modal dialog is open, every element that is not a flat-tree descendant of it is
**inert**: excluded from hit testing, unfocusable, and unable to receive keystrokes. This is
why "just paint above it" is not enough, and it is what rules out the obvious fixes.

| Attempt | Result |
|---|---|
| Higher `z-index` | No effect. Already at the maximum; the top layer is not ordered by z-index. |
| Promote the host to `popover="manual"` + `showPopover()` | Painted **above** the dialog (screenshotted) but still inert: `elementFromPoint` skipped it, `focus()` did not land, real keystrokes produced `""`. |
| Make the host a `<dialog>` and `showModal()` it ourselves | Our UI becomes fully interactive — and the page's dialog becomes inert in turn. `elementFromPoint` over the dialog's own text returned `html`, and a document-level capture click reported `target=html`. Identification dies, which is the whole product. |
| Place the host **inside** the topmost `:modal` element | Works. Our card hit-tests as ours, `focus()` lands, real keystrokes arrive, and the dialog's own text still hit-tests as itself — so hover and identification keep working. |

The last row is the fix. A flat-tree descendant of the modal is not inert, and it paints inside
the modal's top-layer stacking context, where our maximum z-index does apply again.

## What placing the host inside the dialog costs

`position: fixed` resolves against the nearest ancestor that is a containing block for fixed
positioning. On `documentElement` that is the viewport. Inside a dialog it is *still* the
viewport — unless the dialog has a `transform`, a `filter`, or `contain: paint`, all common on
an animated dialog. Measured, viewport 1000×700 with a 500×300 dialog:

| Dialog | Host box with `inset: 0` |
|---|---|
| plain | 985×700 (the viewport minus the scrollbar — correct) |
| `overflow: hidden` | 985×700 (fixed descendants are not clipped when the viewport is their containing block) |
| `transform: translateY(0)` | **528×328** — the dialog |
| `contain: paint` | **528×328** — the dialog |

985, not 1000: the containing block for a fixed box is the initial containing block, which
excludes the scrollbar. Compare against `documentElement.clientWidth/clientHeight`, never
`innerWidth/innerHeight`, or the compensation below will fight a 15px phantom offset forever.

A shrunken host silently moves every coordinate we draw: highlights are absolutely positioned
inside that box in viewport coordinates. So placement measures the host it just moved and, if
the box is not the viewport, replaces `inset: 0` with an explicit offset that puts it back.

## `:modal` covers fullscreen too

```
requestFullscreen() on a div  →  document.querySelectorAll(":modal")  →  ["box"]
```

So one selector handles both top-layer entrances, and a fullscreen page — where our overlay was
equally invisible — is fixed by the same code with no extra branch.

## What is *not* broken, and was checked

A `div`-based modal is unaffected, including the Radix / Reka UI pattern of setting
`body { pointer-events: none }` while open — our host hangs off `documentElement`, not `body`,
so it never inherits that. Driven end to end against a fixture of exactly that shape: composer
opened, real keystrokes landed, note saved, count badge went to 1. This matters because it is
what the reporter's own apps use; a native `<dialog>` appears nowhere in the monorepo's sources
or its installed UI libraries, so the reproduction is a third-party page or a page using the
platform dialog directly.

## Related

- `modal-click-leak/`, `modal-focus-leak/` — 0.5.1, the two ways our UI used to *dismiss* a
  modal. Same subject, opposite direction, and their containment code is what still keeps the
  dialog open once we are inside it.
