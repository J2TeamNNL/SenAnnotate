# Diagnostics and Privacy

The half of the report nobody would have written by hand — and the rules about what it is
never allowed to contain.

---

## What is captured automatically

With **Capture errors & steps** on (the default), the report carries three sections
beyond your notes.

### Console errors

- uncaught throws
- unhandled promise rejections
- `console.error` calls
- failed resource loads

With stack traces at **Detailed** and **Forensic**.

### Failed requests

Every `fetch` and `XMLHttpRequest` that returned 4xx/5xx or failed outright, with:

| | |
|---|---|
| method | `GET`, `POST`, … |
| path | the URL, with sensitive query params redacted |
| status | `500`, or the network failure |
| duration | how long it took to fail |

### Steps to reproduce

A trail of clicks, field edits, form submits and navigations, timestamped relative to
page load.

---

## Why it is installed so early

All three are installed at **`document_start`, in the page's own world** — before the
app's first line runs.

That matters more than it sounds. An error thrown during hydration, a request that fails
before the router mounts, a redirect that happens in the first 200ms: none of them are
observable to something installed on `DOMContentLoaded`. Those are also, reliably, the
bugs nobody can reproduce.

Being in the page's own world is not optional either. An isolated content script gets its
own `console` and its own `fetch`; patching those observes only the extension's own
calls. See [[Architecture]].

---

## Recording pauses while you are annotating

Inspect mode suspends the step trail. Clicking an element to annotate it is not a
reproduction step, and a trail full of *"Clicked button New order"* entries that were you
using the tool would be worse than no trail.

---

## The two things that are never recorded

These are guarantees with tests behind them, not defaults.

### 1. Values typed into fields

The trail records **that a field was edited and which field it was** — never what was
typed:

```
Edited Password
Edited Email
```

Not the password. Not the email. There is no setting that turns this into full capture,
because a tester recording a real session is recording real credentials.

### 2. Request and response bodies

Only the method, path, status and duration. Never the payload, in either direction.

### And: credential-looking query params are redacted before storage

A URL is stored with sensitive-looking parameters replaced by `[redacted]` — matched on
the parameter *name*, before the URL is written anywhere:

`token` · `secret` · `password` · `passwd` · `signature` · `sig` · `apikey` ·
`api_key` · `auth` · `session` · `jwt` · `credential` · bare `key` · bare `code`

The match is on any parameter whose name *contains* one of those words, so
`X-Refresh-Token` and `stripe_api_key` are both caught. `code` and `key` are matched
exactly, because they are OAuth's names for the two things you least want in a ticket.

The same redaction applies to component **props**, so a `token` prop reports its name and
`[redacted]`.

---

## Where the data lives

| What | Where | Syncs? | Survives upgrade | Survives uninstall |
|---|---|---|---|---|
| Annotations | `chrome.storage.local` | No | Yes | **No** |
| Settings | `chrome.storage.sync` | Yes, with your Chrome profile | Yes | No |
| Diagnostics | Memory only, for the current page load | — | — | — |
| Screenshots | Your **Downloads** folder | — | Yes | Yes |

Diagnostics are deliberately not stored. They belong to a page *load*, and a stored
console error from three reloads ago is misinformation.

**Export before uninstalling** if you want to keep your notes — see
[[Sessions Export and Import]].

---

## What leaves your machine

Nothing.

- No account, no sign-in, no server.
- No telemetry, no analytics, no crash reporting.
- No remote code: everything runs from files inside the extension.
- The only network traffic on a page you annotate is the page's own.

The report goes to your clipboard or to a file. Where it goes from there is your
decision — and worth a thought, since a Forensic report can name your internal
directory structure.

---

## The permissions, and why each one exists

| Permission | Why |
|---|---|
| `storage` | Keep annotations across a reload, and settings across machines. |
| `activeTab` | Photograph the visible tab — only when you click the camera. |
| `clipboardWrite` | Write the report to the clipboard, including on pages that block the modern clipboard API. |
| Host access (`<all_urls>`) | The page you want to annotate can be **any** URL — localhost, staging, production — so the hosts cannot be known in advance. |

`<all_urls>` is the one that looks alarming on the install prompt, and it is the honest
cost of a tool whose whole point is working on a site it was not built into. It is also
why the Web Store review for this extension is a manual one, measured in days.

The canonical statement is
[`PRIVACY.md`](https://github.com/thangnm93/SenAnnotate/blob/main/PRIVACY.md) in the
repository; this page summarises it.

---

## Turning it off

**Capture errors & steps** in [[Settings]] stops the recording — not merely its display.
The capture banner in the panel disappears with it, and the report carries only your
notes.
