// =============================================================================
// Clipboard
// =============================================================================
//
// `navigator.clipboard` is the right API but it is not always available: a page
// can disable it via `Permissions-Policy: clipboard-write=()`, and it rejects
// outright when the document is not focused. The `execCommand` path is the
// fallback, run inside our own shadow root so the page's selection is untouched.
// =============================================================================

import { takeFocus } from "./ui/dom";

export async function copyText(text: string, container: ShadowRoot | HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    Object.assign(textarea.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "auto",
    } satisfies Partial<CSSStyleDeclaration>);

    container.append(textarea);
    // Same trap problem as the composer: without the blur, a dialog can pull focus back
    // before `select()` and the copy silently returns false. See `takeFocus`.
    takeFocus(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
