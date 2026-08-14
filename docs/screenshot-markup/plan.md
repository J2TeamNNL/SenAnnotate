# Screenshot markup and delivery — plan

Order matters: the data model first, so the editor and the report can be written
against a settled shape.

## 1. Types and settings

- `Annotation.screenshot` (bare filename) stays for backward compatibility with stored
  notes, and gains:
  - `screenshotPath?: string` — `~/Downloads/<file>`, what the report prints.
  - `screenshotData?: string` — a `data:image/jpeg;base64,…`, only when embedding.
- `Settings.screenshotDelivery: "path" | "embed"`, default `"path"`.
- `DEFAULT_SETTINGS` and the popup gain the same.

## 2. `screenshot.ts` — split capture from delivery

Replace the single `cropAndDownload` with:

```
cropToCanvas(viewportPng, rect) → HTMLCanvasElement    // the existing crop maths
canvasToBlob(canvas) → Blob
downloadBlob(blob, filename) → boolean                 // the existing <a download> path
encodeForEmbed(canvas) → string                        // downscale + JPEG + toDataURL
```

`cropAndDownload` disappears; `content/index.ts` composes the pieces. The crop
arithmetic — including the `image.width / window.innerWidth` ratio, which is correct
under zoom where `devicePixelRatio` is not — moves verbatim.

## 3. `ui/shot-editor.ts` — the markup card

A `.card.shot-editor` holding a `<canvas>` scaled to fit the viewport, a tool row, and
a footer.

- Tools: `arrow`, `box`, `blur`. One is always selected; `box` is the default.
- Model: an array of shapes `{tool, from, to}`. Drawing pushes; **undo pops**. The
  canvas is repainted from the base bitmap plus the shape list on every change, so undo
  needs no snapshot stack.
- Blur is applied at *paint* time from the base bitmap, so undoing a blur genuinely
  restores the pixels; the destructive step happens once, in `flatten()`, when saving.
- Pointer handling on the canvas element itself, in canvas coordinates (`offsetX/Y`
  scaled by `canvas.width / canvas.clientWidth`).
- Footer: `Skip` (save unedited), `Cancel`, `Save`. Escape cancels.

## 4. Wire it into `captureScreenshot`

```
hide overlay → capture → restore overlay
crop → open editor
  cancel → nothing happens, no file written
  save   → flatten → blob → download → build path
           if delivery is "embed": also encodeForEmbed → screenshotData
           persist, with the size guard
```

The editor opens *after* the overlay is restored, so it is never in its own shot.

## 5. Storage guard

In `content/index.ts`, before `saveAnnotations`: measure
`JSON.stringify(annotations).length`. Over `MAX_STORED_BYTES` (4 MB, well under the
10 MB quota and leaving room for other pages), strip `screenshotData` from the oldest
annotations until it fits, and toast once. The in-memory list keeps its images.

## 6. Report

`shared/output.ts`:

- `path` delivery → `**Screenshot:** ~/Downloads/senannotate-abc.png`
- `embed` delivery → `**Screenshot:**` line plus `![screenshot](data:…)` on its own line
- Neither at `compact`, which is one line per note by definition.

## 7. Tests

Extend `test/e2e.mjs`'s existing screenshot block:

- the editor card appears after clicking the camera button,
- drawing a box then saving still produces a download with no `downloads` permission
  (the existing assertion, preserved),
- the report line carries `~/Downloads/` rather than a bare filename.

## Verification

```bash
npm run typecheck
SENANNOTATE_PLAYWRIGHT_DIR=… npm test
```
