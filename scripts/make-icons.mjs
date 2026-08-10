// =============================================================================
// Dependency-free PNG icon generator
// =============================================================================
//
// Chrome rejects SVG in `manifest.icons`, so the SenAnnotate mark is rasterised here
// with a hand-rolled PNG encoder (zlib is the only thing we need, and it ships with Node).
//
// Run: node scripts/make-icons.mjs
// =============================================================================

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../static/icons");
const SIZES = [16, 32, 48, 128];

const SUPERSAMPLE = 4;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------
//
// The SenAnnotate mark: an "S" monogram in a rounded-square badge. Everything is
// expressed in a unit square (0..1) so one set of predicates renders at every size.
// A badge rather than a bare glyph because a hairline S on transparent disappears at
// 16px against both light and dark browser chrome.

const ORANGE = [249, 115, 22, 255]; // #f97316
const INK = [67, 20, 7, 255]; //      #431407

const MARGIN = 0.06; // clear space around the badge
const CORNER = 0.24; // badge corner radius, as a fraction of the icon size

const GLYPH_H = 0.56; //          "S" height
const ARC_R = GLYPH_H / 4; //     two tangent circles stacked make that height
const STROKE = GLYPH_H * 0.19; // pen width

/** Rounded rect: clamp into the corner-centre rect, then one radius check covers all cases. */
function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Degrees from +x, increasing downward — image coordinates, not maths coordinates. */
function angleAt(x, y, cx, cy) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

function onArc(x, y, cx, cy, keep) {
  if (Math.abs(Math.hypot(x - cx, y - cy) - ARC_R) > STROKE / 2) return false;
  return keep(angleAt(x, y, cx, cy));
}

function nearPoint(x, y, px, py) {
  return Math.hypot(x - px, y - py) <= STROKE / 2;
}

/**
 * The "S" as two externally tangent arcs, each sweeping 240°:
 *
 *   upper bowl  from the top-right terminal (-30°), anticlockwise over the top and
 *               down the left side, to the tangent point at +90°
 *   lower bowl  from the tangent point (-90°), clockwise round the right side and
 *               along the bottom, to the bottom-left terminal at +150°
 *
 * They meet exactly at the centre: two circles of radius r whose centres are 2r
 * apart touch midway.
 */
function inGlyph(x, y) {
  const upperY = 0.5 - ARC_R;
  const lowerY = 0.5 + ARC_R;

  if (onArc(x, y, 0.5, upperY, (deg) => deg <= -30 || deg >= 90)) return true;
  if (onArc(x, y, 0.5, lowerY, (deg) => deg >= -90 && deg <= 150)) return true;

  // Round caps on the two visible terminals.
  const rad = Math.PI / 180;
  const upperTip = [0.5 + ARC_R * Math.cos(-30 * rad), upperY + ARC_R * Math.sin(-30 * rad)];
  const lowerTip = [0.5 + ARC_R * Math.cos(150 * rad), lowerY + ARC_R * Math.sin(150 * rad)];
  return nearPoint(x, y, upperTip[0], upperTip[1]) || nearPoint(x, y, lowerTip[0], lowerTip[1]);
}

// Painted in order, back to front.
const LAYERS = [
  {
    color: ORANGE,
    hit: (x, y) => inRoundedRect(x, y, MARGIN, MARGIN, 1 - MARGIN, 1 - MARGIN, CORNER),
  },
  { color: INK, hit: inGlyph },
];

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

  const step = 1 / SUPERSAMPLE;
  const samplesPerPixel = SUPERSAMPLE * SUPERSAMPLE;
  const hits = new Array(LAYERS.length).fill(0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      hits.fill(0);

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const ux = (x + (sx + 0.5) * step) / size;
          const uy = (y + (sy + 0.5) * step) / size;
          for (let i = 0; i < LAYERS.length; i++) {
            if (LAYERS[i].hit(ux, uy)) hits[i]++;
          }
        }
      }

      let painted = false;
      for (const count of hits) {
        if (count > 0) {
          painted = true;
          break;
        }
      }
      if (!painted) continue;

      const offset = (y * size + x) * 4;
      for (let i = 0; i < LAYERS.length; i++) {
        if (hits[i] > 0) composite(rgba, offset, LAYERS[i].color, hits[i] / samplesPerPixel);
      }
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
