# The Composer

The card that opens when you pick something. Everything above the text box was captured
for you; the text box is the only part you fill in.

![The composer, showing element, source, component chain, props and the type chips](images/composer.jpg)

---

## The rows

Which rows appear depends on what the page actually offers. A page with no framework
shows **Element** and nothing else, and that is a complete, useful note.

| Row | What it is |
|---|---|
| **Element** | The element's own name — `div.stat-value`, `button "New order"`. Built from the tag, a stable class, and the accessible name when there is one. |
| **Source** | The file that rendered it, as precisely as the framework records: `app/components/StatCard.vue:8:3`, or just the filename, or absent. |
| **Component** | The component ancestry: `<App> <StatCard>`. |
| **Props** | The owning component's props — names and values. |
| **Text** | The selected range, in text mode only. |
| **Elements** | The count, when the note covers more than one. |

**Element** comes from the DOM alone. It needs no framework, no bridge round trip, and no
build plugin, which is why it is the row that is always there. The other three come from
the framework's own metadata — see [[Framework Support]] for what each one records.

### Props are names and values, with one rule

Values that look like credentials are redacted before they are ever stored. A prop called
`apiKey`, `token`, `password` or `secret` reports its name and `[redacted]`, never the
value. This is a privacy guarantee with a test behind it, not a best effort — see
[[Diagnostics and Privacy]].

Turn the whole row off with *Include component props* in [[Settings]] if your props carry
things you would rather not paste into a ticket at all.

---

## The type chips

**UI · Bug · Copy · Question.** One per note, and it does two things:

- it reaches the report heading — `### 1. [bug] button "Save"` — so an agent reading the
  report knows whether you are describing a defect or asking a question;
- it colours the pin on the page and in the panel.

Pick the one that makes the sentence make sense. There is no configuration and no fifth
type. See [[Triage]].

---

## Writing the note

The text box is an ordinary textarea: multi-line, wraps, and takes as much as you want to
write.

| | |
|---|---|
| Save | **Add note**, or <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> |
| Attach a screenshot | the **camera** button — see [[Screenshots and Markup]] |
| Cancel | <kbd>Esc</kbd>, or the **×** |

An empty note is refused — a note with no sentence is a pin with no content, and the
report has nothing to say about it.

### What to actually write

The report already names the element, the file and the component. It cannot know what you
*want*. So the sentence is worth spending on:

| Instead of | Write |
|---|---|
| "this is broken" | "Submitting with an empty email shows no error and the form silently resets." |
| "wrong colour" | "Should use the danger token, not the warning one — it is a destructive action." |
| "move it" | "Move above the divider so it is the first thing in the group." |

---

## Editing a note

Click its pin on the page, or its entry in the panel. The composer reopens with the text,
the type and any screenshot as you left them, and **Add note** reads **Save**.

The element is re-resolved from the stored selector when you reopen. If the page has been
rebuilt since — an SPA route change, a re-render that replaced the node — the note keeps
everything it recorded and simply cannot re-highlight the element. Nothing is lost.

---

## Where it opens, and what it avoids

The card is positioned against the element and flips above it rather than falling off the
bottom of the viewport. It repositions when its own height changes — attaching an image,
or opening a section — rather than growing off-screen.

Two page behaviours it deliberately survives:

- **`showModal()` dialogs**, which Chrome paints in its *top layer* above every z-index
  and which make everything outside them inert;
- **focus traps** — Reka UI, Radix and Headless UI all pull focus back when it leaves the
  dialog, which silently swallowed everything typed into the composer until 0.8.1.

One case is left and it is unavoidable: a dialog that closes when focus leaves it will
close when the composer opens, because typing requires focus. The annotation is captured
*before* the composer appears, so the element, its selector, its component chain and the
report are complete either way. See [[Iframes Modals and Edge Cases]].
