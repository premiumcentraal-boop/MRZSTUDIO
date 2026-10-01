import { useRef } from "react";

export type PremiumLiquidVariant = "soft" | "balanced" | "strong";

type Spec = {
  displacementScale: number;
  blurAmount: number;
  saturation: number;
  aberrationIntensity: number;
  elasticity: number;
  cornerRadius: number;
  mode: "standard" | "polar" | "prominent" | "shader";
  label: string;
  // Inner edge lens ring (augments the base glass — distortion only at the rim)
  ringBandPct: number;       // 6–10% of card occupied by the ring
  ringBlur: number;
  ringSaturate: number;
  ringBrightness: number;
  ringContrast: number;
  // Corner chroma (very subtle, corners only)
  chromaPx: number;
  chromaOpacity: number;
  // Rim hairline brightness
  rimAlpha: number;
  // Animated rim sheen
  sheenOpacity: number;       // peak opacity of the drifting highlight
  sheenDurationSec: number;   // length of one full loop
  // Built-in tile tint — gives each card a subtle colored glass surface of
  // its own. Composited with soft-light blend so bright background peaks
  // still come through; never opaque enough to mute the spectral colors.
  tintTop: string;
  tintBottom: string;
  tintOpacity: number;
};

const VARIANTS: Record<PremiumLiquidVariant, Spec> = {
  // All three variants are tuned close to the previous Variant A / Soft Liquid.
  // Differences are intentionally small — restrained, premium, Apple-like.
  soft: {
    displacementScale: 40,
    blurAmount: 0.05,
    saturation: 130,
    aberrationIntensity: 1.5,
    elasticity: 0.15,
    cornerRadius: 28,
    mode: "standard",
    label: "Soft",
    ringBandPct: 6,
    ringBlur: 8,
    ringSaturate: 170,
    ringBrightness: 110,
    ringContrast: 104,
    chromaPx: 1,
    chromaOpacity: 0.12,
    rimAlpha: 0.6,
    sheenOpacity: 0.14,
    sheenDurationSec: 22,
    tintTop: "rgba(190, 192, 196, 0.20)",
    tintBottom: "rgba(150, 152, 156, 0.10)",
    tintOpacity: 0.8,
  },
  balanced: {
    displacementScale: 50,
    blurAmount: 0.06,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0.18,
    cornerRadius: 28,
    mode: "standard",
    label: "Refined",
    ringBandPct: 6,
    ringBlur: 9,
    ringSaturate: 175,
    ringBrightness: 112,
    ringContrast: 105,
    chromaPx: 1,
    chromaOpacity: 0.16,
    rimAlpha: 0.68,
    sheenOpacity: 0.2,
    sheenDurationSec: 18,
    tintTop: "rgba(195, 197, 200, 0.22)",
    tintBottom: "rgba(155, 157, 160, 0.11)",
    tintOpacity: 0.84,
  },
  strong: {
    displacementScale: 60,
    blurAmount: 0.07,
    saturation: 150,
    aberrationIntensity: 2.5,
    elasticity: 0.2,
    cornerRadius: 28,
    mode: "standard",
    label: "Polished",
    ringBandPct: 6,
    ringBlur: 10,
    ringSaturate: 180,
    ringBrightness: 114,
    ringContrast: 106,
    chromaPx: 2,
    chromaOpacity: 0.22,
    rimAlpha: 0.78,
    sheenOpacity: 0.28,
    sheenDurationSec: 14,
    tintTop: "rgba(200, 202, 206, 0.24)",
    tintBottom: "rgba(160, 162, 166, 0.12)",
    tintOpacity: 0.88,
  },
};

/**
 * Stable card shell + Liquid Glass effect as a visual skin only.
 *
 *   <button> shell                  ← controls width/height/radius/grid placement
 *     <span "glass layer">          ← absolute inset-0, z-0, pointer-events:none
 *       <LiquidGlass>               ← receives an empty full-size child
 *     <span "content layer">        ← relative z-10, original padding
 *
 * The package can never change the card's outer dimensions because it lives
 * inside an absolutely-positioned, clipped wrapper that fills the shell.
 */
export function PremiumLiquidCard({
  variant,
  onClick,
  children,
  className = "",
  showLabel = false,
}: {
  variant: PremiumLiquidVariant;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  showLabel?: boolean;
}) {
  const v = VARIANTS[variant];
  const shellRef = useRef<HTMLButtonElement | null>(null);

  // Inner edge ring mask — single tight ellipse, transparent center, opaque
  // only at the narrow perimeter. The ellipse naturally leaves the four
  // rectangular corners slightly more inside the opaque band, giving a modest
  // built-in corner emphasis without adding separate corner blobs.
  const innerClear = 100 - v.ringBandPct * 2;
  const fadeStart = Math.max(0, innerClear - 2);
  const fadeEnd = Math.min(100, innerClear + 3);
  const ringMask = `radial-gradient(ellipse ${innerClear}% ${innerClear}% at 50% 50%, transparent ${fadeStart}%, #000 ${fadeEnd}%)`;


  return (
    <button
      ref={shellRef}
      type="button"
      onClick={onClick}
      className={`relative w-full text-left group transition-transform duration-200 hover:-translate-y-1 active:scale-[0.985] ${className}`}
      style={{
        borderRadius: v.cornerRadius,
        isolation: "isolate",
        background: "transparent",
        boxShadow: `0 22px 50px -18px rgba(0,0,0,0.42)`,
        WebkitBackfaceVisibility: "hidden",
        backfaceVisibility: "hidden",
        transform: "translateZ(0)",
      }}
    >
      {/* Clipped inner stage — every filtered/glass layer lives here so the
          rasterized edges of backdrop-filter / SVG displacement never touch
          the card's outer silhouette. The outer <button> contributes only the
          clean rounded geometry; this stage is inset 0 and overflow-hidden,
          so its own clip path defines the optical edge — and the unfiltered
          border overlay above defines the visible silhouette. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          borderRadius: "inherit",
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
          backdropFilter: `blur(${14 + (variant === "balanced" ? 4 : variant === "strong" ? 8 : 0)}px) saturate(${v.saturation + 30}%) brightness(110%)`,
          WebkitBackdropFilter: `blur(${14 + (variant === "balanced" ? 4 : variant === "strong" ? 8 : 0)}px) saturate(${v.saturation + 30}%) brightness(110%)`,
          zIndex: 0,
        }}
      >
      {/* Built-in tile tint — a subtle colored glass surface that gives the
          card its own intentional hue. soft-light blend lets bright background
          peaks shine through while still tinting mid/dark areas. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          borderRadius: "inherit",
          background: `linear-gradient(180deg, ${v.tintTop} 0%, ${v.tintBottom} 100%)`,
          mixBlendMode: "soft-light",
          opacity: v.tintOpacity,
        }}
      />
      {/* A second very low-opacity tint copy in plain blend mode adds a touch
          of intentional surface color in dark zones without flattening peaks. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          borderRadius: "inherit",
          background: `linear-gradient(180deg, ${v.tintTop} 0%, ${v.tintBottom} 100%)`,
          opacity: 0.35,
        }}
      />

      {/* Edge lens ring — a subtle rim brightness band drawn with a static
          radial gradient (no backdrop-filter). The single-pass inner-stage
          filter is already doing the heavy lifting; this layer only adds the
          perimeter "lens" impression without compositing a second backdrop. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          borderRadius: "inherit",
          background:
            "radial-gradient(ellipse 100% 100% at 50% 50%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.05) 88%, rgba(255,255,255,0.10) 100%)",
          mixBlendMode: "screen",
          WebkitMaskImage: ringMask,
          maskImage: ringMask,
        }}
      />

      {/* Subtle spectral rim bevel — cyan / blue / violet / magenta color
          shift, clipped to the border only, strongest on the top edge and
          rounded corners. Very low opacity so it reads as polish, not paint. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 2,
          borderRadius: "inherit",
          padding: 1.5,
          background:
            "conic-gradient(from 220deg at 50% 50%, rgba(120,200,255,0.9), rgba(140,160,255,0.7), rgba(190,140,255,0.8), rgba(255,140,210,0.7), rgba(255,180,160,0.5), rgba(120,200,255,0.9))",
          opacity: v.chromaOpacity,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          mixBlendMode: "screen",
        }}
      />

      {/* Animated rim sheen — a thin specular drift across the rim only.
          Clipped to the border via mask-composite: exclude. Animates background
          position (cheap, GPU-friendly). Disabled by prefers-reduced-motion via
          the .liquid-rim-sheen class in theme.css. */}
      <span
        aria-hidden
        className="liquid-rim-sheen absolute inset-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-100"
        style={{
          zIndex: 3,
          borderRadius: "inherit",
          padding: 1.5,
          background:
            "linear-gradient(115deg, transparent 0%, transparent 32%, rgba(255,255,255,0.85) 48%, rgba(200,225,255,0.9) 50%, rgba(255,210,235,0.8) 52%, transparent 68%, transparent 100%)",
          backgroundSize: "260% 100%",
          backgroundRepeat: "no-repeat",
          opacity: v.sheenOpacity,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          mixBlendMode: "screen",
          animation: `liquidRimDrift ${v.sheenDurationSec}s linear infinite`,
          willChange: "background-position",
        }}
      />

      {/* Rim highlight — a 1px ring whose brightness is weighted toward the
          top using a radial gradient anchored above center. Sides fade quickly,
          bottom is effectively dark. mask-composite clips this to the rim
          pixels only, so what reads is light catching the top arc — not a
          drawn outline. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 3,
          borderRadius: "inherit",
          padding: 1.25,
          background: `radial-gradient(150% 110% at 50% -8%, rgba(255,255,255,${Math.min(1, v.rimAlpha * 1.25)}) 0%, rgba(255,255,255,${v.rimAlpha * 0.85}) 14%, rgba(255,255,255,${v.rimAlpha * 0.45}) 28%, rgba(255,255,255,0.10) 48%, rgba(255,255,255,0) 68%)`,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          mixBlendMode: "screen",
        }}
      />

      {/* Secondary upper bevel spread — a larger, softer rounded shape sitting
          BEHIND the primary bevel. Touches the rim (inset 0) and spreads
          further down into the tile to simulate light entering the glass from
          above and softly bleeding through. Heavier blur, lower opacity. */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          zIndex: 3,
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(64, v.cornerRadius + 36),
          borderRadius: "inherit",
          boxShadow:
            "inset 0 6px 12px -2px rgba(255,255,255,0.22), inset 0 14px 24px -6px rgba(255,255,255,0.12)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.40) 65%, rgba(0,0,0,0.10) 88%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 35%, rgba(0,0,0,0.40) 65%, rgba(0,0,0,0.10) 88%, transparent 100%)",
          filter: "blur(3px)",
          mixBlendMode: "screen",
          opacity: 0.75,
        }}
      />

      {/* Primary upper bevel — a rounded rectangle inset to the very top edge
          (no gap from the rim), with inset box-shadows that curve along the
          border-radius. Vertical mask reveals only the upper arc. This reads
          as the glass thickness directly under the rim. */}
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          zIndex: 4,
          top: 0,
          left: 0,
          right: 0,
          height: Math.max(36, v.cornerRadius + 8),
          borderRadius: "inherit",
          boxShadow:
            "inset 0 1.25px 0 rgba(255,255,255,0.65), inset 0 2.5px 0 rgba(255,255,255,0.26), inset 0 5px 5px -2px rgba(255,255,255,0.16)",
          WebkitMaskImage:
            "linear-gradient(180deg, #000 0%, #000 38%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.15) 86%, transparent 100%)",
          maskImage:
            "linear-gradient(180deg, #000 0%, #000 38%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.15) 86%, transparent 100%)",
          filter: "blur(0.5px)",
          mixBlendMode: "screen",
          opacity: 0.95,
        }}
      />
      </span>

      {/* Crisp silhouette overlay — unfiltered, no blur, no backdrop-filter.
          A 1px anti-aliased rounded border that defines the visible card
          edge cleanly on top of every filtered layer. This is what the eye
          reads as the card's silhouette. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          zIndex: 5,
          borderRadius: "inherit",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.18)",
        }}
      />

      {/* Content layer — relative, above the glass, owns its own padding */}
      <span className="relative block p-7 sm:p-8" style={{ zIndex: 10 }}>
        {showLabel && (
          <span
            aria-hidden
            className="absolute top-3 left-1/2 -translate-x-1/2 mono whitespace-nowrap pointer-events-none"
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.7)",
              textShadow: "0 1px 2px rgba(0,0,0,0.4)",
            }}
          >
            Variant {variant === "soft" ? "A" : variant === "balanced" ? "B" : "C"} · {v.label}
          </span>
        )}
        {children}
      </span>
    </button>
  );
}
