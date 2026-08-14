# Context — shift-click to select several

## Why <kbd>Enter</kbd> and not a plain click

The obvious alternative — shift-click to gather, then a plain click to finish — was
rejected because it makes the plain click mean two different things depending on
invisible state. Click with an empty set annotates one element; click with a set of
three annotates four. Nothing on screen distinguishes those, and the mistake is
expensive: you get an annotation you did not ask for and lose the set.

<kbd>Enter</kbd> costs one keystroke and is unambiguous. It also leaves the plain
click free to mean what it has always meant, which is the property worth protecting —
the single-element path is the one used constantly.

This does collide with 0.6.0's <kbd>Enter</kbd>, which is an alias for
`captureHovered()`. The collision is resolved in favour of the pending set and only
while one exists: mid-selection, the set is what you are pointing at, and whatever the
pointer happens to be resting on when you reach for the key is not. With no set, Enter
is unchanged.

## Ancestors are replaced, not refused

Shift-clicking a `<button>` and then the `<span>` inside it would put both in the set,
and the report would describe the same pixels twice.

The marquee already solved this by keeping only the outermost of any contained pair.
That rule is wrong here: with a rectangle you got the ancestor by accident, but a
shift-click is deliberate, and refusing it silently would read as the click not
registering. So the *newest* click wins and any element that contains it — or that it
contains — drops out.

## The hover highlight joins the set instead of replacing it

`pointermove` normally calls `updateHover`, which draws a labelled box and asks the
MAIN world for the component name. While a set is being gathered, that is the wrong
shape twice over: the label describes one element when the interesting state is the
set, and it spends a bridge round trip per pointer move to produce it.

So mid-selection the pointer draws into the same unlabelled `preview` style the
marquee uses, appended to the set's own boxes. What you see is what shift-clicking
would give you. The cost is that element names are not shown while gathering —
acceptable, and the same trade the marquee already makes.

## Ordering

`commitPendingSelection` sorts by `compareDocumentPosition` before handing over.
Click order is the order the user happened to work in; document order is the order the
report reads in and the order the marquee already produces. Two paths to a
multi-element annotation should not produce differently-ordered reports.

Disconnected elements are dropped at the same point — a set can outlive the elements
in it if the page re-renders while it is being gathered.

## Where this deliberately stops

`frames.ts` carries its own click handler for instrumented iframes, and it was left
alone. Adding shift-select there means the pending set has to live across a
`postMessage` boundary — the child would hold elements the parent cannot see — which
is a real design problem and not one this feature needs to solve to be useful.
