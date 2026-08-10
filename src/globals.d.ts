// esbuild is configured with `loader: { ".css": "text" }`, so a CSS import is a
// plain string that we hand to `CSSStyleSheet.replaceSync`.
declare module "*.css" {
  const content: string;
  export default content;
}

/** Injected by esbuild's `define`. */
declare const __DEV__: boolean;
