/** Client-side white print margin (bleed pad) for Incoming badge PNGs. */

export const PRINT_MARGIN_STORAGE_KEY = "mrz.printMarginMm";
export const PRINT_MARGIN_MIN_MM = 0;
export const PRINT_MARGIN_MAX_MM = 5;
export const PRINT_MARGIN_STEP_MM = 0.1;
export const DEFAULT_PRINT_DPI = 300;
export const MM_PER_INCH = 25.4;

export type PrintMarginUnit = "mm" | "px";

export function clampPrintMarginMm(mm: number): number {
  if (!Number.isFinite(mm)) return PRINT_MARGIN_MIN_MM;
  const stepped = Math.round(mm / PRINT_MARGIN_STEP_MM) * PRINT_MARGIN_STEP_MM;
  const clamped = Math.min(PRINT_MARGIN_MAX_MM, Math.max(PRINT_MARGIN_MIN_MM, stepped));
  return Math.round(clamped * 10) / 10;
}

export function mmToPx(mm: number, dpi = DEFAULT_PRINT_DPI): number {
  return (mm * dpi) / MM_PER_INCH;
}

export function pxToMm(px: number, dpi = DEFAULT_PRINT_DPI): number {
  return (px * MM_PER_INCH) / dpi;
}

/** Integer pixel pad applied to each side at download/preview time. */
export function marginPxFromMm(mm: number, dpi = DEFAULT_PRINT_DPI): number {
  return Math.max(0, Math.round(mmToPx(clampPrintMarginMm(mm), dpi)));
}

export function paddedSize(
  srcW: number,
  srcH: number,
  marginPx: number,
): { width: number; height: number; marginPx: number } {
  const m = Math.max(0, Math.round(marginPx));
  return { width: srcW + 2 * m, height: srcH + 2 * m, marginPx: m };
}

export function containPercent(
  innerAspect: number,
  outerAspect: number,
): { widthPct: number; heightPct: number } {
  if (!(innerAspect > 0) || !(outerAspect > 0)) return { widthPct: 100, heightPct: 100 };
  return {
    widthPct: Math.min(100, (innerAspect / outerAspect) * 100),
    heightPct: Math.min(100, (outerAspect / innerAspect) * 100),
  };
}

export function loadPrintMarginMm(): number {
  try {
    if (typeof localStorage === "undefined") return PRINT_MARGIN_MIN_MM;
    const raw = localStorage.getItem(PRINT_MARGIN_STORAGE_KEY);
    if (raw == null || raw === "") return PRINT_MARGIN_MIN_MM;
    return clampPrintMarginMm(parseFloat(raw));
  } catch {
    return PRINT_MARGIN_MIN_MM;
  }
}

export function savePrintMarginMm(mm: number): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PRINT_MARGIN_STORAGE_KEY, String(clampPrintMarginMm(mm)));
  } catch {
    /* private mode / disabled storage */
  }
}

/** PNG pHYs → DPI. Unit 1 is pixels per metre. Returns null if missing/unknown. */
export function readPngDpi(bytes: ArrayBuffer | Uint8Array): number | null {
  const view =
    bytes instanceof ArrayBuffer
      ? new DataView(bytes)
      : new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 24) return null;
  if (view.getUint32(0) !== 0x89504e47 || view.getUint32(4) !== 0x0d0a1a0a) return null;

  let offset = 8;
  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset);
    if (length < 0 || offset + 12 + length > view.byteLength) return null;
    const type =
      String.fromCharCode(view.getUint8(offset + 4)) +
      String.fromCharCode(view.getUint8(offset + 5)) +
      String.fromCharCode(view.getUint8(offset + 6)) +
      String.fromCharCode(view.getUint8(offset + 7));
    if (type === "pHYs" && length >= 9) {
      const ppux = view.getUint32(offset + 8);
      const unit = view.getUint8(offset + 16);
      if (unit !== 1 || ppux <= 0) return null;
      const dpi = (ppux * MM_PER_INCH) / 1000;
      if (dpi < 1 || dpi > 10000) return null;
      const rounded = Math.round(dpi);
      return Math.abs(dpi - rounded) < 0.05 ? rounded : dpi;
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }
  return null;
}

export async function blobFromSource(source: Blob | string): Promise<Blob> {
  if (typeof source !== "string") return source;
  const res = await fetch(source);
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  return res.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Draw `source` onto a larger white canvas with `marginPx` on all four sides.
 * Original pixels are not stretched. `marginPx <= 0` returns the original blob.
 */
export async function padImageWhiteBorder(
  source: Blob | string,
  marginPx: number,
): Promise<Blob> {
  const blob = await blobFromSource(source);
  const m = Math.max(0, Math.round(marginPx));
  if (m === 0) return blob;

  const decoded = await decodeRaster(blob);
  try {
    const outW = decoded.width + 2 * m;
    const outH = decoded.height + 2 * m;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Could not create canvas context");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);
    decoded.draw(ctx, m, m, decoded.width, decoded.height);
    const padded = await canvasToPngBlob(canvas);
    return padded;
  } finally {
    decoded.close();
  }
}

/** Pad using millimetres and the PNG's own DPI (300 if pHYs is missing). */
export async function padImageWhiteBorderFromMm(
  source: Blob | string,
  marginMm: number,
): Promise<Blob> {
  const blob = await blobFromSource(source);
  const mm = clampPrintMarginMm(marginMm);
  if (mm <= 0) return blob;
  let dpi = DEFAULT_PRINT_DPI;
  try {
    const detected = readPngDpi(await blob.arrayBuffer());
    if (detected && detected > 0) dpi = detected;
  } catch {
    /* keep default */
  }
  return padImageWhiteBorder(blob, marginPxFromMm(mm, dpi));
}

type DecodedRaster = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
  close: () => void;
};

async function decodeRaster(blob: Blob): Promise<DecodedRaster> {
  if (typeof createImageBitmap === "function") {
    const bmp = await createImageBitmap(blob);
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, x, y, w, h) => ctx.drawImage(bmp, x, y, w, h),
      close: () => bmp.close(),
    };
  }

  const objUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image"));
      el.src = objUrl;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, x, y, w, h) => ctx.drawImage(img, x, y, w, h),
      close: () => URL.revokeObjectURL(objUrl),
    };
  } catch (err) {
    URL.revokeObjectURL(objUrl);
    throw err;
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      "image/png",
    );
  });
}
