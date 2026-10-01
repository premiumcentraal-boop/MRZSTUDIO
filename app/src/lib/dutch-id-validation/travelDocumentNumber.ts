/* Dutch passport / identity-card document number.
 *
 * Universal structure (all eras):
 *   Pos 1-2 : letters only
 *   Pos 3-8 : letters or digits
 *   Pos 9   : digit (ICAO 9303 mod-10 check, weights [7,3,1] over the first 8)
 *   Letter 'O' is never used.
 *
 * Era split (driven by RvIG's 1 Dec 2019 rule change):
 *   "pre-2019"  — 2014 model issued 9 Mar 2014 → 30 Nov 2019.
 *                  digit '0' IS allowed anywhere, pos 9 may be 0–9.
 *   "post-2019" — 2014 model from 1 Dec 2019 onwards, 2021 ID card
 *                  (from 2 Aug 2021), 2021 passport (from 30 Aug 2021),
 *                  2024 passport: digit '0' is NOT used anywhere,
 *                  pos 9 must be 1–9.
 *
 * Sources: SRC-RVIG-DOCNUM-RULES, SRC-RVIG-ID-CARD-2021,
 *          SRC-RVIG-PASSPORT-2021, SRC-RVIG-PASSPORT-2024. */

import type { ValidationResult } from "./types";

export type DocumentNumberEra = "pre-2019" | "post-2019";

const DOC_LETTERS = "ABCDEFGHIJKLMNPQRSTUVWXYZ"; // no 'O'
const DOC_ALPHANUM_PRE = "ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789";
const DOC_ALPHANUM_POST = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
const WEIGHTS = [7, 3, 1, 7, 3, 1, 7, 3];

const SOURCE_BY_ERA: Record<DocumentNumberEra, string[]> = {
  "pre-2019": ["SRC-RVIG-DOCNUM-RULES"],
  "post-2019": [
    "SRC-RVIG-DOCNUM-RULES",
    "SRC-RVIG-ID-CARD-2021",
    "SRC-RVIG-PASSPORT-2021",
    "SRC-RVIG-PASSPORT-2024",
  ],
};

function charValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return -1;
}

/** ICAO 9303 mod-10 check over an arbitrary MRZ field. */
export function icaoMrzCheckDigit(field: string): string {
  const W = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field[i];
    let v: number;
    if (c === "<") v = 0;
    else if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "A" && c <= "Z") v = c.charCodeAt(0) - 55;
    else v = 0;
    sum += v * W[i % 3];
  }
  return String(sum % 10);
}

export function validateDutchTravelDocumentNumber(
  raw: string | undefined,
  era: DocumentNumberEra = "post-2019",
): ValidationResult<{ normalized: string; expected: string; sum: number; era: DocumentNumberEra }> {
  const sources = SOURCE_BY_ERA[era];
  const v = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!v) {
    return {
      status: "not_checked",
      issues: [{ code: "DOCNUM_EMPTY", message: "Document number not supplied.", severity: "info", sourceIds: sources }],
      sourceIds: sources,
    };
  }
  if (v.length !== 9) {
    return {
      status: "invalid",
      issues: [{ code: "DOCNUM_LENGTH", message: "Document number must be exactly 9 characters.", severity: "error", sourceIds: sources }],
      sourceIds: sources,
    };
  }
  if (v.includes("O")) {
    return {
      status: "invalid",
      issues: [{ code: "DOCNUM_LETTER_O", message: "Letter 'O' is never used in Dutch documents.", severity: "error", sourceIds: sources }],
      sourceIds: sources,
    };
  }
  if (era === "post-2019" && v.includes("0")) {
    return {
      status: "invalid",
      issues: [{ code: "DOCNUM_DIGIT_ZERO", message: "Digit '0' is not used in Dutch documents issued from 1 Dec 2019.", severity: "error", sourceIds: sources }],
      sourceIds: sources,
    };
  }
  const structureRegex =
    era === "post-2019" ? /^[A-Z]{2}[A-Z1-9]{6}[1-9]$/ : /^[A-Z]{2}[A-Z0-9]{6}[0-9]$/;
  if (!structureRegex.test(v)) {
    if (!/^[A-Z]{2}/.test(v)) {
      return {
        status: "invalid",
        issues: [{ code: "DOCNUM_STRUCTURE_POS_1_2", message: "Positions 1–2 must be letters.", severity: "error", sourceIds: sources }],
        sourceIds: sources,
      };
    }
    if (era === "post-2019" && !/[1-9]$/.test(v)) {
      return {
        status: "invalid",
        issues: [{ code: "DOCNUM_STRUCTURE_POS_9", message: "Position 9 must be a digit 1–9.", severity: "error", sourceIds: sources }],
        sourceIds: sources,
      };
    }
    return {
      status: "invalid",
      issues: [{ code: "DOCNUM_STRUCTURE", message: "Document number format does not match RvIG rules.", severity: "error", sourceIds: sources }],
      sourceIds: sources,
    };
  }
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += charValue(v[i]) * WEIGHTS[i];
  const expected = String(sum % 10);
  if (v[8] !== expected) {
    return {
      status: "invalid",
      issues: [
        {
          code: "DOCNUM_ICAO_CHECK",
          message: `ICAO mod-10 check digit mismatch: expected '${expected}', got '${v[8]}'.`,
          severity: "error",
          sourceIds: sources,
        },
      ],
      sourceIds: sources,
    };
  }
  return {
    status: "valid",
    value: { normalized: v, expected, sum, era },
    issues: [],
    sourceIds: sources,
  };
}

export function generateDutchTravelDocumentNumber(era: DocumentNumberEra = "post-2019"): string {
  const alphanum = era === "post-2019" ? DOC_ALPHANUM_POST : DOC_ALPHANUM_PRE;
  for (let attempt = 0; attempt < 400; attempt++) {
    let base =
      DOC_LETTERS[Math.floor(Math.random() * DOC_LETTERS.length)] +
      DOC_LETTERS[Math.floor(Math.random() * DOC_LETTERS.length)];
    for (let i = 2; i < 8; i++) base += alphanum[Math.floor(Math.random() * alphanum.length)];
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += charValue(base[i]) * WEIGHTS[i];
    const d9 = sum % 10;
    if (era === "post-2019" ? d9 >= 1 && d9 <= 9 : d9 >= 0 && d9 <= 9) {
      return base + String(d9);
    }
  }
  return era === "post-2019" ? "AB123451" : "AB000000";
}
