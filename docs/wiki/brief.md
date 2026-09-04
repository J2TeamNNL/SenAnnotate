# Brief — the GitHub wiki

## What

A complete, image-led GitHub wiki for SenAnnotate, published at
`github.com/thangnm93/SenAnnotate/wiki`, with its source kept in `wiki/` in this repo.

Seventeen pages, a sidebar, and every screenshot a photograph of the built extension
rather than a mockup.

## Why

`README.md` is 649 lines and does three jobs at once: it sells the extension to someone
deciding whether to install it, teaches a tester how to use it, and explains the
three-world split to whoever has to change the code. Those readers want different things
and each currently has to scroll past the other two.

The wiki splits them. A tester lands on **Quick Start** and never sees `esbuild`; a
contributor lands on **Architecture** and never scrolls past the install steps. The
README stays the front door and the sales pitch.

A second reason is search: GitHub indexes wiki pages individually, so "senannotate
marquee" reaches the page about the marquee rather than line 190 of a long file.

## What this is not

Not a rewrite of the README, and not a replacement for `docs/`. `docs/` is the design
record — one folder per task, written during the work, including what went wrong.
The wiki is the *user- and contributor-facing* manual, written after the fact and kept
free of the archaeology.

## Done when

- `wiki/` holds every page, and `npm run wiki:assets` regenerates every screenshot.
- The wiki repo has the same content, pushed.
- No page contradicts `README.md`, `TESTER-GUIDE.md` or the code.
