# Installation

**Chrome 111 or newer.** The minimum is set by `world: "MAIN"` in the manifest, which is
the feature the whole framework-detection half of the extension depends on — see
[[Architecture]]. Chrome, Edge, Brave, Arc and Opera all work; Firefox and Safari do not,
because MV3's `world` is not implemented the same way there.

Three routes. Pick the first one unless you have a reason not to.

---

## 1. From the Chrome Web Store — for everyone

**[SenAnnotate — visual annotator](https://chromewebstore.google.com/detail/senannotate-%E2%80%94-visual-anno/nfplcbaoccfdgfpbkjiigfdpmjphbjla)**
→ **Add to Chrome**.

It updates itself from there. Nothing else on this page applies to you.

An orange **S** appears in the toolbar; pin it if Chrome hid it behind the puzzle icon.
Then open any ordinary web page — not a `chrome://` page — and press
<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.

---

## 2. From a release zip — no Node, no build

For a version newer than the Store has reviewed, or for a machine with no network access
to the Store.

1. Download `senannotate-<version>.zip` from the
   [latest release](https://github.com/thangnm93/SenAnnotate/releases/latest).
2. Unzip it into a folder you intend to **keep** — not `Downloads`, which gets swept.
   Chrome loads the extension off disk on every launch, so moving or deleting that
   folder breaks it.
3. Open `chrome://extensions`.
4. Turn on **Developer mode**, top-right.
5. **Load unpacked** → choose the unzipped folder — the one with `manifest.json`
   *directly* inside it, not its parent.

The zip also contains `TESTER-GUIDE.md`, a walkthrough in English and Vietnamese.

---

## 3. From source — for working on the extension

```bash
git clone https://github.com/thangnm93/SenAnnotate.git
cd SenAnnotate
npm install
npm run build
```

Then steps 3–5 above, choosing `dist/` instead of an unzipped folder.

Use `npm run dev` while working — esbuild rebuilds `dist/` on save, and you click ⟳ on
the extension's card to pick it up. [[Development]] covers the rest.

---

## If you installed unpacked

Neither of these applies to the Web Store install.

### Chrome will nag on every launch

> **Disable developer mode extensions**

Click **Cancel**, not Disable. Chrome shows this for any unpacked extension; nothing is
wrong. It is also why the Web Store route exists.

### Updating is manual, and has a second half people miss

1. Replace the files **in the same folder**.
2. Click ⟳ on SenAnnotate's card in `chrome://extensions`.
3. **Reload the tabs you had open.** The old content script is still running in them
   until you do — this is the step that gets skipped, and it looks exactly like the
   update not having worked.

Your notes and settings survive all of this. Chrome keeps `chrome.storage` across an
upgrade and the storage keys have not moved since 0.2.0.

---

## Optional: line numbers out of a Nuxt or Vite project

One setting, in **your app** rather than in the extension. Without it you still get the
component ancestry and the `.vue` filename — just not the line and column.

### Nuxt

`@nuxt/devtools` already bundles `vite-plugin-vue-tracer`, so there is nothing to
install. Make sure DevTools is actually on:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },   // often left off — check yours
})
```

### Plain Vite + Vue

```bash
npm i -D vite-plugin-vue-tracer
```

```ts
// vite.config.ts
import VueTracer from 'vite-plugin-vue-tracer'

export default defineConfig({
  plugins: [vue(), VueTracer()],
})
```

### Checking it worked

Hover any component-rendered element with inspect mode on. The label reads
`<ComponentName> app/components/Thing.vue:24:3` — with the `:line:column`. If it stops at
the filename, the tracer is not running.

[[Framework Support]] explains the four Vue strategies, what React and Svelte give you
instead, and what survives a production build.

---

## Uninstalling

`chrome://extensions` → **Remove**. Chrome deletes `chrome.storage.local` and
`chrome.storage.sync` with it, so **your notes go too**. If you want to keep them, use
**Export** in the popup first — see [[Sessions Export and Import]].

---

## Next

[[Quick Start]] — a complete report in five steps.
