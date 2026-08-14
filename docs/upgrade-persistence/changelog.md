# Changelog

## Investigation first — there was no bug

The request read like a defect report, so the first move was to find out whether anything was
actually lost on upgrade. Nothing is:

- `NS = "senannotate"` in the minified `content.js` of every shipped zip (0.2.0, 0.4.0, 0.5.1,
  0.5.2) and in the current build, so both storage keys are unchanged across every release.
- `git show v0.2.0:src/shared/types.ts` gives the same required `Annotation` fields as today;
  everything since is optional.
- `loadSettings()` already spreads over `DEFAULT_SETTINGS`.

So no migration was written. Writing one would have been dead code: there is no old key to read
from and no shape to convert.

## What was added

`test/upgrade.mjs` — a real upgrade, not a simulated one. Two launches over one profile
directory with the version bumped in `dist/manifest.json` between them; an unpacked extension's
id comes from its path, so the path stays and the id — and the storage — with it.

Nine checks: the id survives, the running manifest is the bumped version (so the second launch
really is a new version, not a restart), `theme` and `detail` set through the popup hold, both
notes are on the page, both are in the report, and the toolbar count agrees. One of the two
notes is written in the 0.2.0 shape — no `kind`, no `status`, none of 0.6.0's fields — which is
the check that fails the day a field is promoted to required.

`npm test` now runs it after `e2e.mjs`; `npm run test:upgrade` runs it alone.

## The wrong turn

The first attempt put this inside `e2e.mjs` and used `chrome.runtime.reload()` after rewriting
the manifest — three lines instead of a second launch. It got as far as the suite's last block
and then died on `page.goto`:

```
harness error: page.goto: net::ERR_BLOCKED_BY_CLIENT
  at chrome-extension://epomlnedpiklalljfpehkkhhleoaipcd/popup.html
```

Chrome does not reload an extension that was loaded with `--load-extension` when it calls
`chrome.runtime.reload()` — it drops it, and everything addressed to it afterwards is blocked.
The two-launch structure is not a nicety; it is the only way to observe an upgrade here. That
is why the check is a separate file: `e2e.mjs` is deliberately one context over one throwaway
profile, and a second launch sharing a profile does not fit in it.

## Result

`9/9` upgrade checks, and `164/164` still passing in the suite (the ten new ones there belong to
`modal-top-layer/`). Verified from `npm test`, so the release gate covers both.
