# Annotation triage — context

## Storage shape, and why the new fields are optional

```
chrome.storage.local
  "senannotate:page:https://example.com/dashboard" → Annotation[]
  "senannotate:page:https://example.com/settings"  → Annotation[]
chrome.storage.sync
  "senannotate:settings" → Settings
```

`loadAnnotations()` casts whatever is at the key to `Annotation[]` with no validation
beyond `Array.isArray`. There is precedent for how to treat old data
(`shared/types.ts:201`):

> Renamed from `vue` in 0.3.0. Annotations persisted by an older build keep the old key
> and simply lose their component line when reloaded — they are per-review scratch data,
> so no migration is worth carrying.

Same call here. `kind` and `status` are optional; absent means `ui` and `open`
respectively, resolved at read time by two helpers rather than by a migration pass.

## Why the report keeps "done" notes

The instinct is to filter them out. That is wrong for the primary reader: an agent
handed "make these five changes" benefits from knowing that a sixth thing was already
fixed in this area — it is the difference between an edit and a re-edit. So done notes
render under a trailing `## Already fixed` section, out of the numbered list but not
out of the report. At `compact` they collapse to a single count line, which is what
`compact` does to everything.

## Export format

```jsonc
{
  "format": "senannotate/annotations",   // checked on import; a bare array is refused
  "version": 1,
  "exportedAt": "2026-08-13T…",
  "pages": [
    { "page": "https://example.com/dashboard", "annotations": [ … ] }
  ]
}
```

`format` and `version` exist so that import can fail loudly. Importing an arbitrary
JSON file straight into `chrome.storage.local` under our prefix would be a way to get
arbitrary strings into the panel and the report; the panel renders everything through
`textContent` (`ui/dom.ts` has no `html` counterpart, by design) so this is not an XSS
route, but a corrupt entry can still produce a broken selector that throws inside
`resolveElement`. Import therefore validates each annotation has `id`, `comment`,
`element` and `selector` as strings, and drops the ones that do not.

**Import merges, it does not replace.** Replacing would make a mis-click destroy a
review. Same-`id` collisions keep the imported copy — the user asked for that file.

## Where each control goes

| Control | Surface | Why there |
|---|---|---|
| Type chips | composer | It is a property of the note, chosen while writing it |
| Status toggle | panel entry | It is a property of the list, changed while reviewing |
| Filter | panel header | Same |
| Download `.md` | panel footer | Next to the copy button it complements |
| Export / import | popup | Cross-page by nature; the popup already lists every annotated page |

The popup is also the only surface that can offer import: it has a real document with a
`<input type="file">` that survives a click, and it already reads `chrome.storage.local`
directly (`popup/index.ts:163`).

## Colour

Marker pins currently use one accent (`#f97316`). Four types need four hues that stay
legible on both themes and next to arbitrary page content:

| Type | Hue | Note |
|---|---|---|
| bug | red `#ef4444` | the only one that should read as alarming |
| ui | orange `#f97316` | the existing accent — the default type keeps today's look |
| copy | blue `#3b82f6` | |
| question | violet `#8b5cf6` | |

Done pins drop to 45% opacity and lose their ring rather than changing hue, so "done"
never competes with "type" for the same visual channel.

## The e2e suite

`test/e2e.mjs` asserts on `.entry`, `.entry__element`, `.entry__comment`, `.count`,
`.capture-summary` and the exact text of `.toolbar-hint`. New elements inside `.entry`
must not disturb those locators — in particular `.entry__comment` must stay the node
holding exactly the comment text, so the type chip is a sibling, never a wrapper.
