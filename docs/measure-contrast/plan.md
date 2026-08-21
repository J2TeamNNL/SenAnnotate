# Plan — strategy

Engine, then report, then overlay, then capture — the same ordering argument as
[`docs/measure-core/plan.md`](../measure-core/plan.md), and for the same reasons: the
arithmetic is testable without a browser, and settling the stored shape first stops the
overlay inventing a second one.

1. `parseRgb` out of `toHex`, then `contrastRatio` and the thresholds — unit tests only.
2. `ContrastReport` on `StyleSummary` and on `Measurements`; the report line.
3. The readout row.
4. Capture into the annotation, describing the same element `**Box:**` describes.
5. Fixture pair — one failing, one passing — and the e2e.
