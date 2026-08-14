# Context — what already existed, and what the feature is allowed to touch

## Multi-element annotations are not new

`beginAnnotation(elements: Element[], selectedText?)` has taken a list since 0.4.0, when the
marquee arrived. `captureDraft` turns a list into `isMultiSelect`, `elementBoundingBoxes` and
the composer's `Selection: N elements` row; `shared/output.ts` renders it; `markers` pins the
first box; storage stores it. **None of that changes here.** A pick set is a second way to
build the same list, and if this feature needed edits in `output.ts` or `panel.ts` that would be
the signal it had been designed wrong.

Where the two differ is what they can express. A marquee takes what one rectangle *fully
contains* (`marquee-select/context.md` explains why "fully", not "touches"). A review often
wants three things far apart — a form label, a footer button, a header badge — and no rectangle
holds those without holding the page.

## The three seams it hooks into

All of them already exist in `content/index.ts`; the feature is a branch in each, not a new
subsystem:

| Seam | Today | With a pick set |
|---|---|---|
| `click`, capture phase, point mode | `beginAnnotation([target])` | modifier → toggle in the set; plain → append and commit the set |
| `keydown` `c` / `Enter` | `captureHovered()` | commit the set when one exists |
| `keydown` `Escape` | close composer, else leave inspect | drop the set first when one exists |

## Drawing it without touching the overlay

`overlay.showHighlights(rects, label?, { preview })` already has exactly the two behaviours
needed, for the marquee's sake:

- `preview: true` draws *every* box as live selection — none muted, no position transition
  (a pooled box reused for another element would otherwise slide across the page);
- a label is drawn on box 0 only, and only if one is supplied.

So `showHighlights([hovered, ...picked], hoverLabel, { preview: true })` gives a set that reads
as one selection while the box under the pointer keeps its name-and-source label. The muted
style is deliberately *not* used: muted means "secondary to box 0", which is what a *saved*
multi-element annotation looks like, and a pick set has no primary.

The cost of `preview` is losing the hover box's 0.07s position transition while picking. Worth
it against the alternative, which was a new option on `showHighlights` and a third highlight
style to keep in sync.

## Constraints inherited from the codebase

- **Point mode only.** Text mode needs raw clicks to reach the page (that is how a selection is
  made), and area mode's `pointerdown` is the drag. Switching mode drops the set, next to where
  the marquee is already reset.
- **The default hint line is asserted verbatim** by the suite ("the hint names the default mode
  and the keys for the others"), so the affordance is announced in the *picking* hint instead of
  by rewording the mode line.
- **`MAX_MARQUEE_ELEMENTS`** is the cap for both. One limit, one hint phrasing (`(limit)`).
- **Elements can leave the DOM.** `captureHovered()` already guards `isConnected` for exactly
  this reason — a set held across a re-render can contain detached nodes, which capture as a
  zero-size box and a selector that resolves to nothing. Filtered on draw and before committing.
- **Child frames are out.** `frames.ts` owns hit testing inside an iframe and hands finished
  drafts up; there is no protocol for "add this to the parent's pending set". A ⌘+click in a
  frame stays a plain click.

## macOS note

Ctrl+click is a right-click on macOS: it raises `contextmenu`, and `click` does not arrive the
way the feature needs. Both modifiers are accepted because `ctrlKey` is right for Windows and
Linux, but on a Mac the usable one is ⌘. The hint says `⌘/Ctrl+click` rather than picking one,
since the overlay has no reliable way to name the platform.
