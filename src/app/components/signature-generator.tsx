import { useEffect, useMemo, useRef, useState } from "react";
import { PenLine, Check } from "lucide-react";
import { ensureBundledFontsLoaded, waitForFontReady } from "../../lib/signature-fonts";

const SIGNATURE_FONTS: { id: string; label: string; family: string; size: number }[] = [
  { id: "paul-signature", label: "Paul Signature", family: "'Paul Signature', cursive", size: 96 },
  { id: "testimonia", label: "Testimonia", family: "'Testimonia Signature', cursive", size: 96 },
  { id: "royalty", label: "Royalty", family: "'Royalty Signature', cursive", size: 96 },
  { id: "taylor-swift", label: "Taylor Swift", family: "'Taylor Swift', cursive", size: 96 },
  { id: "caramellia", label: "Caramellia", family: "'Caramellia', cursive", size: 96 },
  { id: "stay-classy", label: "Stay Classy", family: "'Stay Classy', cursive", size: 96 },
  { id: "ronde-royal", label: "Ronde Royal", family: "'Ronde Royal', cursive", size: 96 },
  { id: "rightman-signature", label: "Rightman Signature", family: "'Rightman Signature', cursive", size: 96 },
  { id: "dwayne-dylan", label: "Dwayne Dylan", family: "'Dwayne Dylan', cursive", size: 96 },
  { id: "great-vibes", label: "Great Vibes", family: "'Great Vibes', cursive", size: 96 },
  { id: "allura", label: "Allura", family: "'Allura', cursive", size: 96 },
  { id: "sacramento", label: "Sacramento", family: "'Sacramento', cursive", size: 92 },
  { id: "mrs-saint", label: "Mrs Saint Delafield", family: "'Mrs Saint Delafield', cursive", size: 100 },
  { id: "dancing", label: "Dancing Script", family: "'Dancing Script', cursive", size: 80 },
  { id: "homemade", label: "Homemade Apple", family: "'Homemade Apple', cursive", size: 64 },
  { id: "parisienne", label: "Parisienne", family: "'Parisienne', cursive", size: 84 },
  { id: "caveat", label: "Caveat", family: "'Caveat', cursive", size: 84 },
];

// The canvas IS the exported PNG — what you see in the preview is exactly
// what ships to Supabase. The signature itself is constrained to the inner
// 70% (15% transparent margin on every side); the outer 15% is always
// transparent so the signature has breathing room when placed on a card.
const CANVAS_W = 800;
const CANVAS_H = 260;
const MARGIN_RATIO = 0.15;

export function SignatureGenerator({
  defaultName,
  onUse,
}: {
  defaultName?: string;
  onUse: (file: File, dataUrl: string) => void;
}) {
  const [text, setText] = useState(defaultName || "");
  const [fontId, setFontId] = useState(SIGNATURE_FONTS[0].id);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const label = text || "Your name";
      // Extract the primary family name (strip cursive fallback) so we can
      // explicitly await the right FontFace before drawing.
      const primaryFamily = font.family.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
      try {
        await ensureBundledFontsLoaded();
        await waitForFontReady(primaryFamily, font.size);
        if (typeof document !== "undefined" && (document as any).fonts?.load) {
          // Load at a couple of sizes — some mobile browsers cache by exact
          // spec string and won't reuse a load resolved at a different size.
          await Promise.all([
            (document as any).fonts.load(`${font.size}px "${primaryFamily}"`, label),
            (document as any).fonts.load(`16px "${primaryFamily}"`, label),
          ]);
          await (document as any).fonts.ready;
        }
      } catch {
        // ignore — fall back to default
      }
      if (cancelled) return;
      // Font activation is async even though the bytes are bundled — only
      // paint once the FontFace promises above have resolved.

      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.fillStyle = "#0a0a0a";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Enforce a 15% transparent margin on every side. The signature is
      // auto-shrunk by both width AND ascender height so it never crosses
      // into the margin band.
      const innerW = CANVAS_W * (1 - MARGIN_RATIO * 2);
      const innerH = CANVAS_H * (1 - MARGIN_RATIO * 2);
      let size = font.size;
      const measure = () => {
        ctx.font = `${size}px ${font.family}`;
        const m = ctx.measureText(label);
        const ascent =
          (m.actualBoundingBoxAscent || size * 0.8) +
          (m.actualBoundingBoxDescent || size * 0.2);
        return { width: m.width, height: ascent };
      };
      let m = measure();
      while ((m.width > innerW || m.height > innerH) && size > 18) {
        size -= 4;
        m = measure();
      }
      ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2);
      if (!cancelled) setLoading(false);
    };
    draw();
    return () => {
      cancelled = true;
    };
  }, [text, font]);

  const useSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // The canvas already has the 15% transparent margin baked in and a fully
    // transparent background, so export it as-is — no second canvas needed.
    const dataUrl = canvas.toDataURL("image/png");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const safe = (text || "signature").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
      const file = new File([blob], `${safe || "signature"}.png`, { type: "image/png" });
      onUse(file, dataUrl);
    }, "image/png");
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

      {/* Preview frame. The white checkerboard is preview-only — the
        * exported PNG is fully transparent. The signature is auto-fit
        * inside a 15% transparent safe area on every side. */}
      <div
        className="mt-2 relative rounded-lg flex items-center justify-center overflow-hidden border border-white/10"
        style={{
          backgroundColor: "#ffffff",
          backgroundImage:
            "linear-gradient(45deg, #e5e5e5 25%, transparent 25%), linear-gradient(-45deg, #e5e5e5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e5e5 75%), linear-gradient(-45deg, transparent 75%, #e5e5e5 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          style={{ opacity: loading ? 0 : 1, transition: "opacity 120ms ease" }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/85">
            <div className="flex items-center gap-2 text-black/60 text-xs mono uppercase tracking-[0.14em]">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-black/20 border-t-black/70 animate-spin" />
              Loading signature font…
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={useSignature}
        disabled={!text.trim() || loading}
        className="mt-2 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-white text-black text-xs mono uppercase tracking-[0.14em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
      >
        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
        Use this signature
      </button>
    </div>
  );
}
