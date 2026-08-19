# Triage

A review is not a list of complaints — it is a list you work through. Two fields make
that possible: a **type** you pick when writing the note, and a **status** you tick off
once it is handled.

---

## Type

Chosen in the composer. Four, and no configuration.

| Type | For |
|---|---|
| **Bug** | It does not work. |
| **UI** | It works and looks wrong. |
| **Copy** | The words are wrong. |
| **Question** | You are not sure it is wrong, and want an answer. |

The type does two visible things:

1. **It reaches the report heading** — `### 1. [bug] button "Save"`. An agent reading the
   report can tell a defect from a question without parsing your sentence.
2. **It colours the pin**, on the page and in the panel, so a screen with twelve notes
   can be read at a glance.

**Question** is the one people under-use. A note that asks *"is this meant to be
disabled for read-only users?"* is often worth more than a guess dressed as a bug
report, and it costs a reviewer one line to answer.

---

## Status

Tick the box on a panel entry to mark it **done**. The entry greys and strikes through
rather than disappearing.

![The panel: one note ticked done, struck through, above two open ones](images/panel-triage.png)

### Done notes stay in the report

They move out of the numbered list into their own section:

```markdown
### 1. [ui] button "New order"
**Feedback:** Make this the primary action and move it above the divider.

### 2. [bug] span.filter-chip
**Feedback:** This filter resets itself when the table reloads.

## Already fixed

- [copy] td "Priya Raman" — Customer names should link through to the customer record.
```

They are kept rather than deleted because **"this was already handled" is context worth
having**. It stops the same thing being reported twice on the next pass, and it tells
whoever reads the report what has already moved.

---

## The filter

`All · Open · Done`, above the list.

| | Shows |
|---|---|
| **All** | Everything. |
| **Open** | What is left to do. |
| **Done** | What has been handled. |

The filter is a view over the list, not over the report — **Copy report** always covers
every note on the page, whichever filter is showing.

---

## A workflow that works

1. **Sweep the page.** Do not triage while you are looking; just annotate everything that
   catches your eye. Switching between *finding* and *judging* is what makes a review
   take twice as long.
2. **Open the panel and set the filter to Open.**
3. **Work down the list.** Click an entry to jump to the element and check it again with
   fresh eyes. Some will turn out to be fine — tick them done, or delete them.
4. **Copy the report** and hand it over.
5. **Come back later.** The notes are still there, keyed to the page. Tick off what has
   been fixed and re-copy; the report now leads with what is left and carries the rest
   under *Already fixed*.

---

## Backing a review up

Notes are only in `chrome.storage.local` until you move them. Before a **Clear all**, or
when handing a review to someone else, or when moving between machines, use **Export** in
the popup — see [[Sessions Export and Import]].

Import **merges**; it never replaces what is already there.
