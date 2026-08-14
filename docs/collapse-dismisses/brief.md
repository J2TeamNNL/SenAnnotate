# Collapsing takes inspect mode and the panel with it

## What

`toggleCollapsed(true)` now also turns inspect mode off and closes the panel. Expanding
restores neither.

## Why

Collapse meant "get smaller". It now means "get out of the way", which is what people
reach for it to do.

The old behaviour had a sharp edge: a toolbar you had just dismissed was still
intercepting every click on the page, so the next click opened a composer with nothing
on screen able to explain why. `data-inspecting` existed to soften exactly that — a ring
on the handle saying inspect mode was still armed. Removing the state removes the need
for the warning.

An open panel was the second half: a collapse would leave a full annotations panel
floating over the page it was meant to clear.

## What this deletes

**Annotating with the toolbar collapsed.** That was deliberate and had a test —
`"a collapsed toolbar still annotates"`. It is gone, knowingly, at the user's request
after the trade-off was put to them.

## Asymmetry, on purpose

Expanding does not turn inspect mode back on. Restoring it for someone is the same
surprise in the other direction; `h` asks for the toolbar, so `h` gets the toolbar.
