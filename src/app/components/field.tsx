/* ============================================================================
 * Field — basic labeled text input. Extracted from App.tsx so step components
 * can import it without pulling in the entire App module.
 * ========================================================================== */

import { Check, X } from "lucide-react";

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  mono,
  uppercase,
  status,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  mono?: boolean;
  uppercase?: boolean;
  status?: "ok" | "err" | null;
}) {
  return (
    <label className="block">
      <div className="text-white/65 text-xs mb-1.5 tracking-wide">{label}</div>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`glass-input w-full pl-3.5 h-11 ${status ? "pr-10" : "pr-3.5"} ${mono ? "mono" : ""} ${uppercase ? "uppercase" : ""}`}
          style={type === "date" ? { colorScheme: "dark" } : undefined}
        />
        {status && (
          <span
            className={`absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-5 h-5 rounded-full border ${
              status === "ok"
                ? "text-emerald-300 border-emerald-300/40 bg-emerald-300/10"
                : "text-rose-300 border-rose-300/40 bg-rose-300/10"
            }`}
          >
            {status === "ok" ? (
              <Check className="w-3 h-3" strokeWidth={2.5} />
            ) : (
              <X className="w-3 h-3" strokeWidth={2.5} />
            )}
          </span>
        )}
      </div>
    </label>
  );
}
