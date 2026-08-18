# Brief — the toolbar has to say what it does

Two reports, one surface:

1. **Hovering a toolbar button should name it.** Every button but the brand one is icon-only.
   The name was in `title=`, which the browser shows about a second late, unstyled, and
   indistinguishable from a tooltip belonging to the page underneath.
2. **The hint line is cut off while inspecting.** `point` mode's hint —
   `Click an element · ⌘/Ctrl+drag across several · C captures hover · 2 text · 3 area` — ran
   past its 340px ceiling and off the right edge of the screen, losing `2 text · 3 area`:
   precisely the part the line exists to advertise (`toolbar.ts` records that mode `area` went
   unused for three releases for want of exactly this).

## Scope

- Toolbar buttons show the overlay's own tooltip, on hover **and** on focus, immediately.
- The name moves to `aria-label` — better for assistive tech on an icon-only button than
  `title` was, and it keeps a name for the e2e locators to match on.
- The hint line stays one line and stays on screen.

Out of scope: the composer's and panel's buttons, which still use `title=`. They carry labels
next to most controls and were not what was reported.
