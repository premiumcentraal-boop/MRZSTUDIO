import { SIGNATURE_H, SIGNATURE_W } from "./image-export-sizes";

/** Default auto-fit padding so descenders/ascenders don't clip at scale=1. */
export const SIGNATURE_AUTO_PAD = 0.08;

export type SignatureDrawOpts = {
  text: string;
  fontFamily: string;
  fontBaseSize: number;
  /** 1 = auto contain-center; >1 zooms (may clip ink). */
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function sizeSignatureCanvas(canvas: { width: number; height: number }) {
  canvas.width = SIGNATURE_W;
  canvas.height = SIGNATURE_H;
}

export function autoFontSize(
  ctx: CanvasRenderingContext2D,
  label: string,
  fontFamily: string,
  startSize: number,
  innerW: number,
  innerH: number,
): number {
  let size = startSize;
  const measure = () => {
    ctx.font = `${size}px ${fontFamily}`;
    const m = ctx.measureText(label);
    const height =
      (m.actualBoundingBoxAscent || size * 0.8) +
      (m.actualBoundingBoxDescent || size * 0.2);
    return { width: m.width, height };
  };
  let m = measure();
  while ((m.width > innerW || m.height > innerH) && size > 10) {
    size -= 1;
    m = measure();
  }
  return size;
}

/** Paint signature ink onto a 420×123 transparent canvas. Does not stretch. */
export function drawSignature(ctx: CanvasRenderingContext2D, opts: SignatureDrawOpts) {
  const w = SIGNATURE_W;
  const h = SIGNATURE_H;
  ctx.clearRect(0, 0, w, h);
  const label = opts.text || "Your name";
  const innerW = w * (1 - SIGNATURE_AUTO_PAD * 2);
  const innerH = h * (1 - SIGNATURE_AUTO_PAD * 2);
  const base = autoFontSize(ctx, label, opts.fontFamily, opts.fontBaseSize, innerW, innerH);
  const size = Math.max(4, base * opts.scale);
  ctx.fillStyle = "#0a0a0a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${size}px ${opts.fontFamily}`;
  ctx.fillText(label, w / 2 + opts.offsetX, h / 2 + opts.offsetY);
}

/**
 * Export the full 420×123 canvas as a PNG File. Never crops to the ink's
 * alpha bounding box — transparent padding is part of the bitmap.
 */
export async function canvasToSignaturePng(
  canvas: HTMLCanvasElement,
  basename: string,
): Promise<{ file: File; dataUrl: string }> {
  if (canvas.width !== SIGNATURE_W || canvas.height !== SIGNATURE_H) {
    throw new Error(
      `Signature export canvas must be ${SIGNATURE_W}x${SIGNATURE_H}, got ${canvas.width}x${canvas.height}`,
    );
  }
  const dataUrl = canvas.toDataURL("image/png");
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("signature toBlob returned null"))),
      "image/png",
    );
  });
  const safe = (basename || "signature").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  const file = new File([blob], `${safe || "signature"}_${SIGNATURE_W}x${SIGNATURE_H}.png`, {
    type: "image/png",
  });
  return { file, dataUrl };
}
