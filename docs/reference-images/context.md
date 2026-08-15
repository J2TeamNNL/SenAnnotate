# Context — two kinds of image, and why `paste` is not guarded

## Separate field, not a shared list

`referenceImages: string[]` sits beside `screenshotData`, and the temptation to merge
them into one `images` array with a `kind` was refused. They answer opposite questions:

| | question it answers |
|---|---|
| `screenshotData` | what does this element look like **now** |
| `referenceImages` | what should it look like **instead** |

An agent handed both under one heading has to infer which is the target, and inferring
wrong means implementing the current state on purpose — the one failure mode that looks
like success. Separate fields make that impossible to get wrong in the report, and the
heading spells it out anyway.

The split also decides the quota order (below), which a `kind` discriminator would have
left as a runtime filter.

## Quota: references outlive screenshots

`fitToQuota` sheds embedded images when a page's annotations outgrow the storage budget.
It now runs in two passes — **every** screenshot first, then reference images.

The rule is recoverability. A screenshot can be taken again by standing on the page and
pressing the camera. An image pasted from Figma exists nowhere this extension can reach;
dropping it destroys the only copy. Given a choice of what to lose, lose the one that
can be replaced.

## Encoding happens in the orchestrator, not the composer

The composer's `onAttach` hands back raw `File`s and `index.ts` encodes them, then calls
`addReferenceImages` with `data:` URIs. The UI layer draws and does not know what a
canvas is for — the same division that keeps `ShotEditor` out of the screenshot pipeline.

Everything goes through `encodeSuppliedImage`, which is `encodeForEmbed` with a decode in
front: the same 900px ceiling and the same JPEG quality as a captured screenshot. Not
tidiness — a full-size Figma export off the clipboard is megabytes, and three of them
would eat the page's whole budget before the user finished typing. One size of thing for
`fitToQuota` to reason about.

## Why `paste` is not one of the guarded events

`dom.ts` drops untrusted `click`, `mousedown`, `mouseup`, `pointerdown` and `pointerup`,
because the shadow root is open and a hostile page could otherwise "click" the screenshot
button or Clear all. `paste` is deliberately **not** on that list.

What a page could do by synthesising one: put an image into a composer the user has open,
where it appears as a thumbnail with a remove button next to it. Nothing is destroyed,
nothing leaves the page, and the data flows inward. Against that, guarding it would make
the behaviour untestable — there is no way to put an image on the OS clipboard from the
e2e suite, so the check dispatches a synthetic `ClipboardEvent`.

Recorded because it is a real decision and the test depends on it: if `paste` is ever
added to `ACTIVATION_EVENTS`, the paste check fails and the fix is not to weaken the
check.

## The three-image cap is a UI limit

`MAX_REFERENCE_IMAGES = 3` is not about storage — `fitToQuota` owns storage. Past three
pictures the note has stopped being one change, and the strip stops fitting across the
380px card without a scroller nobody wants inside a composer.
