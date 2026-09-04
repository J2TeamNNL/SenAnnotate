# Context

## The GitHub wiki is a separate git repository

`github.com/thangnm93/SenAnnotate.wiki.git`, with its own history. It is **not** a
branch or a folder of the main repo, and nothing in `.github/` publishes to it.

Two consequences shaped this task:

1. **It cannot be created over the API.** GitHub exposes no REST endpoint for wiki
   content, and the git repo does not exist until the first page is saved through the
   web UI. `has_wiki: true` on the repo is necessary and not sufficient — a clone of an
   uninitialised wiki fails with *"Could not read from remote repository"*, which reads
   exactly like a permissions problem and is not one.
2. **Content has to live somewhere reviewable.** A wiki repo takes commits from anyone
   with push access, has no PRs and no CI, so nothing stops a page drifting from the
   code. Keeping the source in `wiki/` here means a wiki change can be reviewed in a PR
   like anything else, and `wiki/` is what gets copied out.

## Wiki filename rules, which are not Markdown's

- One flat namespace. `Home.md` is the landing page; there are no directories in the
  page namespace (a `/` in a filename creates a page whose *title* contains a slash).
- The filename is the title and the URL: `Framework-Support.md` →
  *Framework Support* at `/wiki/Framework-Support`. Hyphens render as spaces.
- `_Sidebar.md` and `_Footer.md` are special: they render on every page.
- Links between pages take the page name, not the filename: `[[Framework Support]]` or
  `[Framework Support](Framework-Support)`. A `.md` suffix in a link 404s.
- Images resolve against the wiki repo root, so `images/inspect.jpg` works from every
  page regardless of how deep the page's URL looks.

## Where the screenshots come from

`scripts/store-assets.mjs` already drives the **built extension** against
`store/demo.html` with Playwright and photographs the result — that is where the seven
images in `store/screenshots/` came from. The listing form takes five of them; the
README uses all seven.

`scripts/wiki-assets.mjs` is modelled on it and adds the ones the wiki needs and the
listing never did: the toolbar on its own, the collapsed pill, multi-pick, text mode,
the triage filter, the popup, and the accent picker.

Both need `SENANNOTATE_PLAYWRIGHT_DIR` — the repo records no default on purpose
(`test/e2e.mjs`'s header argues why). Neither runs in CI: there is no browser there.

## Sources of truth this wiki must not contradict

| Page area | Authority |
|---|---|
| Install, keybindings, framework matrix, prod-build measurements | `README.md` |
| Tester workflow, EN + VI | `TESTER-GUIDE.md` |
| Three-world split, module rules, traps | `CLAUDE.md`, `docs/history/vuetation/context.md` |
| Per-feature reasoning | `docs/<task-slug>/` |
| Permissions and what is stored | `PRIVACY.md`, `store/listing-privacy.md` |
| Release flow | `README.md` + `docs/ci-cd/`, `docs/release-changelog/` |

Where the wiki restates a number — 900px embed ceiling, 50x50 frame floor, 500ms bridge
timeout, Chrome 111 — it was read out of the code at the time of writing, not copied
from prose.

## Enhanced Safe Browsing

Worth a Troubleshooting entry, because it is the question the extension's own author hit
first: Chrome marks an extension *"not trusted by Enhanced Safe Browsing"* until it has
been in the Web Store for roughly three months **and** the developer account has a clean
policy record. Nothing in the manifest changes it and there is no appeal. A locally
loaded unpacked copy always shows it, which is the more common reason to see it while
developing.
