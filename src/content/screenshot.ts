// =============================================================================
// Element screenshots
// =============================================================================
//
// The service worker photographs the whole viewport (only it can call
// `captureVisibleTab`); everything after that happens here, because an MV3
// service worker has no canvas and no `URL.createObjectURL`.
// =============================================================================

/** Padding around the element, so the crop has a little context. */
const BLEED = 8;

export async function cropAndDownload(
  viewportPng: string,
  rect: { left: number; top: number; width: number; height: number },
  filename: string,
): Promise<boolean> {
  try {
    const image = await loadImage(viewportPng);

    // captureVisibleTab returns a device-pixel bitmap, but getBoundingClientRect
    // speaks CSS pixels. Derive the ratio from the image rather than trusting
    // devicePixelRatio — they disagree when the page is zoomed.
    const ratio = image.width / window.innerWidth;

    const left = Math.max(0, Math.round((rect.left - BLEED) * ratio));
    const top = Math.max(0, Math.round((rect.top - BLEED) * ratio));
    const width = Math.min(image.width - left, Math.round((rect.width + BLEED * 2) * ratio));
    const height = Math.min(image.height - top, Math.round((rect.height + BLEED * 2) * ratio));

    if (width <= 0 || height <= 0) return false;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return false;
    context.drawImage(image, left, top, width, height, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return false;

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // Revoking immediately can cancel the download in some Chrome builds.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);

    return true;
  } catch {
    return false;
  }
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not decode the captured tab"));
    image.src = source;
  });
}
