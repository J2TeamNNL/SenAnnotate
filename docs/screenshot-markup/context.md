# Screenshot markup and delivery — context

## What exists today

`src/content/screenshot.ts` — 68 lines, one exported function:

```
cropAndDownload(viewportPng, rect, filename)
  → loadImage(dataUrl)
  → ratio = image.width / window.innerWidth   // not devicePixelRatio; they disagree under zoom
  → crop with BLEED = 8px
  → canvas.toBlob → createObjectURL → <a download> → click → revoke after 10s
```

The `<a download>` route is deliberate and load-bearing: it is why the manifest carries
no `downloads` permission, and `test/e2e.mjs:833-855` asserts exactly that ("the
screenshot downloads without a downloads permission"). **Do not replace it with
`chrome.downloads`** — that trade was already made and tested.

`src/content/index.ts:432` (`captureScreenshot`) hides the shadow host, waits two
animation frames, asks the service worker for `captureVisibleTab`, restores the host,
then calls `cropAndDownload` and writes the bare filename onto the annotation.

## The three constraints that shape this

### 1. The download name is all we get

There is no API that tells a content script where Chrome put a downloaded file, and
adding the `downloads` permission (which does) would cost the permission the tests
assert we do without, plus a Web Store re-review.

So the "absolute path" in the report is **constructed, not observed**:
`~/Downloads/<filename>`. That is right on a stock browser and wrong for anyone who
moved their download directory. Mitigation: say so in the report line itself rather
than pretending certainty — the path is written as a hint an agent can resolve, and the
filename alone is still there if the directory guess is wrong.

### 2. `chrome.storage.local` has a 10 MB quota

Annotations persist under one key per `origin + pathname`
(`content/storage.ts:16`). A 1512×860 PNG screenshot is ~400 KB raw, ~550 KB as
base64. Five annotated screenshots on one page is 2.7 MB in a single `storage.local`
key — one page away from the quota, and `saveAnnotations` swallows the failure:

```ts
} catch {
  // Nothing useful to do — the in-memory list is still intact.
}
```

Which means *every* annotation on the page silently stops persisting the moment the
screenshots get too big. That failure mode is unacceptable, so the embedded copy is:

- downscaled to `MAX_EMBED_WIDTH = 900` CSS px,
- re-encoded as JPEG at quality 0.72 (a UI screenshot survives this well; a photo of a
  photo would not, and we are photographing UI),
- and dropped from the *persisted* payload if the whole page's annotations would exceed
  `MAX_STORED_BYTES`. The in-memory copy is kept, so the report you copy in this
  session still has the image; only the reload loses it, with a toast that says so.

The alternative — requesting `unlimitedStorage` — was rejected: a new permission on an
extension pending Web Store review is a review restart, for a problem that downscaling
already solves.

### 3. Blur has to destroy pixels

A CSS `filter: blur()` over a region is reversible by anyone with the original, and we
would be *saving* the original. The blur tool therefore resamples: draw the region
down to `region / PIXEL_SIZE` on a scratch canvas with smoothing off, then draw it back
up. The information is gone from the saved bitmap, which is the point.

`imageSmoothingEnabled = false` on the way back up is what makes it read as
"deliberately pixelated" rather than "bad photo", which matters — a reader should be
able to tell that something was redacted.

## Where the editor lives

Inside the existing shadow root (`ui.cardLayer`), as a `.card` like the composer and
panel, so it inherits the containment rules from `content/ui/root.ts`: the host stops
nine pointer event types and cancels `mousedown` so the page's modal is not dismissed
while you draw.

That last one is a trap. `mousedown` is `preventDefault()`-ed on the host for
everything except text fields (`root.ts:104`), and a `<canvas>` you drag on is not a
text field. Cancelling `mousedown` does **not** stop the event reaching our own
listeners — it only suppresses the default action (focus) — so pointer drawing still
works. Verified rather than assumed: the marquee in `content/index.ts` already drags
under the same regime, but it drags on the *page*, not inside the shadow root, so it is
not evidence. The editor uses `pointerdown`/`pointermove`/`pointerup` on the canvas
directly.

## Interaction with freeze

Capture already hides the overlay for two animation frames. Freeze is unrelated and
stays that way: a frozen page photographs identically, and the editor works on a static
bitmap, so nothing has to change there.

## Files

| File | Change |
|---|---|
| `src/content/screenshot.ts` | split capture from delivery; add downscale/encode helpers |
| `src/content/ui/shot-editor.ts` | new — the markup card |
| `src/content/ui/styles.css` | `.shot-editor` block |
| `src/content/index.ts` | `captureScreenshot` opens the editor, then delivers |
| `src/shared/types.ts` | `screenshotPath`, `screenshotData` on `Annotation`; `screenshotDelivery` setting |
| `src/shared/output.ts` | render path or embedded image |
| `src/popup/index.ts`, `static/popup.html` | the delivery toggle |
