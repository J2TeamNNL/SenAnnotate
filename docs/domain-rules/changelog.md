# Changelog — where the extension is allowed to run

## What shipped

`Settings.domainRuleMode` (`off` | `allowlist` | `blocklist`) and `Settings.domainRules`,
a list of host patterns. Evaluated in `shared/domain-rules.ts` before anything is built,
per document — so a child frame answers to its own host. Edited in the popup's **Sites**
section, which also names the pattern that decided the current tab.

Six files: `shared/domain-rules.ts` (new), `shared/types.ts`, `content/index.ts`,
`popup/index.ts`, `static/popup.html`, `README.md`. Plus a fixture and an e2e block.

## The decision that shaped everything else

The first sketch put this in the toolbar's settings card, beside the other switches, and
reused `hideUntilRestart`'s mechanism: build the overlay, then hide the host.

Both halves were wrong, and for the same underlying reason — **a blocked site is a site the
extension has no business on, and "no business" is not a statement about pixels.**

A hidden overlay is still a shadow host on `documentElement`, eleven listeners at that
host, a `chrome.runtime.onMessage` listener answering for the page, a document-level
pointer/click/keydown set, and — with `captureDiagnostics` on — `fetch`, `XHR` and
`console.error` replaced in the page's own heap. `challenge-frames/` already paid for that
lesson: patching page natives inside iframes broke Cloudflare challenges, and the fix was
to *not run*, not to run invisibly.

And the card cannot be the editor, because the card is drawn inside the overlay that a
blocked site does not have. Allowlist one host and every other site goes quiet — the popup
is then the only surface that still opens. So the popup writes these two fields, which is a
deliberate exception to the *one owner, one writer* invariant 0.7.0 established, and it is
recorded in that module's banner rather than left to be inferred.

The consequence is that `content/index.ts`'s entry is now `async`. That branch is the one
`CLAUDE.md` calls the most important line in the file, so the change is small on purpose:
the branch itself is unchanged, and the storage read wraps it.

## `*` matches one label, and that is a safety property

The greedy reading is more convenient. It is also unsafe in the direction that matters:
with it, an allowlist entry of `foo.*` would admit `foo.evil.example.com`. A pattern in an
allowlist must never match more hosts than it looks like it does, and because it is *one*
list read two ways, that constraint decides the blocklist semantics too.

The complementary rule goes the other way: a bare `example.com` **does** include its
subdomains, because someone excluding a company's site means the site rather than one
hostname of it. `*.example.com` stays available for the narrower reading.

## Fail open, deliberately

`loadSettings` returns `DEFAULT_SETTINGS` on a storage error and the default mode is `off`,
so an unreadable setting leaves the extension working. The opposite choice would make a
transient storage error indistinguishable from an uninstall — on every page at once, with
the popup reading the same broken storage and unable to explain it.

## Two smaller things worth writing down

**The list is saved on `change`, not on input.** `chrome.storage.sync` has a per-minute
write quota; saving per keystroke would burn it on one paragraph of typing.

**The textarea is not repainted while it has focus.** Rewriting `value` from the stored
list on every repaint moves the caret to the end, which is unusable on a multi-line field.

## Verification

`npm run typecheck` and `npm run build` clean.

```
219/219 checks passed
9/9 upgrade checks passed
```

212 of those are `main`'s; 7 are new.

The new block drives the popup and asserts on the **absence** of a toolbar, which is the
only honest way to test this:

- a blocklisted host gets no toolbar at all
- the popup says *off on this site by your rules* rather than the browser's *not
  available*, and names the pattern
- an allowlist that does not cover the host keeps it away
- a wildcard label matches, so `127.0.0.*` admits `127.0.0.1` — the part a string compare
  would miss
- a pattern **longer** than the host does not match it, which is the other half of the
  subdomain rule
- turning the rules off brings the toolbar back

Two traps this block had to be built around, both from `CLAUDE.md` and both real:

**It runs last and restores what it changed.** The rules live in `chrome.storage.sync`,
shared by every page in the suite's single profile — a rule left behind does not just
disturb the next block, it switches the extension off for the rest of the run, and the
symptom is a `.toolbar` locator timing out somewhere unrelated. The restore is asserted
rather than assumed.

**Absence needs a timeout, not a `waitFor`.** `waitFor` on `.toolbar` in a page where the
toolbar is correctly missing is just the failure, five seconds later. The probe waits a
fixed 2.5s and then counts.
