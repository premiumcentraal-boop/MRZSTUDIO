/**
 * Print-margin helper + Incoming wiring checks.
 *
 * 1. mm↔px at 300 DPI, clamp 0–5 step 0.1
 * 2. padded size = source + 2×margin; 0 mm adds nothing
 * 3. PNG pHYs parse (synthetic 300 DPI + a real badge if present)
 * 4. padImageWhiteBorder(0) returns the same blob (no re-encode)
 * 5. Incoming UI strings / helper usage; mockups are not padded
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const assert = require("assert");

const root = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? (c >>> 1) ^ 0xedb88320 : (c >>> 1);
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

function makePng(width, height, { dpi } = {}) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 4;
      raw[i] = 20;
      raw[i + 1] = 30;
      raw[i + 2] = 40;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
  ];
  if (dpi) {
    const phys = Buffer.alloc(9);
    const ppum = Math.round((dpi * 1000) / 25.4);
    phys.writeUInt32BE(ppum, 0);
    phys.writeUInt32BE(ppum, 4);
    phys[8] = 1;
    parts.push(chunk("pHYs", phys));
  }
  parts.push(chunk("IDAT", zlib.deflateSync(raw)));
  parts.push(chunk("IEND", Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function readPngDpi(bytes) {
  if (bytes.length < 24) return null;
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(4) !== 0x0d0a1a0a) {
    return null;
  }
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length < 0 || offset + 12 + length > bytes.length) return null;
    const type = bytes.slice(offset + 4, offset + 8).toString("ascii");
    if (type === "pHYs" && length >= 9) {
      const ppux = bytes.readUInt32BE(offset + 8);
      const unit = bytes[offset + 16];
      if (unit !== 1 || ppux <= 0) return null;
      const dpi = (ppux * 25.4) / 1000;
      if (dpi < 1 || dpi > 10000) return null;
      const rounded = Math.round(dpi);
      return Math.abs(dpi - rounded) < 0.05 ? rounded : dpi;
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return null;
}

function clampPrintMarginMm(mm) {
  if (!Number.isFinite(mm)) return 0;
  const stepped = Math.round(mm / 0.1) * 0.1;
  const clamped = Math.min(5, Math.max(0, stepped));
  return Math.round(clamped * 10) / 10;
}

function mmToPx(mm, dpi = 300) {
  return (mm * dpi) / 25.4;
}

function marginPxFromMm(mm, dpi = 300) {
  return Math.max(0, Math.round(mmToPx(clampPrintMarginMm(mm), dpi)));
}

function paddedSize(srcW, srcH, marginPx) {
  const m = Math.max(0, Math.round(marginPx));
  return { width: srcW + 2 * m, height: srcH + 2 * m, marginPx: m };
}

function containPercent(innerAspect, outerAspect) {
  if (!(innerAspect > 0) || !(outerAspect > 0)) return { widthPct: 100, heightPct: 100 };
  return {
    widthPct: Math.min(100, (innerAspect / outerAspect) * 100),
    heightPct: Math.min(100, (outerAspect / innerAspect) * 100),
  };
}

const helperSrc = read("src/lib/print-margin.ts");
const incomingSrc = read("src/app/components/incoming-items.tsx");

assert.match(helperSrc, /mrz\.printMarginMm/);
assert.match(helperSrc, /export async function padImageWhiteBorder/);
assert.match(helperSrc, /export async function padImageWhiteBorderFromMm/);
assert.match(helperSrc, /DEFAULT_PRINT_DPI = 300/);
assert.match(helperSrc, /PRINT_MARGIN_MAX_MM = 5/);
assert.match(helperSrc, /PRINT_MARGIN_STEP_MM = 0\.1/);
assert.match(helperSrc, /if \(m === 0\) return blob/);
console.log("OK  helper exports + 0 mm short-circuit");

assert.match(incomingSrc, /Print margin/);
assert.match(incomingSrc, /White edge for cutting/);
assert.match(incomingSrc, /padImageWhiteBorderFromMm/);
assert.match(incomingSrc, /loadPrintMarginMm/);
assert.match(incomingSrc, /savePrintMarginMm/);
assert.match(incomingSrc, /applyPrintMargin/);
assert.match(incomingSrc, /print-margin-slider/);
assert.match(incomingSrc, /PrintMarginControl/);
assert.doesNotMatch(
  incomingSrc,
  /onEdit=\{setEditorUrl\}[\s\S]{0,80}applyPrintMargin(?!\s*=\s*false)/,
);
console.log("OK  Incoming print-margin control on badge cards only");

assert.strictEqual(clampPrintMarginMm(-1), 0);
assert.strictEqual(clampPrintMarginMm(0), 0);
assert.strictEqual(clampPrintMarginMm(1.04), 1.0);
assert.strictEqual(clampPrintMarginMm(1.06), 1.1);
assert.strictEqual(clampPrintMarginMm(5.4), 5);
assert.strictEqual(clampPrintMarginMm(Number.NaN), 0);
assert.strictEqual(marginPxFromMm(0), 0);
assert.strictEqual(marginPxFromMm(1), Math.round(300 / 25.4));
assert.strictEqual(marginPxFromMm(1), 12);
assert.strictEqual(marginPxFromMm(5), 59);
assert.deepStrictEqual(paddedSize(1874, 1181, 0), { width: 1874, height: 1181, marginPx: 0 });
assert.deepStrictEqual(paddedSize(1874, 1181, 12), { width: 1898, height: 1205, marginPx: 12 });
assert.deepStrictEqual(paddedSize(4108, 1276, 0), { width: 4108, height: 1276, marginPx: 0 });
console.log("OK  mm/px clamp + padded size (0 mm is a no-op)");

const fit = containPercent((1898 / 1205), (1874 / 1181));
assert.ok(fit.heightPct === 100);
assert.ok(fit.widthPct < 100);
console.log("OK  containPercent letterboxes the padded landscape card");

const png300 = makePng(8, 8, { dpi: 300 });
assert.strictEqual(readPngDpi(png300), 300);
const pngNone = makePng(8, 8);
assert.strictEqual(readPngDpi(pngNone), null);
console.log("OK  synthetic PNG pHYs → 300 DPI");

const realFront = path.resolve(
  root,
  "..",
  "output",
  "edb907c9-c1fe-4464-b2fc-f3c34f82d7d4",
  "result-front.png",
);
if (fs.existsSync(realFront)) {
  const buf = fs.readFileSync(realFront);
  assert.strictEqual(buf.readUInt32BE(16), 1874);
  assert.strictEqual(buf.readUInt32BE(20), 1181);
  assert.strictEqual(readPngDpi(buf), 300);
  const m = marginPxFromMm(1, readPngDpi(buf));
  const out = paddedSize(1874, 1181, m);
  assert.strictEqual(out.width, 1874 + 24);
  assert.strictEqual(out.height, 1181 + 24);
  console.log("OK  real result-front.png is 1874×1181 @ 300 DPI; 1 mm → +12 px/side");
} else {
  console.log("SKIP real badge PNG (not in ../output)");
}

assert.match(helperSrc, /createElement\("canvas"\)/);
assert.match(helperSrc, /fillStyle = "#ffffff"/);
assert.match(helperSrc, /drawImage/);
assert.doesNotMatch(read("worker/scripts/run_idcardprint_job.jsx"), /printMargin|print-margin|bleed pad/);
assert.doesNotMatch(read("worker/scripts/run_employeeid_job.jsx"), /printMargin|mrz\.printMarginMm/);
console.log("OK  canvas pad is client-side; Photoshop worker JSX unchanged");

(async () => {
  const mod = await import("../src/lib/print-margin.ts");
  assert.strictEqual(mod.PRINT_MARGIN_STORAGE_KEY, "mrz.printMarginMm");
  assert.strictEqual(mod.marginPxFromMm(0), 0);
  assert.strictEqual(mod.marginPxFromMm(1), 12);
  assert.strictEqual(mod.clampPrintMarginMm(2.36), 2.4);
  const blob = new Blob([png300], { type: "image/png" });
  const same = await mod.padImageWhiteBorder(blob, 0);
  assert.strictEqual(same, blob);
  const sameMm = await mod.padImageWhiteBorderFromMm(blob, 0);
  assert.strictEqual(sameMm, blob);
  assert.strictEqual(mod.readPngDpi(png300.buffer.slice(png300.byteOffset, png300.byteOffset + png300.byteLength)), 300);
  console.log("OK  imported helper: 0 mm identity + 300 DPI parse");
  console.log("ALL PASS");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
