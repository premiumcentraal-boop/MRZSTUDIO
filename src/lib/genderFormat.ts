/* ============================================================================
 * Country/document-specific gender formatter for synthetic test cards.
 *
 * Three distinct values are kept separate:
 *   1. user input / form value      ("M" | "F" | "V" | "X" | "Male" | ...)
 *   2. visible document display     (e.g. "M/M", "V/F", "M", "F", "")
 *   3. MRZ sex value                ("M" | "F" | "<" | "")
 *
 * Rules (synthetic data only — these are not real identity documents):
 *   NL passport + NL ID card
 *     visible: Male -> "M/M", Female -> "V/F", X/Other -> "X/X"
 *     mrz:     Male -> "M",   Female -> "F",   X/Other -> "<"
 *   DE passport
 *     visible: Male -> "M",   Female -> "F",   X/Other -> "X"
 *     mrz:     Male -> "M",   Female -> "F",   X/Other -> "<"
 *   DE ID card (Personalausweis)
 *     visible: "" (no GENDER layer is rendered)
 *     mrz:     "" (no sex field on the DE ID MRZ in this generator)
 * ========================================================================== */

export type GenderCountry = "NL" | "DE";
export type GenderDocType = "passport" | "id_card" | "driving_licence";
export type GenderTarget = "visible" | "mrz";

export type GenderCanonical = "M" | "F" | "X";

/** Normalize anything the form might emit into M / F / X. */
export function canonicalGender(input: string | null | undefined): GenderCanonical {
  const t = String(input ?? "").trim().toUpperCase();
  if (t === "M" || t === "MALE") return "M";
  if (t === "F" || t === "V" || t === "FEMALE") return "F";
  return "X";
}

export function formatGenderForDocument(opts: {
  country: GenderCountry;
  documentType: GenderDocType;
  gender: string | null | undefined;
  target: GenderTarget;
}): string {
  const { country, documentType, target } = opts;
  const g = canonicalGender(opts.gender);

  // DE Personalausweis: no visible GENDER layer, no MRZ sex.
  if (country === "DE" && documentType === "id_card") return "";

  if (target === "mrz") {
    if (g === "M") return "M";
    if (g === "F") return "F";
    return "<";
  }

  // visible
  if (country === "NL") {
    if (g === "M") return "M/M";
    if (g === "F") return "V/F";
    return "X/X";
  }
  // DE passport
  if (g === "M") return "M";
  if (g === "F") return "F";
  return "X";
}
