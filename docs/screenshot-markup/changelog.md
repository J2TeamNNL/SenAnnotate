# Screenshot markup and delivery — changelog

## 0. Starting point

`cropAndDownload` wrote a PNG to Downloads and the report printed the bare filename,
which no reader — human or agent — could resolve to a file.

## 1. `screenshot.ts` split four ways

`cropAndDownload` is gone, replaced by `cropToCanvas` / `canvasToBlob` /
`encodeForEmbed` / `downloadBlob`, plus `downloadPath` for the constructed
`~/Downloads/<file>` string. The crop arithmetic moved across untouched, including
the `image.width / window.innerWidth` ratio that is correct under page zoom where
`devicePixelRatio` is not.

`downloadBlob` kept the `<a download>` + blob URL route deliberately. It is why the
manifest still asks for no `downloads` permission, and `test/e2e.mjs` asserts exactly
that.

## 2. The editor, and two things the plan missed

**Escape closed the wrong card.** The editor opens on top of a composer, and the
composer's textarea holds focus. `ShotEditor` registers its Escape and ⌘Z handlers on
its own element, so with focus elsewhere neither fired — Escape reached the document
handler instead, which closed the *composer* and left the editor floating with nothing
to attach its result to. Fixed twice over: the card takes `tabindex="-1"` and focuses
itself on open, and `closeComposer()` now closes the editor first. `closeShotEditor()`
hands focus back to the composer so a half-typed note can be resumed without a click.

**Blur reads from the canvas, not the base bitmap.** Written first as "resample the
region out of the original", which erased any box or arrow drawn underneath it. Now
each shape paints in list order over whatever is already there, so a blur over a box
redacts the box too — and because the shape list is replayed from scratch on every
repaint, undoing a blur still restores the real pixels.

## 3. Storage guard

`saveAnnotations` returns `{ ok, droppedImages }` and sheds `screenshotData` oldest-first
past 4 MB. The failure this prevents is worse than it looks: `set()` throwing meant the
existing `catch {}` silently stopped persisting *every* note on the page, not just the
images.

## 4. Report

`renderScreenshot()` prefers `screenshotData` (an inline `![](data:…)`), falls back to
`screenshotPath`, and still honours the pre-0.6.0 bare `screenshot` filename so old
stored notes degrade to what they always were instead of losing the line entirely.

Square brackets are stripped from the alt text — the element name is scraped off the
page and can contain anything, and `![button [x]](…)` closes the alt early.

## 5. Tests

The existing "downloads without a downloads permission" assertion is preserved but now
runs after `Save` in the editor rather than straight off the camera button. Added: the
editor opens, the canvas is drawable, drawing enables undo, the report carries
`~/Downloads/…`, and the default delivery embeds no `data:` URI.

125/125 → all green.
