import { useEffect, useRef, useState } from "react";
import { X, Check, RotateCcw, Sparkles, Loader2 } from "lucide-react";

/* ============================================================================
 * PhotoEditor
 *
 * Simple drag-to-pan + zoom-slider crop tool. The aspect-ratio frame represents
 * targetW × targetH px; the user positions their photo inside the frame and
 * the resulting Blob is rendered at the full export resolution regardless of
 * source size.
 *
 * Single standardized output size used by every badge job.
 * ========================================================================== */

// Default export size for the employee photo slot.
export const EXPORT_W = 2421;
export const EXPORT_H = 3292;
// Default export size for the signature slot.
export const SIGNATURE_W = 420;
export const SIGNATURE_H = 123;

type PhotoEditorProps = {
  sourceFile: File;
  onConfirm: (file: File, previewDataUrl: string) => void;
  onCancel: () => void;
  exportWidth?: number;
  exportHeight?: number;
  title?: string;
  /** "transparent" preserves PNG alpha (use for signatures); "white" fills bg. */
  background?: "white" | "transparent";
  /**
   * Background removal mode.
   * - "selfie": MediaPipe person segmentation (default — employee photos)
   * - "luminance": simple slider that keys out light pixels (signatures, line art)
   */
  bgRemoval?: "selfie" | "luminance";
  /**
   * Optional alignment overlay shown inside the preview frame at low opacity.
   * Used for the employee photo to indicate where the face should land. Not
   * baked into the export — purely a visual guide.
   */
  overlayImageSrc?: string;
};

export function PhotoEditor({
  sourceFile,
  onConfirm,
  onCancel,
  exportWidth = EXPORT_W,
  exportHeight = EXPORT_H,
  title = "Position photo",
  background = "white",
  bgRemoval = "selfie",
  overlayImageSrc,
}: PhotoEditorProps) {
  const targetW = exportWidth;
  const targetH = exportHeight;
  const ASPECT = targetW / targetH;
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [originalImgEl, setOriginalImgEl] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, ox: 0, oy: 0 });
  const [isExporting, setIsExporting] = useState(false);

  const frameRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState({ w: 320, h: Math.round(320 / ASPECT) });
  const [bgRemoving, setBgRemoving] = useState(false);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);
  // Luminance key threshold for signatures: 0 disables the effect; higher values
  // make more (darker) pixels transparent. Feather extends 25 below the
  // threshold to give anti-aliased stroke edges instead of jagged ones.
  const [luminance, setLuminance] = useState(0);

  // Re-render imgEl from originalImgEl using a luminance threshold. Pixels
  // brighter than `threshold` become fully transparent; pixels within the
  // feather range fade smoothly. Threshold of 0 restores the original.
  const applyLuminanceKey = (threshold: number) => {
    if (!originalImgEl) return;
    if (threshold <= 0) {
      setImgEl(originalImgEl);
      setBgRemoved(false);
      return;
    }
    const w = originalImgEl.naturalWidth;
    const h = originalImgEl.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(originalImgEl, 0, 0, w, h);
    const frame = ctx.getImageData(0, 0, w, h);
    const data = frame.data;
    // Slider semantics: 0 = off, 255 = most aggressive. Map to a luminance
    // cutoff that starts at "almost pure white" and slides down toward black
    // as the slider increases.
    const cutoff = 256 - threshold;
    const feather = 25;
    const lo = cutoff - feather;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum >= cutoff) {
        data[i + 3] = 0;
      } else if (lum > lo) {
        data[i + 3] = Math.round(data[i + 3] * (1 - (lum - lo) / feather));
      }
    }
    ctx.putImageData(frame, 0, 0);
    const next = new Image();
    next.onload = () => {
      setImgEl(next);
      setBgRemoved(true);
    };
    next.src = c.toDataURL("image/png");
  };

  // Strip the background of the currently loaded image using MediaPipe Selfie
  // Segmentation. Loaded lazily so the ~1MB WASM + model only download when the
  // user actually clicks the button. Replaces imgEl with a transparent-PNG
  // version so all existing pan/zoom/export math keeps working unchanged.
  const handleRemoveBackground = async () => {
    if (!imgEl || bgRemoving) return;
    setBgRemoving(true);
    setBgError(null);
    try {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
      );
      const segmenter = await ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });

      const w = imgEl.naturalWidth;
      const h = imgEl.naturalHeight;
      const out = document.createElement("canvas");
      out.width = w;
      out.height = h;
      const octx = out.getContext("2d");
      if (!octx) throw new Error("Canvas 2D context unavailable");
      octx.drawImage(imgEl, 0, 0, w, h);
      const frame = octx.getImageData(0, 0, w, h);

      const result = segmenter.segment(imgEl);
      const mask = result.categoryMask;
      if (!mask) throw new Error("Segmentation returned no mask");
      const maskData = mask.getAsUint8Array();

      // Selfie segmenter category mask: 0 = person, non-zero = background.
      for (let i = 0; i < maskData.length; i++) {
        if (maskData[i] !== 0) frame.data[i * 4 + 3] = 0;
      }
      octx.putImageData(frame, 0, 0);
      mask.close();
      result.close?.();
      segmenter.close();

      const dataUrl = out.toDataURL("image/png");
      const next = new Image();
      await new Promise<void>((resolve, reject) => {
        next.onload = () => resolve();
        next.onerror = () => reject(new Error("Failed to reload cut-out image"));
        next.src = dataUrl;
      });
      setImgEl(next);
      setBgRemoved(true);
    } catch (err) {
      setBgError(err instanceof Error ? err.message : "Background removal failed");
    } finally {
      setBgRemoving(false);
    }
  };

  // Load source file into an HTMLImageElement
  useEffect(() => {
    const url = URL.createObjectURL(sourceFile);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      setOriginalImgEl(img);
      setBgRemoved(false);
      setBgError(null);
      setLuminance(0);
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [sourceFile]);

  // Compute frame display size based on container
  useEffect(() => {
    if (!frameRef.current) return;
    const update = () => {
      const parent = frameRef.current?.parentElement;
      if (!parent) return;
      const isLandscape = ASPECT > 1;
      const maxW = Math.min(parent.clientWidth - 32, isLandscape ? 520 : 360);
      const maxH = Math.min(window.innerHeight * 0.55, 520);
      let w = maxW;
      let h = w / ASPECT;
      if (h > maxH) {
        h = maxH;
        w = h * ASPECT;
      }
      setFrameSize({ w: Math.round(w), h: Math.round(h) });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // When a *new source* loads, compute the base "cover" scale and center it.
  // Keyed off originalImgEl (not imgEl) so swapping in a background-removed
  // cut-out — which has identical dimensions — preserves the user's current
  // zoom and position instead of snapping back to fully zoomed out.
  useEffect(() => {
    if (!originalImgEl) return;
    const coverScale = Math.max(
      frameSize.w / originalImgEl.width,
      frameSize.h / originalImgEl.height,
    );
    setMinScale(coverScale);
    setScale(coverScale);
    setOffset({ x: 0, y: 0 });
  }, [originalImgEl, frameSize]);

  const clampOffset = (ox: number, oy: number, s: number) => {
    if (!imgEl) return { x: 0, y: 0 };
    const imgW = imgEl.width * s;
    const imgH = imgEl.height * s;
    const maxX = Math.max(0, (imgW - frameSize.w) / 2);
    const maxY = Math.max(0, (imgH - frameSize.h) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setOffset(clampOffset(dragStart.ox + dx, dragStart.oy + dy, scale));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const onScaleChange = (next: number) => {
    setScale(next);
    setOffset((cur) => clampOffset(cur.x, cur.y, next));
  };

  const reset = () => {
    setScale(minScale);
    setOffset({ x: 0, y: 0 });
  };

  const handleApply = async () => {
    if (!imgEl) return;
    setIsExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      // Always export PNG so transparency is preserved end-to-end to the worker.
      const preserveAlpha = background === "transparent";
      if (!preserveAlpha) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetW, targetH);
      }

      const exportScale = targetW / frameSize.w;
      const drawW = imgEl.width * scale * exportScale;
      const drawH = imgEl.height * scale * exportScale;
      const cx = targetW / 2 + offset.x * exportScale;
      const cy = targetH / 2 + offset.y * exportScale;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imgEl, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

      const mime = "image/png";
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
          mime
        )
      );

      const baseName = sourceFile.name.replace(/\.[^.]+$/, "");
      const file = new File([blob], `${baseName}_${targetW}x${targetH}.png`, {
        type: mime,
      });
      const previewDataUrl = canvas.toDataURL(mime);
      onConfirm(file, previewDataUrl);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className={`glass rounded-2xl p-6 w-full ${ASPECT > 1 ? "max-w-xl" : "max-w-md"}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white text-lg tracking-tight">{title}</h3>
            <p className="text-white/55 text-xs mt-1">
              Drag to reposition · zoom with the slider
            </p>
            {background === "transparent" && (
              <p className="text-amber-200/80 text-[11px] mt-1.5">
                The sweeping line shows transparent areas — anything you can see through
                will export as transparent in the final PNG.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/60 hover:text-white transition-colors p-1"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <div
            ref={frameRef}
            className={`relative overflow-hidden rounded-lg border-2 border-white/30 cursor-grab active:cursor-grabbing select-none ${
              background === "transparent" ? "photo-editor-transparency-bg" : "bg-black/60"
            }`}
            style={{ width: frameSize.w, height: frameSize.h }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {imgEl && (
              <img
                src={imgEl.src}
                alt="Source"
                draggable={false}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: imgEl.width * scale,
                  height: imgEl.height * scale,
                  transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                  pointerEvents: "none",
                  maxWidth: "none",
                }}
              />
            )}
            {overlayImageSrc && (
              <img
                src={overlayImageSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                style={{ opacity: 0.28, mixBlendMode: "difference", transform: "scale(1.2)", filter: "contrast(1.3)" }}
              />
            )}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/2 left-0 w-full border-t border-white/10" />
              <div className="absolute left-1/2 top-0 h-full border-l border-white/10" />
            </div>
          </div>
        </div>

        {bgRemoval === "luminance" ? (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/70 text-xs">
                Background removal
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-white/15 text-[9px] mono uppercase tracking-[0.14em] text-white/85">
                  Recommended
                </span>
              </span>
              {luminance > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setLuminance(0);
                    applyLuminanceKey(0);
                  }}
                  className="flex items-center gap-1 text-white/60 hover:text-white transition-colors"
                  aria-label="Reset background removal"
                  title="Reset background removal"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={255}
              step={1}
              value={luminance}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setLuminance(v);
                applyLuminanceKey(v);
              }}
              className="w-full accent-white"
            />
            <div className="flex justify-between text-[10px] mono uppercase tracking-[0.14em] text-white/45 mt-1">
              <span>Off</span>
              <span>Aggressive</span>
            </div>
          </div>
        ) : (
        <div className="mb-3 flex items-center gap-2">
          <div className="inline-flex items-stretch rounded-lg border border-white/15 overflow-hidden">
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={!imgEl || bgRemoving || bgRemoved}
              className="flex items-center gap-1.5 px-3 py-1.5 text-white/80 text-xs hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              {bgRemoving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {bgRemoving
                ? "Removing background…"
                : bgRemoved
                ? "Background removed"
                : "Remove background"}
              {!bgRemoving && !bgRemoved && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-white/15 text-[9px] mono uppercase tracking-[0.14em] text-white/85">
                  Recommended
                </span>
              )}
            </button>
            {bgRemoved && (
              <button
                type="button"
                onClick={() => {
                  if (originalImgEl) setImgEl(originalImgEl);
                  setBgRemoved(false);
                  setBgError(null);
                }}
                className="flex items-center justify-center px-2 border-l border-white/15 text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Undo background removal"
                title="Undo background removal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {bgError && <span className="text-red-300 text-xs">{bgError}</span>}
        </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/70 text-xs">Zoom</span>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
          <input
            type="range"
            min={minScale * 0.8}
            max={minScale * 5}
            step={minScale / 100}
            value={scale}
            onChange={(e) => onScaleChange(parseFloat(e.target.value))}
            className="w-full accent-white"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-white/15 text-white/75 text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!imgEl || isExporting}
            className="flex-1 px-4 py-2 rounded-lg bg-white text-black text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            {isExporting ? "Exporting…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
