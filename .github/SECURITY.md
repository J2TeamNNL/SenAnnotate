# Security policy

## Reporting

**Do not open a public issue.** Use
[GitHub's private advisory form](https://github.com/thangnm93/SenAnnotate/security/advisories/new).

Include the version (the settings card footer shows it), your Chrome version, and enough
detail to reproduce. You will get an acknowledgement within a few days.

## Supported versions

The latest release only. This is a browser extension that updates itself from the Chrome
Web Store, so there are no maintained older branches — a fix ships as a new version.

## What is in scope

The extension runs with `<all_urls>` host access and injects a script into the page's own
JavaScript world, so the interesting boundaries are:

- **The MAIN-world inspector** (`src/inspector/`) reading page internals, and the
  `window.postMessage` bridge between it and the content script. A page can post to that
  bridge; anything reachable that way is in scope.
- **Report generation** (`src/shared/output.ts`) and the export/import archive
  (`src/shared/archive.ts`) — both handle strings scraped off arbitrary pages, and an
  imported archive is fully attacker-controlled.
- **The privacy guarantees**, which have tests and which a bug could defeat: field values
  are never recorded, request and response bodies are never recorded, and
  credential-looking query params are `[redacted]` before storage. A way to get a
  password, a token or a request body into stored data or into a report is a security
  bug, not a feature request.
- **Extension-page surfaces** — the popup and the service worker — reachable from a web
  page.

## What is not

- **`<all_urls>` itself.** The extension's purpose is annotating a page it was not built
  into, on any host, so the hosts cannot be known in advance. It is declared and
  justified in [`PRIVACY.md`](../PRIVACY.md).
- **The MAIN-world script being able to see page data.** That is the mechanism the
  framework detection depends on; without it there is no component chain and no source
  line.
- **A Forensic report naming your source paths.** That is what the level is for. Choose
  the level, and choose where you paste the result.
- **`vite-plugin-vue-tracer` on a production build exposing source paths.** Documented as
  a deliberate trade in the wiki and the README; it is your build's decision, not the
  extension's.
- **The *"not trusted by Enhanced Safe Browsing"* notice.** Chrome's install-age clock.
  See the wiki's Troubleshooting page.
