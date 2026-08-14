# ⌘/Ctrl+drag boxes elements without leaving point mode

## What

Holding ⌘/Ctrl and dragging in `point` mode draws the same marquee `area` mode draws,
and commits on release. The mode buttons and the `3` key are untouched.

## Why

Boxing several elements meant switching mode first, then switching back. The gesture is
the common one; the mode switch was the tax on it.

## Why the modifier is not free

⌘/Ctrl already means something here: since 0.6.1 it collects one element at a time
(`docs/multi-pick/`). Click and drag therefore share a `pointerdown` and can only be
told apart afterwards, by movement — which is the whole design problem this task is.

## Decisions

- **A drag commits immediately**, as `area` mode does, rather than adding to the
  collected set. Chosen by the user over the alternative.
- **Whatever was already collected joins the box.** A plain click already commits the
  set together with the element it landed on (`commitPicked(extra)`); a drag doing
  otherwise would silently throw away work the user had gathered.
- **The threshold is `MIN_MARQUEE_SIZE`**, exported rather than reinvented. It is
  already the size below which a box selects nothing, so a second constant could only
  disagree with it — a drag that promotes but selects nothing is precisely the gap two
  numbers would open.
- **`area` mode stays**, including its button and its key. See `context.md`; the short
  version is that the repo has already been bitten once by this exact gesture being
  invisible.
