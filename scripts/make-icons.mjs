// =============================================================================
// Dependency-free PNG icon generator
// =============================================================================
//
// Chrome rejects SVG in `manifest.icons`, so the Vue mark is rasterised here with
// a hand-rolled PNG encoder (zlib is the only thing we need, and it ships with Node).
//
// Run: node scripts/make-icons.mjs
// =============================================================================

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../static/icons");
const SIZES = [16, 32, 48, 128];

// The Vue mark, in its native 128 x 110.85 coordinate space.
const GREEN = [65, 184, 131, 255]; // #41B883
const NAVY = [53, 73, 94, 255]; //  #35495E

const OUTER = [
  [0, 0],
  [25.6, 0],
  [64, 66.5],
  [102.4, 0],
  [128, 0],
  [64, 110.85],
];
const INNER = [
  [25.6, 0],
  [51.2, 0],
  [64, 22.2],
  [76.8, 0],
  [102.4, 0],
  [64, 66.5],
];

const LOGO_W = 128;
const LOGO_H = 110.85;
const PADDING_RATIO = 0.09; // breathing room so the mark isn't flush to the edge
const SUPERSAMPLE = 4;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Ray-casting point-in-polygon. */
function inside(polygon, x, y) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/** Source-over composite of a straight-alpha colour onto a straight-alpha pixel. */
function composite(dst, offset, color, alpha) {
  if (alpha <= 0) return;
  const sa = alpha;
  const da = dst[offset + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return;
  for (let c = 0; c < 3; c++) {
    const src = color[c] / 255;
    const bg = dst[offset + c] / 255;
    dst[offset + c] = Math.round(((src * sa + bg * da * (1 - sa)) / outA) * 255);
  }
  dst[offset + 3] = Math.round(outA * 255);
}

function renderIcon(size) {
  const rgba = new Uint8Array(size * size * 4); // transparent

  const pad = size * PADDING_RATIO;
  const scale = Math.min((size - pad * 2) / LOGO_W, (size - pad * 2) / LOGO_H);
  const drawW = LOGO_W * scale;
  const drawH = LOGO_H * scale;
  const originX = (size - drawW) / 2;
  const originY = (size - drawH) / 2;

  // Map a device pixel coordinate back into logo space.
  const toLogo = (px, py) => [(px - originX) / scale, (py - originY) / scale];

  const step = 1 / SUPERSAMPLE;
  const samplesPerPixel = SUPERSAMPLE * SUPERSAMPLE;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let outerHits = 0;
      let innerHits = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const [lx, ly] = toLogo(x + (sx + 0.5) * step, y + (sy + 0.5) * step);
          if (inside(OUTER, lx, ly)) outerHits++;
          if (inside(INNER, lx, ly)) innerHits++;
        }
      }

      if (outerHits === 0 && innerHits === 0) continue;
      const offset = (y * size + x) * 4;
      composite(rgba, offset, GREEN, outerHits / samplesPerPixel);
      composite(rgba, offset, NAVY, innerHits / samplesPerPixel);
    }
  }

  return rgba;
}

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);
  return Buffer.concat([length, typed, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with filter type 0 (None).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = encodePng(renderIcon(size), size);
  writeFileSync(resolve(OUT_DIR, `icon-${size}.png`), png);
  console.log(`icons  icon-${size}.png  ${png.length} bytes`);
}
