# Brief — Security & correctness hardening (0.3.2)

A full-codebase review — one automated multi-angle pass plus a manual read of every
security surface — followed immediately by the fixes. Single folder, brief + changelog
only: for a fix batch, a separate context/plan would just restate the findings.

## What was reviewed

- **Trust boundaries:** the MAIN↔ISOLATED `postMessage` bridge, `chrome.runtime`
  messaging, the open shadow root, clipboard, downloads.
- **Data handling:** diagnostics redaction, report contents, storage.
- **The 0.3.1 rewrites** (`freeze.ts`, `identify.ts`, `output.ts`) — newest code,
  least production exposure, and where all six confirmed defects turned out to live.

## Sound, verified as such

- No HTML-string injection sinks anywhere (`innerHTML`/`outerHTML`/
  `insertAdjacentHTML`/`document.write`: zero hits; all rendering is `textContent`).
- The bridge crosses no privilege boundary — both ends live in page context, so a page
  forging bridge traffic gains nothing it does not already control. The privileged
  boundary (`chrome.runtime`) is unreachable from web pages (no
  `externally_connectable`).
- Diagnostics: no request/response bodies, credential-ish query params redacted, typed
  values never recorded, buffers capped.

## Known and accepted, not fixed

- **Report text is page-controlled.** A hostile page can put agent-directed
  instructions in visible text or `aria-*` and they ride the report into whatever AI
  tool it is pasted into. Inherent to the product; the tester guide already says to
  skim before pasting.
- **Shadow root stays `mode: "open"`** — Playwright pierces only open roots, so the
  71-check suite depends on it. The synthetic-click exposure this creates is closed by
  the `isTrusted` guard instead (see changelog).
