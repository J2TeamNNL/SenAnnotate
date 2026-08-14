# Plan

1. **Put the trade-off to the user before touching anything.** The change deletes
   "annotate with the toolbar collapsed", which is a deliberate, tested behaviour.
2. **Check whether `data-inspecting` becomes dead code.** Separate the attribute from
   the CSS rule that reads it — only one of them dies.
3. **Rewrite the collapse block's assertions first**, and restructure it: the annotation
   has to be made *before* collapsing now, so the handle count has something to carry.
   Keep the "no count with nothing noted yet" case by collapsing twice rather than
   dropping it.
4. **Add** assertions for the panel closing, for a page click after a collapse belonging
   to the page, and for expanding *not* restoring inspect mode.
5. **Implement**: `setActive(false)` and `togglePanel(false)` inside `toggleCollapsed`,
   on the collapsing edge only.
6. **Delete** the `[data-collapsed="true"][data-inspecting="true"]` rule; rewrite the
   `applyCollapse` docstring so it no longer argues for behaviour that is gone.
7. **Run the whole suite** — the blast radius is elsewhere, not in the collapse block.

## Expected fallout

Any test that collapses and then keeps working. Do not fix these by weakening the new
assertions; fix them by asking for inspect mode again, which is what a user now does.
