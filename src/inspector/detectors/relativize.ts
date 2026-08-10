// =============================================================================
// Absolute build paths → greppable repo-relative ones
// =============================================================================
//
// Shared by every detector: Vue's `__file`, Svelte's `__svelte_meta.loc.file` and
// React's `_debugSource.fileName` all hand over absolute paths from the build machine,
// which are useless to an agent reading the repo.
// =============================================================================

const PATH_MARKERS = [
  "/src/",
  "/app/",
  "/pages/",
  "/components/",
  "/layouts/",
  "/views/",
  "/composables/",
  "/plugins/",
  "/modules/",
  "/routes/", // SvelteKit
  "/lib/", //    SvelteKit's $lib
];

/**
 * Turn a compiler-supplied absolute path into something you can `grep` for.
 *
 *   /build/app/src/components/BaseButton.vue?vue&type=script
 *     → src/components/BaseButton.vue
 */
export function relativizeFile(file: string): string {
  const clean = file.split("?")[0].replace(/\\/g, "/");

  // Already relative (vue-tracer hands these over) — leave it alone. Running the
  // marker/tail logic below on a short relative path would truncate it.
  if (!clean.startsWith("/") && !/^[a-zA-Z]:\//.test(clean)) return clean;

  for (const marker of PATH_MARKERS) {
    const at = clean.indexOf(marker);
    if (at !== -1) return clean.slice(at + 1);
  }

  // Unknown layout: the trailing few segments are still a usable grep target.
  const segments = clean.split("/").filter(Boolean);
  return segments.slice(-3).join("/");
}

/** Filename without directory or framework extension — used to name a component. */
export function componentNameFromFile(file: string): string {
  const relative = relativizeFile(file);
  const last = relative.split("/").pop() ?? relative;
  return last.replace(/\.(vue|svelte|tsx?|jsx?)$/, "");
}
