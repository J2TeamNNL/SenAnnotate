# Context — move the selection after clicking

## The mapping is not DevTools', and that is deliberate

The idea comes from the DevTools Elements panel, but its bindings do not transfer.
DevTools documents them as:

> Up/Down Arrow — *"Select the element above / below the currently-selected element"*
> Right Arrow — *"Expand the currently-selected node. If the node is already expanded,
> this shortcut selects the element below it"*
> Left Arrow — *"Collapse the currently-selected node. If the node is already collapsed,
> this shortcut selects the element above it"*

That is **tree-widget** navigation: ↑/↓ move through a flattened list, and ←/→ mean
expand and collapse, with a fallback that depends on the node's current state. All of
it presupposes a tree drawn on screen with nodes that can be open or shut.

There is no tree here — there is one highlight on a live page. "Expand" has nothing to
expand and "the element above" has no list to be above in. So the mapping is the
structural one instead: ↑ parent, ↓ first child, ←/→ siblings. That is what the DOM
itself offers, and it is what people expect an element picker without a tree to do.

Worth noting *why* DevTools feels like it does parent/sibling: with a collapsed node,
← "select the element above" usually **is** the parent, and ↑ from a first child lands
on the parent too. The behaviour rhymes; the rule does not.

## Why the arrows stop working once you type

`composer.ts` focuses the textarea the instant it opens, and every key event inside
the composer is `stopPropagation`'d so the page's shortcuts never see it. So while the
composer is open, the arrows are the caret's — taking them outright would mean you
could not edit your own sentence.

The alternatives, and why they lost:

- **A modifier.** On macOS every combination is already spoken for inside a textarea:
  <kbd>Alt</kbd>+<kbd>←</kbd>/<kbd>→</kbd> moves by word, <kbd>Cmd</kbd>+<kbd>←</kbd>/
  <kbd>→</kbd> jumps to line ends, <kbd>Cmd</kbd>+<kbd>↑</kbd>/<kbd>↓</kbd> to the ends
  of the text. Anything left is a three-key chord.
- **Dropping the autofocus.** Closest to DevTools, but it costs a keystroke on the
  common path — open, type — to serve the uncommon one.

"While the note is empty" costs nothing and matches the real sequence: you click, you
see the wrong element highlighted, you fix it, *then* you write. It is a hidden mode,
which is the honest cost, and the reason the buttons exist rather than being optional
decoration — they are the only visible statement that retargeting is possible, and the
only route once there is text.

## Buttons and keys are not redundant

`marquee-select/` records a mode that went unused for three releases because nothing on
screen said it existed. A shortcut that is *also* invisible until the note is empty
would repeat that exactly. The four buttons on the Element row are the fix, and they
double as the after-you-have-typed path.

## Why the meta block is rebuilt, not patched

Retargeting changes **which rows exist**, not just their text: a bare `<div>` has no
Source or Component row, and the `<BaseButton>` above it has both. Patching would mean
tracking presence per row.

Rebuilding the *composer* would be simpler still and is not available — it would take
the note being typed, the chosen type and the focus with it. So `renderMeta` rebuilds
the metadata block alone, which is the largest thing that can be thrown away safely.

## Why the composer does not follow

It stays anchored where the first pick was. A card that re-anchors on every arrow press
moves under the pointer and drags the eye with it, while the thing actually worth
watching — the highlight — is somewhere else. Holding still makes the highlight the
only thing that moves, which is the point.

## The token

Each move is a `captureDraft`, which is a bridge round trip to the MAIN world with a
500 ms timeout. Four quick presses are four in-flight requests that can resolve in any
order. `retargetToken` drops every answer but the newest — the same guard `updateHover`
already uses for the same reason.

## Where this stops

`stepFrom` treats `document.body` as the ceiling: everything above it describes the
whole page, which no annotation means. Sibling moves walk the *filtered* list rather
than `nextElementSibling`, so a `<script>` or one of our own nodes between two cards is
stepped over instead of reading as a dead end.
