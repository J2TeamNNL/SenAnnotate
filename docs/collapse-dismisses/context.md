# Context

## What `data-inspecting` was for

`toolbar.ts` carried this above `applyCollapse`:

> Collapsing is a display change and nothing more: inspect mode, freeze and the
> annotations all carry on. Which is why `data-inspecting` goes on the dock — with the
> label gone, the handle is the only thing left that can say inspect mode is armed, and
> an unmarked handle would leave the next page click opening a composer for no visible
> reason.

That paragraph is the argument for this change, read the other way round. The attribute
was compensating for a state that should not exist.

## What was removed, and what was not

The **CSS rule** went: `.toolbar-dock[data-collapsed="true"][data-inspecting="true"]`
now selects nothing that can occur, so it was dead the moment the behaviour changed.

The **attribute stayed**. `applyCollapse` sets it from `active` whether collapsed or
not, so it remains the one readable signal of inspect mode on the dock — and it is what
`test/e2e.mjs` reads inspect mode off in four places. Deleting it would have cost a test
probe to save nothing.

## The existing test that caught the blast radius

The modal block presses `h` twice — collapse, expand — and then clicks inside the dialog
expecting a composer. It failed, correctly: inspect mode had gone with the first press
and the expand did not hand it back. The block now re-arms inspect mode between the two,
with a comment saying why.

Worth noting as the useful kind of failure. Nothing in that block is about collapsing;
it is about modals. It failed because the change was real, which is what a suite is for.

## Freeze is untouched

Freeze survives a collapse, as it always did. It is a property of the page rather than
of the toolbar, and unfreezing a page because a toolbar shrank would strand any
animation the user had deliberately parked.
