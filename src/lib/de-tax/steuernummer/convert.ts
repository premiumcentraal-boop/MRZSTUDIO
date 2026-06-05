import { getRule } from "./rules";
import { normalizeDigits, splitElster13 } from "./normalize";
import type { Bundesland } from "./types";

export type ConversionOptions = {
  bundesland: Bundesland;
  bundesfinanzamtsnummer?: string;
  allow_legacy_formats?: boolean;
};

function assertDigitsLength(value: string, length: number, label: string): void {
  if (value.length !== length) {
    throw new Error(`${label} must contain ${length} digits after separators are removed.`);
  }
}

function bufaFromLocal(localFinanzamt: string, bundesland: Bundesland, override?: string): string {
  if (override) {
    const normalized = normalizeDigits(override);
    assertDigitsLength(normalized, 4, "bundesfinanzamtsnummer");
    return normalized;
  }
  const rule = getRule(bundesland);
  if (bundesland === "hessen") return `${rule.bufaPrefix}${localFinanzamt.slice(1)}`;
  return `${rule.bufaPrefix}${localFinanzamt}`;
}

export function elster13ToLocal(value: string, bundesland: Bundesland): string {
  const parts = splitElster13(value);
  assertDigitsLength(parts.normalized, 13, "ELSTER Steuernummer");
  const uuuuP = `${parts.nonNrwUnterscheidungsnummer}${parts.pruefziffer}`;
  if (bundesland === "baden_wuerttemberg") return `${parts.bundesfinanzamtsnummer.slice(2)}${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "bayern") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "berlin") return `${parts.bundesfinanzamtsnummer.slice(2)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "brandenburg") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "bremen") return `${parts.bundesfinanzamtsnummer.slice(2)} ${parts.nonNrwBezirk} ${uuuuP}`;
  if (bundesland === "hamburg") return `${parts.bundesfinanzamtsnummer.slice(2)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "hessen") return `0${parts.bundesfinanzamtsnummer.slice(2)} ${parts.nonNrwBezirk} ${uuuuP}`;
  if (bundesland === "mecklenburg_vorpommern") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "niedersachsen") return `${parts.bundesfinanzamtsnummer.slice(2)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "nordrhein_westfalen") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nrwBezirk}/${parts.nrwUnterscheidungsnummer}${parts.pruefziffer}`;
  if (bundesland === "rheinland_pfalz") return `${parts.bundesfinanzamtsnummer.slice(2)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "saarland") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "sachsen") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "sachsen_anhalt") return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
  if (bundesland === "schleswig_holstein") return `${parts.bundesfinanzamtsnummer.slice(2)}/${parts.nonNrwBezirk}/${uuuuP}`;
  return `${parts.bundesfinanzamtsnummer.slice(1)}/${parts.nonNrwBezirk}/${uuuuP}`;
}

export function localToElster13(value: string, options: ConversionOptions): string {
  const digits = normalizeDigits(value);
  const bundesland = options.bundesland;

  if (bundesland === "baden_wuerttemberg") {
    assertDigitsLength(digits, 10, "Baden-Wuerttemberg local Steuernummer");
    return `${bufaFromLocal(digits.slice(0, 2), bundesland, options.bundesfinanzamtsnummer)}0${digits.slice(2, 5)}${digits.slice(5, 9)}${digits.slice(9)}`;
  }
  if (bundesland === "hessen") {
    assertDigitsLength(digits, 11, "Hessen local Steuernummer");
    if (digits[0] !== "0") throw new Error("Hessen local Steuernummer must start with display zero.");
    return `${bufaFromLocal(digits.slice(0, 3), bundesland, options.bundesfinanzamtsnummer)}0${digits.slice(3, 6)}${digits.slice(6, 10)}${digits.slice(10)}`;
  }
  if (bundesland === "nordrhein_westfalen") {
    assertDigitsLength(digits, 11, "Nordrhein-Westfalen local Steuernummer");
    return `${bufaFromLocal(digits.slice(0, 3), bundesland, options.bundesfinanzamtsnummer)}0${digits.slice(3, 7)}${digits.slice(7, 10)}${digits.slice(10)}`;
  }
  if (["bayern", "brandenburg", "mecklenburg_vorpommern", "saarland", "sachsen", "sachsen_anhalt", "thueringen"].includes(bundesland)) {
    assertDigitsLength(digits, 11, "Local Steuernummer");
    return `${bufaFromLocal(digits.slice(0, 3), bundesland, options.bundesfinanzamtsnummer)}0${digits.slice(3, 6)}${digits.slice(6, 10)}${digits.slice(10)}`;
  }

  assertDigitsLength(digits, 10, "Local Steuernummer");
  return `${bufaFromLocal(digits.slice(0, 2), bundesland, options.bundesfinanzamtsnummer)}0${digits.slice(2, 5)}${digits.slice(5, 9)}${digits.slice(9)}`;
}

export function formatForDisplay(value: string, bundesland: Bundesland): string {
  const digits = normalizeDigits(value);
  return digits.length === 13 ? elster13ToLocal(digits, bundesland) : elster13ToLocal(localToElster13(digits, { bundesland }), bundesland);
}

