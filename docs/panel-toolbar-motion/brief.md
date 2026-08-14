# Motion for the panel and the toolbar

## What

The panel rises in and fades out instead of appearing and vanishing between frames. The
toolbar folds into its handle instead of snapping.

## Why an animation, not a transition, for the panel

The panel is created and destroyed, not shown and hidden. A transition needs the element
to exist in its "before" state for a frame first; a CSS **animation** runs on insertion
with nothing to arrange. That is already how `.toast` enters (`vt-rise`), so entering is
one line and no JavaScript.

`@starting-style` would be the modern way to transition an inserted element. It is
Chrome 117, and `minimum_chrome_version` here is 111.

Leaving still needs JavaScript, because something has to remove the node afterwards.

## Why the toolbar folds with `max-width`

`width: auto` is not an interpolable value, so a `width` transition on an auto-sized
button animates nothing. `max-width` from a ceiling down to `0` does. The ceiling only
has to clear the widest child.

`display: none` — what the collapsed rule used — cannot be animated at all, which is
why it had to go.

## Scope

Deliberately not included: the **composer**. It is the other card and would take the
same two lines, but several e2e checks assert `.composer` *count*, and a node still
fading out counts. Giving it an exit means auditing those first.
