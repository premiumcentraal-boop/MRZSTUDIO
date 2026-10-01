import { detectBundeslandCandidatesFromBufa, isKnownBundesland } from "./rules";
import { normalizeDigits, splitElster13 } from "./normalize";
import type { Bundesland, SteuernummerFormat } from "./types";

export function detectFormat(value: string): SteuernummerFormat {
  const digits = normalizeDigits(value);
  if (digits.length === 13) return "elster_13";
  if (digits.length >= 10 && digits.length <= 12) return "local";
  return "unknown";
}

export function detectBundeslandFromFinanzamtNumber(bufa: string, preferred?: Bundesland): Bundesland | null {
  if (preferred && isKnownBundesland(preferred)) return preferred;
  const candidates = detectBundeslandCandidatesFromBufa(normalizeDigits(bufa).slice(0, 4));
  return candidates.length === 1 ? candidates[0] : null;
}

export function detectBundeslandFromElster13(value: string, preferred?: Bundesland): Bundesland | null {
  const parts = splitElster13(value);
  return detectBundeslandFromFinanzamtNumber(parts.bundesfinanzamtsnummer, preferred);
}

export function detectBundeslandCandidates(value: string): Bundesland[] {
  const parts = splitElster13(value);
  return detectBundeslandCandidatesFromBufa(parts.bundesfinanzamtsnummer);
}

