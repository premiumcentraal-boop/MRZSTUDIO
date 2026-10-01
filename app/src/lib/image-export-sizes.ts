/** Single source of truth for EmployeeID slot export sizes. */

/** Employee photo slot (cover-crop). Do not change without updating the PSD photo SO. */
export const EXPORT_W = 2421;
export const EXPORT_H = 3292;

/** Signature slot. Every generator/upload/camera path must emit this size, contain-centered. */
export const SIGNATURE_W = 420;
export const SIGNATURE_H = 123;

/**
 * Uniform scale that fits `src` inside `box` without stretching, plus the centered draw rect.
 * Pass `{ allowUpscale: false }` for signature placement: never enlarge ink to fill the slot.
 */
export function containCenter(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
  opts?: { allowUpscale?: boolean },
): { width: number; height: number; x: number; y: number; scale: number } {
  let scale = Math.min(boxW / Math.max(1, srcW), boxH / Math.max(1, srcH));
  if (opts && opts.allowUpscale === false) {
    scale = Math.min(1, scale);
  }
  const width = srcW * scale;
  const height = srcH * scale;
  return {
    width,
    height,
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
    scale,
  };
}
