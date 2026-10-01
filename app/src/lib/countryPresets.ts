/* ============================================================================
 * Country presets for the ID Generator
 *
 * Each preset binds a country to its ICAO 9303 issuer code, nationality demonym,
 * default document layout (TD1 for ID cards, TD3 for passports), gender options
 * accepted on the card, expiry conventions, and the country-specific
 * personal-number generator/validator (NL = BSN elfproef, DE = Steuer-ID IdNr).
 *
 * Selecting a country in the UI should auto-fill issuer + nationality and swap
 * the personal-number generator. Selecting a document type swaps between TD1
 * and TD3 layouts so the MRZ builder receives the right format.
 * ========================================================================== */

import { isValidBSN } from "./mrz";
import {
  generateBSN,
  generateSyntheticGermanSteuerId,
  validateGermanSteuerId,
} from "../app/steps/nl-tools-step";
import {
  generateSteuerId as libGenerateSteuerId,
  validateSteuerId as libValidateSteuerId,
} from "./german-id-validation";

export type CountryCode = "NL" | "DE" | "OTHER";
export type DocType = "id_card" | "passport" | "driving_licence";

export type GenderOption = { value: "M" | "F" | "X"; label: string };

export type CountryPreset = {
  code: CountryCode;
  label: string;                  // Human label for the dropdown
  issuerCode: string;             // ICAO 3-letter issuer (e.g. "NLD", "D<<")
  nationalityCode: string;        // ICAO 3-letter nationality
  nationalityDemonym: string;     // Free-text demonym for the printed card
  defaultDocType: DocType;
  supportedDocTypes: DocType[];
  genderOptions: GenderOption[];
  /** Maximum validity in years from issue date for adult holders. */
  maxValidityYears: number;
  personalNumber: {
    label: string;
    placeholder: string;
    /** Returns a synthetic, mathematically valid personal number. */
    generate: () => string;
    /** Returns null on success, or a short error string. */
    validate: (v: string) => string | null;
    /** ICAO MRZ width for the personal-data field for the chosen doc type. */
    mrzWidth: 14 | 0;
  };
};

const FREEFORM_PERSONAL = {
  label: "Personal Number",
  placeholder: "123456789",
  generate: () => {
    let s = "";
    for (let i = 0; i < 9; i++) s += Math.floor(Math.random() * 10).toString();
    return s;
  },
  validate: (v: string) =>
    /^[A-Z0-9<]{1,14}$/i.test(v.replace(/\s/g, ""))
      ? null
      : "Up to 14 alphanumeric characters",
  mrzWidth: 14 as const,
};

export const COUNTRY_PRESETS: Record<CountryCode, CountryPreset> = {
  NL: {
    code: "NL",
    label: "Netherlands",
    issuerCode: "NLD",
    nationalityCode: "NLD",
    nationalityDemonym: "Nederlandse",
    defaultDocType: "id_card",
    // NL adds driving licence — model selection (2014 vs 2025) is resolved
    // from the form's issue date by src/lib/dutch-id-validation/modelSeries.ts.
    supportedDocTypes: ["id_card", "passport", "driving_licence"],
    // NL paspoort/NIK supports M / V / X (gender-neutral X introduced 2018).
    genderOptions: [
      { value: "M", label: "Male" },
      { value: "F", label: "Female" },
      { value: "X", label: "Unspecified (X)" },
    ],
    maxValidityYears: 10,
    personalNumber: {
      label: "BSN Number",
      placeholder: "123456782",
      generate: generateBSN,
      validate: (v) => (isValidBSN(v) ? null : "Fails BSN elfproef (11-test)"),
      // The 2014 NIK (and older Dutch passports/ID cards) encode the BSN in the
      // MRZ optional-data field. The 2021+ NIK redesign removed BSN from the MRZ.
      // Width is set to 9 so the BSN reaches line 1 optional data on pre-2021 cards;
      // 2021+ generation should override this to 0 based on issue date.
      mrzWidth: 9,
    },
  },
  DE: {
    code: "DE",
    label: "Germany",
    issuerCode: "D<<",
    nationalityCode: "D<<",
    nationalityDemonym: "Deutsch",
    defaultDocType: "id_card",
    // DE adds driving licence — model selection (2013/2021/2025) is resolved
    // from the form's issue date by src/lib/german-id-validation/modelSeries.ts.
    supportedDocTypes: ["id_card", "passport", "driving_licence"],
    // Personalausweis since 2018-12 accepts "divers" (X) alongside M / F.
    genderOptions: [
      { value: "M", label: "Male" },
      { value: "F", label: "Female" },
      { value: "X", label: "Diverse (X)" },
    ],
    maxValidityYears: 10,
    personalNumber: {
      label: "Steuer-ID (IdNr)",
      placeholder: "86 095 742 719",
      generate: () => libGenerateSteuerId(),
      validate: (v) =>
        libValidateSteuerId(v).status === "valid"
          ? null
          : "Invalid Steuer-ID (check digit or distribution)",
      // DE Personalausweis / Reisepass leaves the optional MRZ field as filler.
      mrzWidth: 0,
    },
  },
  OTHER: {
    code: "OTHER",
    label: "Other / Generic",
    issuerCode: "UTO",
    nationalityCode: "UTO",
    nationalityDemonym: "",
    defaultDocType: "id_card",
    supportedDocTypes: ["id_card", "passport"],
    genderOptions: [
      { value: "M", label: "Male" },
      { value: "F", label: "Female" },
      { value: "X", label: "Unspecified (X)" },
    ],
    maxValidityYears: 10,
    personalNumber: FREEFORM_PERSONAL,
  },
};

export const COUNTRY_LIST: CountryCode[] = ["NL", "DE", "OTHER"];

export function getCountryPreset(code: string | undefined | null): CountryPreset {
  if (code && code in COUNTRY_PRESETS) return COUNTRY_PRESETS[code as CountryCode];
  return COUNTRY_PRESETS.OTHER;
}

export function docTypeLabel(t: DocType): string {
  if (t === "passport") return "Passport (TD3)";
  if (t === "driving_licence") return "Driving licence";
  return "ID Card (TD1)";
}

/** Document-code prefix used in MRZ line 1. */
export function mrzDocumentCode(t: DocType): string {
  if (t === "passport") return "P<";
  if (t === "driving_licence") return "DL"; // surface label only — no ICAO MRZ
  return "I<";
}

/**
 * Holders under 18 on the issue date receive a 5-year document instead of the
 * country's adult cap (NL & DE both apply this rule to ID cards and passports).
 */
export function validityYearsForHolder(
  birthIso: string,
  issueIso: string,
  adultMaxYears: number,
): number {
  if (!birthIso || !issueIso) return adultMaxYears;
  const b = new Date(birthIso + "T00:00:00Z");
  const i = new Date(issueIso + "T00:00:00Z");
  if (Number.isNaN(b.getTime()) || Number.isNaN(i.getTime())) return adultMaxYears;
  let age = i.getUTCFullYear() - b.getUTCFullYear();
  const m = i.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && i.getUTCDate() < b.getUTCDate())) age--;
  return age < 18 ? 5 : adultMaxYears;
}

/** Default expiry ISO date `maxYears` from `fromIso` (yyyy-mm-dd). */
export function defaultExpiry(fromIso: string, maxYears: number): string {
  if (!fromIso) return "";
  const d = new Date(fromIso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCFullYear(d.getUTCFullYear() + maxYears);
  return d.toISOString().slice(0, 10);
}

/** Clamp an expiry against the country's max validity window from valid_from. */
export function clampExpiry(
  validFromIso: string,
  expiresIso: string,
  maxYears: number,
): { ok: boolean; clampedTo?: string; message?: string } {
  if (!validFromIso || !expiresIso) return { ok: true };
  const from = new Date(validFromIso + "T00:00:00Z").getTime();
  const exp = new Date(expiresIso + "T00:00:00Z").getTime();
  if (Number.isNaN(from) || Number.isNaN(exp)) return { ok: true };
  if (exp < from) {
    return { ok: false, message: "Expiry is before valid-from date." };
  }
  const maxMs = maxYears * 365.25 * 24 * 60 * 60 * 1000;
  if (exp - from > maxMs + 24 * 60 * 60 * 1000) {
    return {
      ok: false,
      clampedTo: defaultExpiry(validFromIso, maxYears),
      message: `Exceeds ${maxYears}-year validity for ${maxYears === 10 ? "adult" : "this"} document.`,
    };
  }
  return { ok: true };
}
