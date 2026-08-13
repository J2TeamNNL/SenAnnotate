# Screenshot markup and delivery — brief

## What

Make the screenshot a first-class part of the report instead of a file the reader never
sees, and let the person taking it draw on the shot first.

Three pieces:

1. **A markup editor** between capture and save — arrow, box, and blur (pixelate), with
   undo. Blur is the one that matters: a tester photographing a real screen is
   photographing real customer data.
2. **A delivery choice.** Default: save the PNG and put its *absolute path* in the
   report, which is what an agent with a file-reading tool can act on. Optional:
   embed the image as a `data:` URI so the report is self-contained for Slack or Jira.
3. **The report line changes shape** accordingly — `**Screenshot:**` with a path, or a
   Markdown image.

## Why

`captureScreenshot()` crops the element and downloads a PNG, then
`shared/output.ts:189` writes:

```markdown
**Screenshot:** senannotate-1763029180000.png
```

That filename is useless to every reader of the report. An AI agent cannot open it —
it has no idea which directory it landed in. A human has to go hunting in Downloads and
match timestamps. The feature is half-built: the expensive part (capture, crop,
device-pixel-ratio correction) works, and the last 5% that makes it worth anything is
missing.

Blur has a second reason beyond politeness: the extension already refuses to record
field values and request bodies (`PRIVACY.md`). A screenshot is currently the one
channel through which a password manager's autofill or a customer's address can leave
the machine, and it is the channel with no controls at all.

## Scope

In:

- Markup editor: arrow, rectangle, blur region, undo, cancel, save.
- `screenshotDelivery` setting: `path` (default) or `embed`.
- Downscale + JPEG re-encode for the embedded copy, so a report stays sendable.
- A storage guard: never let an embedded image push the annotation payload past a size
  that `chrome.storage.local` will refuse.
- Report rendering for both modes.

Out:

- Text annotations on the image (the note already carries the words).
- Full-page (beyond-viewport) capture — `captureVisibleTab` photographs the viewport,
  and stitching a scrolling capture is its own task.
- Uploading anywhere.

## Success

- Draw a box + blur on a shot, save, copy the report: the report names a path that
  `Read` opens, and the blurred region is genuinely destroyed in the saved pixels (not
  a CSS filter over the top).
- Switch to embed, copy: the report carries `![…](data:image/jpeg;base64,…)` and stays
  under a few hundred KB per shot.
- Annotations with an embedded shot survive a reload; if they cannot, the annotation
  survives *without* the image rather than the whole page's notes failing to save.
