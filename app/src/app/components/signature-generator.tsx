import { SIGNATURE_FONTS } from '../../lib/signature-options';
import { useEffect, useMemo, useRef, useState } from "react";
import { PenLine, Check, RotateCcw } from "lucide-react";
import { ensureBundledFontsLoaded, waitForFontReady } from "../../lib/signature-fonts";
import { SIGNATURE_H, SIGNATURE_W } from "../../lib/image-export-sizes";
import { canvasToSignaturePng, drawSignature, sizeSignatureCanvas } from "../../lib/signature-raster";



const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

export function SignatureGenerator({
  defaultName,
  initialSettings,
  onUse,
}: {
  defaultName?: string;
  initialSettings?: {font:string;scale:number;x:number;y:number};
  onUse: (file: File, dataUrl: string) => void;
}) {
  const [text, setText] = useState(defaultName || "");
  const [fontId, setFontId] = useState(initialSettings?.font || SIGNATURE_FONTS[0].id);
  const [fontsReady, setFontsReady] = useState(false);
  const [userScale, setUserScale] = useState(initialSettings?.scale || 1);
  const [offset, setOffset] = useState({ x: initialSettings?.x || 0, y: initialSettings?.y || 0 });
  const [transformLocked, setTransformLocked] = useState(!!initialSettings);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const font = useMemo(
    () => SIGNATURE_FONTS.find((f) => f.id === fontId) ?? SIGNATURE_FONTS[0],
    [fontId],
  );

  // Keep the signature input in lockstep with the first/last name passed in
  // from the parent form. The user can still type to override, but any
  // subsequent change to the form name will resync.
  useEffect(() => {
    setText(defaultName || "");
  }, [defaultName]);

  // Re-fit when text/font changes unless the user has manually pan/zoomed.
  useEffect(() => {
    if (transformLocked) return;
    setUserScale(1);
    setOffset({ x: 0, y: 0 });
  }, [text, fontId, transformLocked]);

  useEffect(() => {
    let cancelled = false;
    setFontsReady(false);
    const load = async () => {
      const label = text || "Your name";
      const primaryFamily = font.family.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      try {
        await ensureBundledFontsLoaded();
        await waitForFontReady(primaryFamily, font.size);
        if (typeof document !== "undefined" && (document as any).fonts?.load) {
          await Promise.all([
            (document as any).fonts.load(`${font.size}px "${primaryFamily}"`, label),
            (document as any).fonts.load(`16px "${primaryFamily}"`, label),
          ]);
          await (document as any).fonts.ready;
        }
      } catch {
        // ignore — fall back to default
      }
      if (!cancelled) setFontsReady(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [text, font]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !fontsReady) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    sizeSignatureCanvas(canvas);
    drawSignature(ctx, {
      text,
      fontFamily: font.family,
      fontBaseSize: font.size,
      scale: userScale,
      offsetX: offset.x,
      offsetY: offset.y,
    });
  }, [text, font, userScale, offset, fontsReady]);

  const clientToCanvas = (dx: number, dy: number) => {
    const frame = frameRef.current;
    if (!frame) return { x: dx, y: dy };
    const rect = frame.getBoundingClientRect();
    return {
      x: dx * (SIGNATURE_W / Math.max(1, rect.width)),
      y: dy * (SIGNATURE_H / Math.max(1, rect.height)),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const { x, y } = clientToCanvas(e.clientX - dragStart.current.x, e.clientY - dragStart.current.y);
    setOffset({ x: dragStart.current.ox + x, y: dragStart.current.oy + y });
    setTransformLocked(true);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setUserScale((prev) =>
        Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * (e.deltaY < 0 ? 1.08 : 1 / 1.08))),
      );
      setTransformLocked(true);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const resetTransform = () => {
    setUserScale(1);
    setOffset({ x: 0, y: 0 });
    setTransformLocked(false);
  };

  const useSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Full 420×123 bitmap including transparent padding (what you see = what you get).
    const { file, dataUrl } = await canvasToSignaturePng(canvas, text || "signature");
    onUse(file, dataUrl);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 mt-2">
      <div className="flex items-center gap-2 text-white/65 text-[10px] mono uppercase tracking-[0.16em] mb-2">
        <PenLine className="w-3 h-3" strokeWidth={2} />
        Generate signature
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={defaultName || "Type your name"}
          maxLength={40}
          className="px-3 h-10 rounded-lg bg-black/40 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
        <select
          value={fontId}
          onChange={(e) => setFontId(e.target.value)}
          className="px-3 h-10 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
          style={{ colorScheme: "dark" }}
        >
          {SIGNATURE_FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* WYSIWYG stage: CSS-scaled for usability, raster is always 420×123. */}
      <div
        ref={frameRef}
        className={`mt-2 relative rounded-lg flex items-center justify-center overflow-hidden border border-white/10 select-none ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          backgroundColor: "#ffffff",
          backgroundImage:
            "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          aspectRatio: `${SIGNATURE_W} / ${SIGNATURE_H}`,
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <canvas
          ref={canvasRef}
          width={SIGNATURE_W}
          height={SIGNATURE_H}
          className="absolute inset-0 w-full h-full block"
          style={{ opacity: fontsReady ? 1 : 0, transition: "opacity 120ms ease", pointerEvents: "none" }}
        />
        {!fontsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/85">
            <div className="flex items-center gap-2 text-black/60 text-xs mono uppercase tracking-[0.14em]">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-black/20 border-t-black/70 animate-spin" />
              Loading signature font…
            </div>
          </div>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/55 text-[10px] mono uppercase tracking-[0.14em]">
            Size · drag to place · {SIGNATURE_W}×{SIGNATURE_H} px
          </span>
          <button
            type="button"
            onClick={resetTransform}
            className="flex items-center gap-1 text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset position
          </button>
        </div>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={userScale}
          onChange={(e) => {
            setUserScale(parseFloat(e.target.value));
            setTransformLocked(true);
          }}
          className="w-full accent-white"
          aria-label="Signature scale"
        />
      </div>

      <button
        type="button"
        onClick={useSignature}
        disabled={!text.trim() || !fontsReady}
        className="mt-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-xs mono uppercase tracking-[0.14em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
      >
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        Use this signature
      </button>
    </div>
  );
}
