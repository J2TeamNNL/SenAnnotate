# Plan

## 1. Screenshots first, pages second

Pages are written against images that exist, so no page promises a picture that was
never shot.

`scripts/wiki-assets.mjs`, modelled on `scripts/store-assets.mjs`: same local server,
same `launchWithExtension`, same `store/demo.html`. Output `wiki/images/`, committed
(unlike `store/out/`, which is generated per release and gitignored — the wiki repo has
no build step, so its images must be real files).

Shot list, none of which the Web Store listing needed:

| File | Shows |
|---|---|
| `toolbar.png` | the pill alone, every button visible |
| `toolbar-collapsed.png` | the dot after `H`, still carrying the count |
| `hint-line.png` | the line under the toolbar naming the current mode |
| `multi-pick.png` | three non-adjacent elements picked, counted |
| `text-mode.png` | mode 2, a text range selected |
| `panel-triage.png` | All/Open/Done with one note ticked done |
| `popup.png` | the extension popup: status, session report, export/import |
| `settings-appearance.png` | the accent presets and picker |
| `badge-prod.png` | the amber production-build badge |

Plus the seven already in `store/screenshots/`, copied in rather than re-shot.

## 2. Pages

Eighteen, plus `_Sidebar.md` and `_Footer.md`.

**Getting started**
1. `Home` — what it is, hero shot, three doors (tester / user / contributor)
2. `Installation` — Web Store, release zip, from source, post-install, updating
3. `Quick-Start` — first report in five steps, one image per step

**Using it**
4. `Toolbar-and-Modes` — anatomy of the pill, the four modes, the hint line, drag, collapse
5. `Selecting-Elements` — click, `C` hover, text, marquee, multi-pick; when each wins
6. `The-Composer` — what it carries, the type chips, editing, Escape order
7. `Screenshots-and-Markup` — camera, box/arrow/blur, the two delivery modes
8. `The-Annotations-Panel` — list, filter, pins, copy, `.md`, clear
9. `Triage` — types, statuses, `## Already fixed`, filters
10. `Settings` — every row, what it changes, where it applies
11. `Sessions-Export-Import` — the popup, session report, JSON round trip
12. `Keyboard-Reference` — one table, everything

**What comes out**
13. `The-Report` — anatomy line by line, the four detail levels side by side
14. `Diagnostics` — errors, failed requests, repro steps, and the two hard privacy rules

**Environments**
15. `Framework-Support` — the matrix, how each framework is read, production builds
16. `Iframes-Modals-and-Edge-Cases` — frames, `showModal()`, focus traps, the one lost case

**For contributors**
17. `Architecture` — the three worlds, the bridge, the probe protocol, module map
18. `Development` — build, test, the env vars, the two `verify-*` scripts
19. `Releasing` — the four steps, the generated changelog, the two refusals
20. `Troubleshooting` — including Enhanced Safe Browsing, and unpacked-install nags

## 3. Rules the pages follow

- Every claim traceable to code or to `docs/`. Numbers read out of the source.
- Cross-link with `[[Page Name]]`; never link a `.md`.
- Tables for anything enumerable; prose only where the *why* matters.
- No page repeats another at length — it links instead.
- Vietnamese kept out: `TESTER-GUIDE.md` is the bilingual document and stays the one
  place a translation has to be maintained.

## 4. Publishing

The wiki git repo does not exist until one page is saved through the web UI, and there
is no API for it. So: prepare everything, then a single `git push` once the user has
made that first page. `wiki/README.md` records the sync command so the next person does
not have to work it out.
