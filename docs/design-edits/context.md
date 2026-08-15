# Context — a preview is a loan

## The rule that shaped everything

**The page is never permanently modified.** Every override is an inline style; the
snapshot taken when the composer opens holds the `style` attribute's own value for each
property — almost always `""` — and `revertDesign` puts exactly that back. If the
attribute ends up empty it is *removed*, because an element that gained a bare
`style=""` has still been changed, visibly in devtools and to any page code that reads
the attribute.

The revert runs from `closeComposer`, which means it runs on save, on cancel, on Escape,
and when the panel opens a different note. There is no path that leaves a preview
standing. Two e2e checks exist for no other purpose.

That is a deliberate divergence from the tool this was modelled on, which keeps previews
live on the page. The argument against: the reviewer would then be testing the app
against a mirage — a change that exists in their tab and in no codebase — and a reload
would take it away with no explanation. The overlay's whole contract with the page it
stands on is that it does not touch it; a preview you can see while you are choosing is
worth having, a preview that persists is a different product.

## `from` is the computed value

The inline style is empty on any element styled by a stylesheet, which is all of them.
Reporting `from: ""` would be true and useless. `getComputedStyle` gives what the element
actually rendered as — `16px`, `rgb(37, 99, 235)` — and that is the state an agent is
changing away from.

Colours are the one place the two notations meet: computed style says
`rgb(37, 99, 235)` and `<input type="color">` says `#2563eb`. `diffDesign` converts the
computed side before comparing, or every colour would read as changed the moment the
picker was opened, and each row would print two notations for one colour.

Colours **with alpha** deliberately fall back to `#000000` rather than being converted:
`#rrggbb` cannot hold the alpha, and silently dropping it would show a wrong swatch and
then report a wrong `from`.

## One table, four consumers

`DESIGN_FIELDS` in `content/design.ts` drives the controls, the preview, the diff and the
report. Adding a property is one entry — the same rule `inspector/detectors/index.ts`
follows. `ui/design-panel.ts` contains no property names at all; if a change to the field
set forces an edit there, the abstraction has leaked.

The set is small on purpose. These are the things a reviewer re-types in devtools before
writing the note, and every addition costs vertical space in a 380px card.

## `!important` on the preview

A stylesheet rule carrying `!important` would beat a plain inline value, and the control
would appear to do nothing on exactly the elements whose styling is most worth arguing
with. `removeProperty` clears the priority along with the value, so the revert is
unaffected.

## Where the panel does not appear

`composerTargets.length === 1 && !draft.selectedText`. A multi-element note and a text
selection have no single element to preview on, and quietly editing whichever element
happened to be first would be worse than the controls being absent.

## Why the layer split is worth keeping

| Module | Knows |
|---|---|
| `content/design.ts` | the field table, the DOM, what a computed value is |
| `ui/design-panel.ts` | how to draw a labelled control and what the user typed |
| `content/index.ts` | which element it is, when to preview, when to revert |

The panel could have applied the styles itself in about ten fewer lines. It would then
own an element reference, and the revert — which must happen on paths the panel never
hears about, like the annotations panel opening another note — would have had to reach
back into it.
