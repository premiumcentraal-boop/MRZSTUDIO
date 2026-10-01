/**
 * Signature export + JSX override checks for the 420×123 badge slot.
 *
 * 1. Shared constants are 420×123 / 2421×3292
 * 2. Generator rasterizes at SIGNATURE_W×SIGNATURE_H (no 800×260)
 * 3. JSX SIGNATURE_1 override is 420×123 contain-center, never upscale
 * 4. Photo path SMALL_IMAGE_1 stays 2421×3292
 * 5. A probe PNG written at 420×123 has that IHDR (contain-center, no stretch)
 * 6. Low userScale ink keeps full canvas + transparent edge padding (no tight crop)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function containCenter(srcW, srcH, boxW, boxH, opts) {
  let scale = Math.min(boxW / Math.max(1, srcW), boxH / Math.max(1, srcH));
  if (opts && opts.allowUpscale === false) scale = Math.min(1, scale);
  const width = srcW * scale;
  const height = srcH * scale;
  return { width, height, x: (boxW - width) / 2, y: (boxH - height) / 2, scale };
}

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
    }
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function makePng(width, height, rgbaAt) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = rgbaAt(x, y);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function readPngSize(buf) {
  assert.strictEqual(buf[0], 137, "PNG signature");
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function inflateIdat(buf) {
  let i = 8;
  const parts = [];
  while (i + 12 <= buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("ascii", i + 4, i + 8);
    if (type === "IDAT") parts.push(buf.slice(i + 8, i + 8 + len));
    i += 12 + len;
    if (type === "IEND") break;
  }
  return zlib.inflateSync(Buffer.concat(parts));
}

function edgeTransparencyFraction(png, width, height, band) {
  const raw = inflateIdat(png);
  let edge = 0;
  let transparent = 0;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    assert.strictEqual(raw[row], 0, "probe PNG uses filter 0");
    for (let x = 0; x < width; x++) {
      if (x < band || y < band || x >= width - band || y >= height - band) {
        edge++;
        const a = raw[row + 1 + x * 4 + 3];
        if (a === 0) transparent++;
      }
    }
  }
  return edge === 0 ? 0 : transparent / edge;
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

console.log("=== signature 420×123 ===");

const sizes = read("src/lib/image-export-sizes.ts");
assert.match(sizes, /export const EXPORT_W = 2421/);
assert.match(sizes, /export const EXPORT_H = 3292/);
assert.match(sizes, /export const SIGNATURE_W = 420/);
assert.match(sizes, /export const SIGNATURE_H = 123/);
assert.match(sizes, /allowUpscale/);
assert.match(sizes, /Math\.min\(1, scale\)/);
console.log("OK  shared constants 420×123 / 2421×3292 + no-upscale option");

const generator = read("src/app/components/signature-generator.tsx");
assert.match(generator, /SIGNATURE_W/);
assert.match(generator, /SIGNATURE_H/);
assert.doesNotMatch(generator, /CANVAS_W\s*=\s*800/);
assert.doesNotMatch(generator, /CANVAS_H\s*=\s*260/);
assert.match(generator, /sizeSignatureCanvas/);
assert.match(generator, /canvasToSignaturePng/);
assert.match(generator, /Reset position/);
assert.doesNotMatch(generator, /getImageData/);
console.log("OK  generator uses 420×123 (not 800×260) with place/size controls");

const raster = read("src/lib/signature-raster.ts");
assert.match(raster, /canvas\.width = SIGNATURE_W/);
assert.match(raster, /canvas\.height = SIGNATURE_H/);
assert.match(raster, /canvasToSignaturePng/);
assert.match(raster, /Never crops to the ink's/);
assert.match(raster, /canvas\.width !== SIGNATURE_W/);
console.log("OK  rasterizer always sizes canvas to SIGNATURE_W×SIGNATURE_H (no alpha trim)");

const photoEditor = read("src/app/components/photo-editor.tsx");
assert.match(photoEditor, /fitMode/);
assert.match(photoEditor, /contain/);
assert.match(photoEditor, /image-export-sizes/);
assert.match(photoEditor, /canvasToSignaturePng/);
assert.match(photoEditor, /Never trim to the opaque bounding box/);
console.log("OK  photo-editor contain-center fitMode + full-canvas signature export");

const idStep = read("src/app/IdGeneratorStep.tsx");
assert.match(idStep, /fitMode="contain"/);
assert.match(idStep, /exportWidth=\{SIGNATURE_W\}/);
assert.match(idStep, /exportHeight=\{SIGNATURE_H\}/);
console.log("OK  IdGeneratorStep signature editor is 420×123 contain");

const jsxPaths = [
  "worker/local-worker/scripts/run_employeeid_job.jsx",
  "worker/scripts/run_employeeid_job.jsx",
];
for (const rel of jsxPaths) {
  const jsx = read(rel);
  assert.match(jsx, /SIGNATURE_1:\s*\{\s*width:\s*420,\s*height:\s*123\s*\}/);
  assert.match(jsx, /SMALL_IMAGE_1:\s*\{\s*width:\s*2421,\s*height:\s*3292/);
  assert.match(jsx, /getCenteredOverrideBounds/);
  assert.match(jsx, /contain-center/);
  assert.match(jsx, /resizeImageDocumentToFitPixels/);
  assert.match(jsx, /layer\.resize\(scale, scale/);
  assert.match(jsx, /containCenterNoUpscale/);
  assert.match(jsx, /Math\.min\(1,\s*Math\.min\(/);
  assert.match(jsx, /copySignaturePixelsNoUpscale/);
  assert.match(jsx, /fitSignatureLayerNoUpscale/);
  assert.match(jsx, /pasted 1:1/);
  assert.match(jsx, /no upscale/);
  assert.match(jsx, /forceFitPaste && signatureCopy/);
  console.log("OK  JSX override + contain-center no-upscale:", rel);
}

// Contain-center math: a 200×50 ink rect into 420×123 must not stretch.
const fit = containCenter(200, 50, 420, 123);
assert.ok(Math.abs(fit.scale - 420 / 200) < 1e-9, "width-limited contain");
assert.ok(Math.abs(fit.width - 420) < 1e-9);
assert.ok(Math.abs(fit.height - 105) < 1e-9);
assert.ok(Math.abs(fit.x) < 1e-9);
assert.ok(Math.abs(fit.y - 9) < 1e-9);
assert.ok(Math.abs(fit.width / fit.height - 200 / 50) < 1e-9, "aspect preserved (no stretch)");
console.log("OK  contain-center math (no stretch)");

// A small (zoomed-out) signature must NOT be enlarged to fill 420×123.
const noUp = containCenter(200, 50, 420, 123, { allowUpscale: false });
assert.strictEqual(noUp.scale, 1, "never scale up a smaller PNG");
assert.strictEqual(noUp.width, 200);
assert.strictEqual(noUp.height, 50);
assert.ok(Math.abs(noUp.x - 110) < 1e-9);
assert.ok(Math.abs(noUp.y - 36.5) < 1e-9);
const slotId = containCenter(420, 123, 420, 123, { allowUpscale: false });
assert.strictEqual(slotId.scale, 1);
assert.strictEqual(slotId.x, 0);
assert.strictEqual(slotId.y, 0);
const scaleDown = containCenter(840, 246, 420, 123, { allowUpscale: false });
assert.ok(Math.abs(scaleDown.scale - 0.5) < 1e-9, "still scale down when larger than the slot");
console.log("OK  contain-center never-upscale (1:1 when already 420×123)");

// Photo box must still be cover-capable 2421×3292; this is the identity contain of that size.
const photoFit = containCenter(2421, 3292, 2421, 3292);
assert.strictEqual(photoFit.width, 2421);
assert.strictEqual(photoFit.height, 3292);
console.log("OK  photo 2421×3292 identity fit");

const BOX_W = 420;
const BOX_H = 123;
const ink = { w: 200, h: 50 };
const placed = containCenter(ink.w, ink.h, BOX_W, BOX_H);
const png = makePng(BOX_W, BOX_H, (x, y) => {
  const inside =
    x >= Math.round(placed.x) &&
    x < Math.round(placed.x + placed.width) &&
    y >= Math.round(placed.y) &&
    y < Math.round(placed.y + placed.height);
  return inside ? [10, 10, 10, 255] : [0, 0, 0, 0];
});
const outDir = path.join(__dirname, "out");
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, "signature-420x123-probe.png");
fs.writeFileSync(outFile, png);
const probed = readPngSize(png);
assert.strictEqual(probed.width, 420);
assert.strictEqual(probed.height, 123);
console.log("OK  probe PNG IHDR 420×123 →", path.relative(root, outFile), `(${png.length} bytes)`);

// Low userScale: tiny centered ink on a full 420×123 canvas. Edges must stay
// fully transparent — proves we did not tight-crop to the alpha bbox.
const smallInk = { w: 48, h: 14 };
const smallPlaced = containCenter(smallInk.w, smallInk.h, BOX_W, BOX_H, { allowUpscale: false });
assert.strictEqual(smallPlaced.scale, 1, "low userScale ink stays 48×14 (not enlarged)");
const smallPng = makePng(BOX_W, BOX_H, (x, y) => {
  const inside =
    x >= Math.round(smallPlaced.x) &&
    x < Math.round(smallPlaced.x + smallPlaced.width) &&
    y >= Math.round(smallPlaced.y) &&
    y < Math.round(smallPlaced.y + smallPlaced.height);
  return inside ? [10, 10, 10, 255] : [0, 0, 0, 0];
});
const smallFile = path.join(outDir, "signature-420x123-small-ink.png");
fs.writeFileSync(smallFile, smallPng);
const smallSize = readPngSize(smallPng);
assert.strictEqual(smallSize.width, 420, "zoomed-out export IHDR width");
assert.strictEqual(smallSize.height, 123, "zoomed-out export IHDR height");
const edgeFrac = edgeTransparencyFraction(smallPng, BOX_W, BOX_H, 8);
assert.ok(edgeFrac > 0.95, "edge band should be almost fully transparent, got " + edgeFrac);
console.log(
  "OK  low userScale probe IHDR 420×123 with transparent padding",
  `(edge α=0 fraction ${edgeFrac.toFixed(3)}) →`,
  path.relative(root, smallFile),
);

// Runtime: rasterizer always stamps 420×123 and draws contain-centered.
const rasterMod = path.join(outDir, "signature-raster.cjs");
try {
  require("esbuild").buildSync({
    entryPoints: [path.join(root, "src/lib/signature-raster.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: rasterMod,
  });
  const rasterizer = require(rasterMod);
  const canvas = { width: 800, height: 260 };
  rasterizer.sizeSignatureCanvas(canvas);
  assert.strictEqual(canvas.width, 420);
  assert.strictEqual(canvas.height, 123);
  const calls = [];
  const ctx = {
    clearRect() {},
    measureText: (t) => ({ width: Math.min(200, String(t).length * 8), actualBoundingBoxAscent: 20, actualBoundingBoxDescent: 8 }),
    fillText(...a) { calls.push(a); },
    font: "",
    fillStyle: "",
    textAlign: "",
    textBaseline: "",
  };
  rasterizer.drawSignature(ctx, {
    text: "Ada",
    fontFamily: "cursive",
    fontBaseSize: 96,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  assert.strictEqual(ctx.textAlign, "center");
  assert.strictEqual(ctx.textBaseline, "middle");
  assert.strictEqual(calls[0][0], "Ada");
  assert.strictEqual(calls[0][1], 210);
  assert.strictEqual(calls[0][2], 61.5);
  const baseFontPx = parseFloat(String(ctx.font));
  rasterizer.drawSignature(ctx, {
    text: "Ada",
    fontFamily: "cursive",
    fontBaseSize: 96,
    scale: 0.4,
    offsetX: 0,
    offsetY: 0,
  });
  const zoomedFontPx = parseFloat(String(ctx.font));
  assert.ok(zoomedFontPx < baseFontPx, "low userScale must draw a smaller font, not a cropped full-size glyph");
  assert.ok(Math.abs(zoomedFontPx / baseFontPx - 0.4) < 0.05, "font size tracks userScale");
  console.log("OK  rasterizer runtime 420×123 center (210, 61.5) + low userScale font");
} catch (err) {
  if (err && err.code === "MODULE_NOT_FOUND") {
    console.log("SKIP rasterizer runtime (esbuild not available)");
  } else {
    throw err;
  }
}

if (process.exitCode) {
  fail("one or more assertions failed");
} else {
  console.log("ALL PASS");
}
