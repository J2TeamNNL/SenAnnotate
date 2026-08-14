# Context — what an upgrade actually preserves, and how to test it

## The compatibility contract

Three things, together, are why an upgrade keeps a user's work. All three are easy to break by
accident, and none of them was pinned by a test before this task:

1. **The storage keys.** `ANNOTATION_PREFIX` and `SETTINGS_KEY` in `shared/protocol.ts` resolve
   to `senannotate:page:<origin><pathname>` and `senannotate:settings`. Renaming either — or
   `NS`, which both are built from — orphans every note and every setting on every installed
   copy, silently: `get()` on a key nobody wrote returns `undefined`, which reads as "no notes
   on this page".
2. **Optional-by-default on `Annotation`.** Everything added after 0.2.0 is optional, and the
   two fields with behaviour attached say what absence means (`kind` → `ui` via `kindOf`,
   `status` → `open` via `isDone`). Promoting any field to required makes older notes malformed.
3. **`loadSettings()` spreading over `DEFAULT_SETTINGS`.** A settings object from an older
   version is missing whatever was added since; the spread fills those in. Reading the stored
   object directly instead would hand `undefined` to code expecting a value.

Verified against what actually shipped, rather than against the current source: extracting
`content.js` from `senannotate-0.2.0.zip`, `-0.4.0`, `-0.5.1`, `-0.5.2` and resolving the
minified namespace constant gives `NS = "senannotate"` in every one, and `git show
v0.2.0:src/shared/types.ts` shows the same required `Annotation` fields as today.

## What is *not* preserved, by design

Storage is keyed by extension id, and the id is not stable across these:

- **Uninstall then reinstall.** Chrome clears the storage on uninstall.
- **A side-loaded unpacked copy vs. the Web Store copy.** Different ids, so different storage —
  they are two extensions that happen to share a name. Moving notes between them is what the
  popup's export / import is for.
- **An unpacked copy loaded from a different directory.** The id of an unpacked extension is
  derived from its absolute path.

That last one is what makes the test below possible: keep the path, keep the id.

## Testing a real upgrade

`test/upgrade.mjs` runs two browser launches over **one** profile directory:

```
launch 1   annotate a page, seed a 0.2.0-shaped note, set two settings in the popup, quit
bump       rewrite "version" in the loaded dist/manifest.json
launch 2   same profile, same extension directory → new version, same id, old storage
```

Two findings from building it, both worth not rediscovering:

- **`chrome.runtime.reload()` is not a shortcut for this.** It looked like one — bump the
  manifest, reload, assert. Measured: Chrome *drops* an extension that was loaded with
  `--load-extension` when it calls that. Every navigation to it afterwards fails with
  `net::ERR_BLOCKED_BY_CLIENT`, and the suite dies on a `page.goto` rather than on a check.
- **It cannot live in `e2e.mjs`.** That suite is one persistent context over one throwaway
  profile, deliberately — a second launch sharing the profile does not fit inside it. Hence a
  second file, wired into `npm test` after it so the release gate still runs one command.

The upgrade is asserted to be real rather than assumed: launch 2 reads
`chrome.runtime.getManifest().version` and checks it is the bumped one, and compares the
extension id against launch 1's.

## Related

- `annotation-triage/` — where `kind` and `status` came from, and the "absent means" defaults
  that make this work.
- `session-and-frames/` — export / import, the only supported way to move notes between two
  installs that do not share an id.
