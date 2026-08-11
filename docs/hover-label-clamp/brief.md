# Brief — the hover label ran off the right edge

## What was wrong

The hover label — the chip naming the element and its source file — is anchored to the
highlighted box's left edge and grows rightward. Hovering anything near the right edge of the
viewport pushed it off screen, and what got cut was the **source path**: the half of the label
that is the reason the extension exists.

Measured on a 1280px viewport with an element at `left: 1220`: the label ran to x=1700, so
**420px of it was outside the window**.

## How it was found

Not by a bug report. It showed up while shooting the Chrome Web Store screenshots — the first
attempt put a clipped label across the revenue figure of the demo page, and choosing
mid-canvas targets was used to work around it at the time. Store screenshots are just the
product photographed honestly, so a blemish there is a blemish for every user.

## Scope

**In**

- Clamp the label into the viewport, without over-correcting off the left edge.
- Cap its width on a viewport narrower than the label's `max-width`.
- A fixture and checks at both edges.

**Out**

Nothing else about the overlay. The vertical case already worked (`data-flip` when the box is
too near the top); this is the horizontal equivalent that was simply missing.

## Success criteria

1. A label on a right-edge element sits entirely inside the viewport.
2. That is achieved by an actual shift, so the check cannot pass vacuously.
3. A label on a left-edge element is **not** shifted — an over-correcting fix must fail.
