# Chrome Web Store assets

```bash
SENANNOTATE_PLAYWRIGHT_DIR=… npm run assets     # → store/out/
```

`store/out/` is generated and gitignored. The sources are here: `demo.html` is the app the
screenshots are taken of, `tiles.html` the two promo tiles, `report.html` the frame the
copied report is rendered into.

## What to upload where

| Listing field | File | Size |
|---|---|---|
| Store icon | `store-icon-128.png` | 128×128 |
| Screenshots | `screenshot-1-inspect.jpg` … `screenshot-5-report.jpg` | 1280×800 |
| Small promo tile | `promo-small-440.jpg` | 440×280 |
| Marquee promo tile | `promo-marquee-1400.jpg` | 1400×560 |

JPEG for the screenshots and tiles, which the form requires to be free of an alpha channel —
JPEG cannot carry one, so there is nothing to get wrong. The icon stays PNG because it needs
transparency, and is padded to 96×96 inside its 128×128 canvas as the guidelines ask; the
manifest icon fills more of its canvas on purpose, because it has to survive 16px in the
toolbar.

## Why they are generated rather than drawn

The screenshots are photographs of the built extension driven against `demo.html`, so the
source paths, component chains, diagnostics and the report text are all real output. A
listing made of mockups drifts from the product silently; this one cannot, and
`report-sample.md` in the output is the exact text the report screenshot shows.

`demo.html` mirrors what `vite-plugin-vue-tracer` writes at runtime — the same shape the test
fixtures use — so the `file:line:column` in the screenshots is resolved by the real detector
rather than typed into a caption. It also makes one failing request and logs one error on
load, so the "what was captured" panel and the report's diagnostics sections have something
true to show.

The script asserts on the hover label before shooting, because a stale bounding box lands the
hover on a neighbouring element and the mistake is only visible by eye — which is exactly how
the first attempt produced a label sitting across the revenue figure.
