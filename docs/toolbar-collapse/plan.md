# Plan

Test first: the e2e scenario goes in before the feature, and is expected to fail on
the missing `.tool--collapse` locator.

1. **`test/e2e.mjs` — a "Collapse" scenario**, last in the run so the settings write
   cannot disturb earlier scenarios, and restoring the expanded state at the end so
   the profile is left clean. Asserts, on `marquee.html` (no stored annotations):
   - collapsing hides the brand button and the hint line,
   - `.toolbar` stays visible and the handle stays clickable,
   - the handle is marked while inspect mode is on (`data-inspecting`),
   - annotating still works while collapsed,
   - the collapsed state survives a reload,
   - `h` expands it again with inspect mode off — which is what proves the key is
     handled above the `!active` guard.

2. **`src/shared/types.ts`** — `toolbarCollapsed: boolean` on `Settings`,
   `false` in `DEFAULT_SETTINGS`.

3. **`src/content/ui/toolbar.ts`**
   - `collapsed: boolean` on `ToolbarState`, `onToggleCollapse()` on
     `ToolbarCallbacks`.
   - A `.tool.tool--collapse` button at the tail of the pill carrying *both* icons —
     `chevron` (expanded) and `s` (collapsed) — with CSS choosing which shows, so
     `update()` never rebuilds SVG nodes.
   - `update()` writes `data-collapsed` and `data-inspecting` on `.toolbar-dock`,
     `aria-pressed` + `aria-expanded` on the button, and swaps its `title` between
     "Collapse toolbar (H)" and "Show toolbar (H)".

4. **`src/content/ui/styles.css`**
   - `.toolbar-dock[data-collapsed="true"] .toolbar > :not(.tool--collapse)` and the
     hint line: `display: none !important` (beats the inline `display` writes).
   - Collapsed pill: circular, tighter padding.
   - `[data-collapsed="true"][data-inspecting="true"]` — accent ring on the handle, so
     "inspect is on" is still legible when the label is gone.
   - Icon visibility swap + `rotate(-90deg)` on the chevron.

5. **`src/content/index.ts`**
   - `onToggleCollapse` → flip `settings.toolbarCollapsed`, `saveSettings`, `render()`.
   - Pass `collapsed: settings.toolbarCollapsed` into `toolbar.update()`.
   - Handle `h` in the `keydown` listener *before* `if (!active) return`, after the
     typing/modifier guards.

6. **Verify** — `npm run typecheck`, `npm run build`, then the e2e suite:
   `SENANNOTATE_PLAYWRIGHT_DIR=… node test/e2e.mjs` (headed Chromium, not in CI).

7. **Document** — the `H` row in the README and TESTER-GUIDE shortcut tables, the
   changelog here, and a minor version bump to 0.5.0.
