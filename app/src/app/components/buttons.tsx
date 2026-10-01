import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";

/* ============================================================================
 * Shared button primitives used across steps. Extracted from App.tsx to keep
 * the entrypoint slim.
 * ========================================================================== */

export function PrimaryButton({
  children,
  onClick,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${full ? "w-full" : ""} h-12 px-6 rounded-full bg-white text-black inline-flex items-center justify-center gap-2 text-sm tracking-tight shadow-[0_10px_30px_-10px_rgba(255,255,255,0.4)] hover:bg-white/90 transition-colors`}
    >
      {children}
    </motion.button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${full ? "w-full" : ""} h-12 px-5 rounded-full glass-sm text-white inline-flex items-center justify-center gap-2 text-sm tracking-tight hover:bg-white/10 transition-colors`}
    >
      {children}
    </motion.button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-11 px-4 rounded-full text-white/70 hover:text-white inline-flex items-center gap-2 text-xs mono uppercase tracking-[0.16em] transition-colors"
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
      Back
    </button>
  );
}
