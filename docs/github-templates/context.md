# Context

## What already exists

| File | Runs |
|---|---|
| `.github/workflows/ci.yml` | push to `main` + every PR — typecheck, build, pack, upload zip (14 days) |
| `.github/workflows/release.yml` | on a `v*` tag |
| `.github/workflows/store-check.yml` | Web Store credential / listing check |
| `.github/workflows/store-publish.yml` | uploads the zip to the Store |

**No `npm test` anywhere**, deliberately: the suite needs Playwright with browsers
supplied by env var and a browser to drive. `docs/ci-cd/context.md` carries the argument.

Labels are GitHub's nine defaults. Nothing in the repo has ever applied one.

## Issue forms vs Markdown templates

YAML issue **forms** (`.yml`) were chosen over Markdown templates (`.md`) because a form
can mark a field `required`. The whole point here is that a bug report without the
version and the install route costs a round trip, and a Markdown template's prompts are
deleted by roughly half of reporters.

Cost: forms cannot be edited by a contributor who wants to restructure the report, and
they render as a fixed sequence of headings. Acceptable — the fixed sequence is the
feature.

A **PR** template cannot be a form. GitHub only supports Markdown there, so the PR
template is Markdown with checkboxes.

## Labels the forms apply

A form's `labels:` are applied silently only if the label **already exists**; a name that
does not exist is dropped without a warning. So the two new ones are created alongside:

| Label | Why |
|---|---|
| `framework` | Detector work is its own category — one file per framework, its own docs folder, and the failure mode differs from an ordinary bug. |
| `needs-triage` | Applied by every form, removed on triage. Without it there is no way to ask "what has nobody looked at". |

`bug`, `enhancement`, `documentation` and `question` already exist and are reused.

## Facts the templates encode

Read out of the repo rather than assumed:

- **Static gate:** `npm run typecheck` only. No linter, no test framework.
- **Manual gate:** `npm test` — `SENANNOTATE_PLAYWRIGHT_DIR` required, `SENANNOTATE_HEADLESS=1` to keep the screen.
- **Version lives only in `package.json`**; `static/manifest.json`'s copy is dead and stamped at build.
- **The e2e suite asserts on shadow-DOM class names and on the exact text of `.toolbar-hint`.**
- **A new permission restarts the Chrome Web Store manual review** — days, not minutes — and matters more while the extension is still inside the Enhanced Safe Browsing trust window.
- **Licensing:** `content/identify.ts`, `inspector/freeze.ts`, `shared/output.ts` must not be informed by upstream `agentation` (PolyForm Shield). `NOTICE.md` is the record.

## What is deliberately not here

- **A `CODE_OF_CONDUCT.md`.** A single-maintainer repo with no community yet; adding the
  Contributor Covenant now would be furniture rather than policy. Worth adding when there
  is a second regular contributor.
- **Dependabot config.** Two devDependencies and zero runtime dependencies — the noise
  would exceed the value.
- **A `.github/FUNDING.yml`.**
