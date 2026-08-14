# Brief — hide the whole overlay

## What

A `✕` at the right end of the pill that takes the entire overlay off screen —
toolbar, panel, markers and highlights — until the page is reloaded or the popup
brings it back. Annotations are untouched. The tool glyphs grew from 16px to 17px at
the same time.

## Why

`toolbar-collapse/` gave the pill a smaller form, and `draggable-toolbar/` lets it
move out of the way. Neither covers the case where the extension should not be on
screen **at all**: demonstrating the page to someone, screenshotting the product
itself, or checking a layout against a design where a floating pill in the corner is
the difference.

Collapsing leaves a handle. The handle is the point of collapsing — it is how you get
back — so it cannot also be the answer to "nothing on screen, please".

The markers are the other half. They belong to the annotations rather than to the
toolbar, so neither collapsing nor dragging touches them, and a page with eight
numbered pins on it is not a page you can screenshot.

## Scope

In:

- A `✕` button, last in the pill, hiding the whole shadow host.
- Leaving inspect mode, closing the panel and the composer, dropping highlights.
- Return via a page reload, the popup's **Start inspecting**, or
  <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.
- Slightly larger glyphs on the tool buttons; the 32px button box is unchanged, so
  the pill does not grow.

Out:

- **Persisting the hidden state.** Deliberately session-only — see `context.md`.
- **Clearing annotations.** Hiding is a display change. `clearAll` in the panel and
  the clear-on-copy setting stay the only two things that remove notes.
- **Making the overlay hidden by default until the extension icon is clicked.** This
  was the original request and is *not* implemented here; `context.md` says why it
  was cut and what it would cost.

## Success criteria

- One press removes every trace of the extension from the page.
- The annotations are all still there after a reload.
- There is always a way back that does not require knowing a keyboard shortcut.
- While hidden, no keystroke does anything — in particular <kbd>H</kbd> must not
  silently toggle a collapse nobody can see.
