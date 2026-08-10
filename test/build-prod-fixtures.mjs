// =============================================================================
// Build the production fixtures
// =============================================================================
//
// Answers, by measurement rather than by argument, the question "what does the
// extension actually get on a production build?"
//
// Three variants of the SAME app, all minified production builds:
//
//   stock     what you deploy today
//   devtools  + __VUE_PROD_DEVTOOLS__: true
//   tracer    + __VUE_PROD_DEVTOOLS__ and vite-plugin-vue-tracer enabled in prod
//
// vite, @vitejs/plugin-vue and vite-plugin-vue-tracer are resolved out of the
// monorepo rather than added as dependencies here — same approach as Playwright.
// =============================================================================

import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "prod-app");
const OUT_ROOT = join(HERE, "fixtures", "prod");

const DONOR = resolve(HERE, "../../../storefront_v5");
const STORE = join(DONOR, "node_modules/.pnpm");

/** Resolve a package out of the donor project's pnpm store. */
function fromStore(prefix, subpath) {
  if (!existsSync(STORE)) {
    throw new Error(`Cannot find ${STORE}. Install storefront_v5's dependencies first.`);
  }
  const dir = readdirSync(STORE).find((entry) => entry.startsWith(prefix));
  if (!dir) throw new Error(`No package matching "${prefix}" in ${STORE}`);
  return join(STORE, dir, "node_modules", subpath);
}

/** vite 7 and its plugins are ESM-only, so `require` is not an option. */
async function importFromStore(prefix, subpath) {
  const entry = fromStore(prefix, subpath);
  const module = await import(pathToFileURL(entry).href);
  return module?.default ?? module;
}

const VARIANTS = [
  { name: "stock", devtools: false, tracer: false },
  { name: "devtools", devtools: true, tracer: false },
  { name: "tracer", devtools: true, tracer: true },
];

export async function buildProdFixtures() {
  const vite = await importFromStore("vite@", "vite/dist/node/index.js");
  const vuePlugin = await importFromStore("@vitejs+plugin-vue@", "@vitejs/plugin-vue/dist/index.mjs");
  const tracerPlugin = await importFromStore(
    "vite-plugin-vue-tracer@",
    "vite-plugin-vue-tracer/dist/index.mjs",
  );

  // The fixture app has no node_modules of its own, so `import 'vue'` is pointed
  // at the donor's copy explicitly.
  const vueEntry = fromStore("vue@3", "vue/dist/vue.runtime.esm-bundler.js");

  for (const variant of VARIANTS) {
    const plugins = [vuePlugin()];
    if (variant.tracer) plugins.push(tracerPlugin({ enabled: true }));

    await vite.build({
      root: APP,
      logLevel: "error",
      // Relative asset URLs, so each variant can be served from its own subfolder.
      base: "./",
      plugins,
      resolve: { alias: { vue: vueEntry } },
      define: {
        // Vue reads this before writing __vnode / __vueParentComponent onto DOM
        // nodes — see runtime-core.esm-bundler.js.
        __VUE_PROD_DEVTOOLS__: JSON.stringify(variant.devtools),
        __VUE_OPTIONS_API__: "true",
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
      },
      build: {
        outDir: join(OUT_ROOT, variant.name),
        emptyOutDir: true,
        minify: "esbuild",
        // vite-plugin-vue-tracer maps generated positions back to the .vue source
        // through the upstream sourcemap. With `sourcemap: false` it finds no map
        // and silently transforms nothing — the plugin appears installed and does
        // absolutely nothing. `hidden` generates the maps it needs without adding
        // a `//# sourceMappingURL=` comment to the shipped bundle.
        sourcemap: variant.tracer ? "hidden" : false,
        rollupOptions: { output: { entryFileNames: "app.js", assetFileNames: "app.[ext]" } },
      },
    });
  }

  return VARIANTS.map((variant) => variant.name);
}

// Allow running standalone: `node test/build-prod-fixtures.mjs`
if (import.meta.url === `file://${process.argv[1]}`) {
  const names = await buildProdFixtures();
  console.log(`built production fixtures: ${names.join(", ")}`);
}
