import { motion } from "motion/react";

export type LiquidVariant = "soft" | "balanced" | "strong";

type VariantSpec = {
  label: string;
  // Base frosted glass
  baseBlur: number;
  baseSaturate: number;
  baseBrightness: number;
  baseContrast: number;
  fillAlpha: number;
  // Inner edge bevel (filter shift only, no color fill)
  edgeBlur: number;
  edgeSaturate: number;
  edgeBrightness: number;
  edgeContrast: number;
  edgeBandPct: number;
  // Corner chroma (very subtle)
  chromaPx: number;
  chromaOpacity: number;
  // Rim hairline
  rimAlpha: number;
  rimWidth: number;
  // Shape & depth
  shadow: string;
  radius: number;
};

const VARIANTS: Record<LiquidVariant, VariantSpec> = {
  soft: {
    label: "Soft Liquid",
    baseBlur: 14,
    baseSaturate: 160,
    baseBrightness: 104,
    baseContrast: 102,
    fillAlpha: 0.05,
    edgeBlur: 18,
    edgeSaturate: 175,
    edgeBrightness: 110,
    edgeContrast: 106,
    edgeBandPct: 10,
    chromaPx: 1,
    chromaOpacity: 0.12,
    rimAlpha: 0.55,
    rimWidth: 1,
    shadow: "0 14px 36px -16px rgba(0,0,0,0.35), 0 2px 6px -2px rgba(0,0,0,0.16)",
    radius: 28,
  },
  balanced: {
    label: "Balanced Refraction",
    baseBlur: 16,
    baseSaturate: 180,
    baseBrightness: 106,
    baseContrast: 104,
    fillAlpha: 0.06,
    edgeBlur: 22,
    edgeSaturate: 200,
    edgeBrightness: 116,
    edgeContrast: 110,
    edgeBandPct: 9,
    chromaPx: 2,
    chromaOpacity: 0.22,
    rimAlpha: 0.75,
    rimWidth: 1.25,
    shadow: "0 22px 50px -18px rgba(0,0,0,0.42), 0 4px 12px -4px rgba(0,0,0,0.22)",
    radius: 30,
  },
  strong: {
    label: "Strong Crystal Glass",
    baseBlur: 18,
    baseSaturate: 200,
    baseBrightness: 108,
    baseContrast: 108,
    fillAlpha: 0.07,
    edgeBlur: 26,
    edgeSaturate: 230,
    edgeBrightness: 122,
    edgeContrast: 116,
    edgeBandPct: 8,
    chromaPx: 3,
    chromaOpacity: 0.34,
    rimAlpha: 0.95,
    rimWidth: 1.5,
    shadow: "0 30px 70px -20px rgba(0,0,0,0.5), 0 6px 18px -6px rgba(0,0,0,0.28)",
    radius: 34,
  },
};

export function LiquidGlassCard({
  variant,
  onClick,
  children,
  className = "",
  showLabel = true,
}: {
  variant: LiquidVariant;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  showLabel?: boolean;
}) {
  const v = VARIANTS[variant];

  const prefersReduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Inner edge ring mask — opaque rim band (~edgeBandPct), transparent center.
  // Corners get extra emphasis via overlaid radial gradients.
  const innerClear = 100 - v.edgeBandPct * 2;
  const ringMask = `
    radial-gradient(ellipse ${innerClear}% ${innerClear}% at 50% 50%, transparent ${innerClear - v.edgeBandPct * 0.5}%, #000 ${innerClear + 4}%),
    radial-gradient(36% 36% at 0% 0%, #000 0%, transparent 75%),
    radial-gradient(36% 36% at 100% 0%, #000 0%, transparent 75%),
    radial-gradient(36% 36% at 0% 100%, #000 0%, transparent 75%),
    radial-gradient(36% 36% at 100% 100%, #000 0%, transparent 75%)
  `;

  // Corner-only mask for the chromatic split (never crosses text area)
  const cornerMask = `
    radial-gradient(28% 28% at 0% 0%, #000 0%, transparent 70%),
    radial-gradient(28% 28% at 100% 0%, #000 0%, transparent 70%),
    radial-gradient(28% 28% at 0% 100%, #000 0%, transparent 70%),
    radial-gradient(28% 28% at 100% 100%, #000 0%, transparent 70%)
  `;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={prefersReduced ? undefined : { scale: 1.015, y: -3 }}
      whileTap={prefersReduced ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={`liquid-card liquid-card--${variant} relative text-left overflow-hidden group ${className}`}
      style={{
        borderRadius: v.radius,
        background: `rgba(255,255,255,${v.fillAlpha})`,
        boxShadow: `${v.shadow}, inset 0 ${v.rimWidth}px 0 rgba(255,255,255,${v.rimAlpha}), inset 0 0 0 1px rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.14)`,
        isolation: "isolate",
      }}
    >
      {/* Step 2 — Base frosted glass: light blur, high saturation, slight
          brightness and contrast. No gradient overlay. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          backdropFilter: `blur(${v.baseBlur}px) saturate(${v.baseSaturate}%) brightness(${v.baseBrightness}%) contrast(${v.baseContrast}%)`,
          WebkitBackdropFilter: `blur(${v.baseBlur}px) saturate(${v.baseSaturate}%) brightness(${v.baseBrightness}%) contrast(${v.baseContrast}%)`,
        }}
      />

      {/* Step 4 — Inner edge bevel: brightness/contrast/saturation shift only,
          masked to ~10% perimeter with extra emphasis at the four corners.
          No color fill, no rainbow. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          backdropFilter: `blur(${v.edgeBlur}px) saturate(${v.edgeSaturate}%) brightness(${v.edgeBrightness}%) contrast(${v.edgeContrast}%)`,
          WebkitBackdropFilter: `blur(${v.edgeBlur}px) saturate(${v.edgeSaturate}%) brightness(${v.edgeBrightness}%) contrast(${v.edgeContrast}%)`,
          WebkitMaskImage: ringMask,
          maskImage: ringMask,
        }}
      />

      {/* Step 3 — Crisp rim hairline: 1px top-bright, fades darker only slightly
          at the bottom. No thick grey border. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          padding: v.rimWidth,
          background: `linear-gradient(180deg, rgba(255,255,255,${v.rimAlpha}) 0%, rgba(255,255,255,${v.rimAlpha * 0.55}) 22%, rgba(255,255,255,0.06) 65%, rgba(0,0,0,0.16) 100%)`,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />

      {/* Step 5 — Tiny corner chroma: cyan/magenta offset, corners only, never
          across the text area. Built from backdrop-filter hue-shifts with a
          small translate so the rim subtly splits color. */}
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          backdropFilter: `blur(${v.edgeBlur}px) saturate(${v.edgeSaturate + 20}%) hue-rotate(-12deg)`,
          WebkitBackdropFilter: `blur(${v.edgeBlur}px) saturate(${v.edgeSaturate + 20}%) hue-rotate(-12deg)`,
          transform: `translate(${v.chromaPx}px, 0)`,
          opacity: v.chromaOpacity,
          WebkitMaskImage: cornerMask,
          maskImage: cornerMask,
          mixBlendMode: "screen",
        }}
      />
      <span
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "inherit",
          backdropFilter: `blur(${v.edgeBlur}px) saturate(${v.edgeSaturate + 20}%) hue-rotate(140deg)`,
          WebkitBackdropFilter: `blur(${v.edgeBlur}px) saturate(${v.edgeSaturate + 20}%) hue-rotate(140deg)`,
          transform: `translate(${-v.chromaPx}px, 0)`,
          opacity: v.chromaOpacity * 0.85,
          WebkitMaskImage: cornerMask,
          maskImage: cornerMask,
          mixBlendMode: "screen",
        }}
      />

      {/* Variant label */}
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

      {/* Content */}
      <span className="relative block">{children}</span>
    </motion.button>
  );
}
