# Context — anchoring a card to a dock that moves

## Why the settings card and not the panel

They look like the same problem and are not.

The settings card is a popover belonging to the gear it opens from. It has no identity of
its own — no page name, no counts, nothing that says which toolbar it configures — so at
900px from the pill it is genuinely disorienting. Its CSS says as much: `bottom: 72px;
right: 20px`, a *distance from the dock*, written when the dock could only be in one place.

The annotations panel is the page's list of notes. It is pinned `top: 20px` **and**
`bottom: 72px`, so it is already as tall as the viewport allows and cannot be moved
without deciding what its height means; it is read as a document, scrolled, filtered and
sorted, none of which is popover behaviour. Following the pill would also make the pill's
position decide how much of the page the list covers, which is the opposite of what
dragging the pill is for — getting the overlay *off* the thing being reviewed.

So the split is not a compromise. It is what the two cards already are. `styles.css` even
says so, in the comment on the shared `bottom: 104px` clearance: the two rules are kept
separate because "the panel is pinned top *and* bottom, the settings card only bottom".

## Anchoring to a box, not to a CSS variable

The obvious alternative was to have the drag write its position into custom properties —
`--sa-dock-left`, `--sa-dock-top` — and let each card position itself off those in CSS.
It was rejected for one reason: the flip. A card that must go *below* the pill when there
is no room above needs the card's own measured height to decide, and CSS cannot branch on
it. Anchor positioning (`anchor-name` / `position-area`) does exactly this natively and is
Chrome 125; this project floors at 111.

So the card is positioned in JavaScript, from a box. `Composer.position()` is the prior
art and `SettingsCard.anchorTo()` borrows its shape — pick a side, then clamp to the
viewport, with the same `EDGE` of 12px — because two cards that place themselves by
unrelated rules is how an interface starts to feel arbitrary.

`GAP` is 8 rather than the composer's 12, and that is not a style choice: the default
corner has always had an 8px gap between the card and the pill (the dock sits `bottom:
20px` and is 44px tall, the card `bottom: 72px`). Reproducing it is what makes a dragged
toolbar look the same as one that has never been dragged.

## The card is too tall for "prefer, flip, clamp"

The composer is ~260px tall and can be placed whole on one side of its target. This card
cannot: the stylesheet caps it at `100vh - 92px` and its body scrolls, so on a 900px
viewport it is around 560px tall. With the pill anywhere near the middle of the screen,
*neither* side has room for it — and the fallback in the composer's algorithm, "clamp the
card into the viewport", then detaches it from the pill entirely and parks it against the
bottom edge. Measured, on the first run of the new checks: pill at y=666, card placed at
y=331, 335px of daylight between them and no visible relationship left.

So `anchorTo` does one thing the composer does not: it takes the **roomier** side and caps
the card to fit there, with an inline `max-height`. The card is designed to be capped and
scrolled — that is what the CSS `max-height` and `overflow-y: auto` on `.settings__body`
already do — so shortening it costs nothing, and it keeps the pill and its card visibly one
object at any pill position. `MIN_HEIGHT` floors the cap so a pill filling a very short
viewport cannot squeeze the card down to its header.

## `null` means "let CSS do it"

`Toolbar.dockBox()` returns a box only while the dock is floating, and `null` when the
pill sits in its default corner. `anchorTo(null)` removes the inline `left`/`top` and the
`data-anchored` flag, putting the card back under the stylesheet's control.

That is not just tidiness. The default corner is the configuration the extension ships in
and the one the e2e suite measures — including the rule that neither card may cover the
inspect-mode hint line, asserted against the *rendered* geometry. Re-deriving the default
placement in JavaScript would mean re-deriving `bottom: 72px`, the `104px` inspect
variant, and the `max-height`, and any drift between the two would appear only in the
default state: the one nobody thinks to check because it "was already working".

## Releasing `bottom` and `right` explicitly

`.settings` sets `bottom` and `right`; anchoring sets `left` and `top`. Setting all four
does not average them — the box stretches between the two edges, which for a card with
`max-height: calc(100vh - 92px)` reads as the card mysteriously growing when dragged.
`.settings[data-anchored="true"] { bottom: auto; right: auto; }` is the same release the
dock itself needed when it grew a drag, and `styles.css` already carries that comment for
`.toolbar-dock[data-floating="true"]`.

The `[data-inspecting="true"] ~ .settings { bottom: 104px }` clearance is switched off by
the same attribute, and nothing replaces it. The hint line lives *inside* `.toolbar-dock`,
so once the card is placed off the dock's measured box it clears the hint by construction
— the box already contains it. The prediction is only needed when the placement is a
guess made in CSS.

## Why it follows during the drag, not on the drop

`onMove` fires on drop, deliberately: it persists, and a drag would otherwise write to
`chrome.storage.local` sixty times a second. Reusing it for the card would have been free,
and wrong — the card would sit still while the pill slid out from under it, then teleport.

So the drag grew a second, cheaper signal. `onDockShift` fires from `paintPosition()`,
which is the one place the dock's inline coordinates are written, and carries nothing: the
listener asks for the box itself. That placement means the card also follows the three
moves that are not drags and would each have been a separate bug —

- a **window resize** re-clamping a stored position back into view,
- the **`ResizeObserver`** re-clamp when the dock's own size changes,
- **collapse and expand**, which changes the pill's width and therefore its right edge.

— none of which go through `onMove` at all.

## Order of operations when the card opens

`toggleSettings(true)` constructs the card, renders it, *then* anchors it. The anchor
needs `offsetHeight` to decide whether the card fits above the pill, and a card that has
not rendered its rows yet measures short — it would be placed for a height it is about to
outgrow, and the flip would come out wrong exactly on the pages where it matters.
