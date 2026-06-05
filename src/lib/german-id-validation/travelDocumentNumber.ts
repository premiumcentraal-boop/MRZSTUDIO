/* German passport / Personalausweis document number.
 *
 * Structure:
 *   9 alphanumeric characters. The first 8 carry information; position 9 is
 *   the ICAO 9303 mod-10 check digit (weights [7,3,1] cycled over pos 1–8).
 *   Letters I and O are avoided to prevent confusion with digits 1 and 0
 *   (Bundesdruckerei practice).
 *
 * Sources: SRC-BUNDESDRUCKEREI-DOCNUM, SRC-BMI-PERSONALAUSWEIS,
 *          SRC-BMI-REISEPASS, SRC-ICAO-9303. */

import type { ValidationResult } from "./types";

const DOC_ALPHABET = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, no O
const WEIGHTS = [7, 3, 1, 7, 3, 1, 7, 3];

const SOURCE_IDS = [
  "SRC-BUNDESDRUCKEREI-DOCNUM",
  "SRC-BMI-PERSONALAUSWEIS",
  "SRC-BMI-REISEPASS",
];

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

export function validateGermanTravelDocumentNumber(
  raw: string | undefined,
): ValidationResult<{ normalized: string; expected: string; sum: number }> {
  const v = (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!v) {
    return {
      status: "not_checked",
      issues: [
        { code: "DOCNUM_EMPTY", message: "Document number not supplied.", severity: "info", sourceIds: SOURCE_IDS },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (v.length !== 9) {
    return {
      status: "invalid",
      issues: [
        { code: "DOCNUM_LENGTH", message: "Document number must be exactly 9 characters.", severity: "error", sourceIds: SOURCE_IDS },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (/[IO]/.test(v.slice(0, 8))) {
    return {
      status: "invalid",
      issues: [
        {
          code: "DOCNUM_LETTERS_IO",
          message: "Letters I and O are avoided in German document numbers to prevent ambiguity with 1 and 0.",
          severity: "error",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (!/^[A-Z0-9]{8}[0-9]$/.test(v)) {
    return {
      status: "invalid",
      issues: [
        {
          code: "DOCNUM_STRUCTURE",
          message: "Document number must be 8 alphanumerics followed by a check digit.",
          severity: "error",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
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
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  return {
    status: "valid",
    value: { normalized: v, expected, sum },
    issues: [],
    sourceIds: SOURCE_IDS,
  };
}

/** Generate a synthetic German document number that passes the ICAO mod-10
 * check. Avoids letters I and O. Synthetic test data only. */
export function generateGermanTravelDocumentNumber(): string {
  for (let attempt = 0; attempt < 400; attempt++) {
    let base = "";
    for (let i = 0; i < 8; i++) base += DOC_ALPHABET[Math.floor(Math.random() * DOC_ALPHABET.length)];
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += charValue(base[i]) * WEIGHTS[i];
    return base + String(sum % 10);
  }
  return "AB1234562";
}
