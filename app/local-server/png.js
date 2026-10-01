/**
 * Tiny PNG writer for LOCAL_DRY_RUN placeholder badges. No native deps.
 */
const zlib = require("zlib");

function crc32(buf) {
  let c = ~0 >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? ((c >>> 1) ^ 0xedb88320) : (c >>> 1);
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

function clampByte(n) {
  return Math.max(0, Math.min(255, n | 0));
}

function makePng(width, height, rgbaAt) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = rgbaAt(x, y);
      const i = row + 1 + x * 4;
      raw[i] = clampByte(r);
      raw[i + 1] = clampByte(g);
      raw[i + 2] = clampByte(b);
      raw[i + 3] = clampByte(a == null ? 255 : a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function dryRunBadgePng({ label = "LOCAL DRY RUN", subtitle = "", side = "FRONT" } = {}) {
  const width = 1016;
  const height = 638;
  const isBack = String(side).toUpperCase() === "BACK";
  return makePng(width, height, (x, y) => {
    const border = x < 12 || y < 12 || x >= width - 12 || y >= height - 12;
    if (border) return [230, 230, 235, 255];
    if (y < 72) return isBack ? [28, 48, 72, 255] : [18, 90, 78, 255];
    if (y >= 72 && y < 76) return [210, 180, 90, 255];
    // photo well
    if (!isBack && x > 40 && x < 280 && y > 110 && y < 430) {
      const inside = x > 48 && x < 272 && y > 118 && y < 422;
      if (!inside) return [240, 240, 244, 255];
      return [42, 52, 64, 255];
    }
    // faux MRZ band
    if (y > 520 && y < 610) {
      const stripe = Math.floor(x / 7) % 2 === 0;
      return stripe ? [32, 32, 36, 255] : [48, 48, 54, 255];
    }
    return isBack ? [36, 42, 54, 255] : [22, 28, 36, 255];
  });
}

module.exports = { makePng, dryRunBadgePng };
