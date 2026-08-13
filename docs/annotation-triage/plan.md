# Annotation triage — plan

## 1. Model

`shared/types.ts`:

```ts
export type AnnotationKind = "bug" | "ui" | "copy" | "question";
export type AnnotationStatus = "open" | "done";

export const ANNOTATION_KINDS: { value: AnnotationKind; label: string; colour: string }[]

// on Annotation
kind?: AnnotationKind;      // absent → "ui"
status?: AnnotationStatus;  // absent → "open"
```

Two helpers, `kindOf(annotation)` and `isDone(annotation)`, so no other module repeats
the defaulting.

## 2. Composer

A chip row above the textarea. Four buttons, `aria-pressed` on the selected one, class
`.kind-chip` + `data-kind`. Selecting one only changes local state; it reaches the
annotation through `onSubmit(comment, kind)`.

Editing an existing annotation pre-selects its kind.

## 3. Panel

- Header gains a filter: `All · Open · Done`, plain buttons, `.panel__filter`.
- Each `.entry` gains a `.entry__kind` dot before the number and a `.entry__status`
  checkbox button after the body. `.entry__element` / `.entry__comment` keep their exact
  current roles so the e2e locators hold.
- Done entries get `data-done="true"`; CSS mutes them.
- Footer gains a **Download .md** button beside **Copy report**.

## 4. Markers

`Markers.render` sets `dataset.kind` and `dataset.done` on each pin; the stylesheet
maps them to the four hues and the muted state. No JS colour logic.

## 5. Report

`shared/output.ts`:

- heading becomes `### 1. [bug] button "Save changes"` — the type is omitted for `ui`,
  which is the default and would otherwise decorate every line of every report.
- open notes numbered as now; done notes collected and rendered after them:

```markdown
## Already fixed

- **button "Save changes"** — Make this the primary action.
```

- `compact` gets one extra line: `_3 already fixed._`

## 6. Export / import

`content/storage.ts`:

```
exportAll() → ExportFile          // reads every senannotate:page: key
importAll(file: ExportFile) → { pages: number; annotations: number; skipped: number }
```

Validation lives in `importAll`: `format` must match, every annotation must have
`id`/`comment`/`element`/`selector` as strings. Merge per page by id, imported wins.

Popup: **Export** (Blob → `<a download>`, same trick as the screenshot, still no
`downloads` permission) and **Import** (`<input type="file" accept="application/json">`
→ `text()` → `JSON.parse` in a try/catch → `importAll` → report counts in the button
label, matching how `Clear` already reports).

## 7. Download .md

`content/index.ts`: build the same Markdown `copyReport()` builds, wrap in a Blob,
reuse `downloadBlob` from the screenshot task. Filename
`senannotate-<hostname><pathname with / → ->.md`.

Depends on task 1 having landed `downloadBlob`; if this task is done first, move the
helper here instead.

## 8. Tests

- annotate → pick `bug` → copy → report heading carries `[bug]`
- mark done → copy → the note is under `## Already fixed` and out of the numbered list
- filter `Open` hides the done entry
- export → parse the JSON → it has `format: "senannotate/annotations"` and the note

Export/import through the popup is not driveable from the current harness (it drives
page contexts, not the extension popup); the storage functions are exercised directly
from a page context instead, via `chrome.storage` in an `evaluate`.

## Verification

```bash
npm run typecheck
SENANNOTATE_PLAYWRIGHT_DIR=… npm test
```
