/* Dutch BSN — elfproef (11-test).
 *
 * Format : 9 digits (legacy 8-digit "sofinummer" accepted by zero-padding).
 * Test   : weights [9,8,7,6,5,4,3,2,-1]. Sum mod 11 must equal 0 and sum > 0.
 *
 * Source : SRC-NL-BSN-ELFPROEF (see data/sources.json). */

import type { ValidationResult } from "./types";

const SOURCE_IDS = ["SRC-NL-BSN-ELFPROEF"];
const WEIGHTS = [9, 8, 7, 6, 5, 4, 3, 2, -1];

export function validateBsn(raw: string | undefined): ValidationResult<{ normalized: string; sum: number }> {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) {
    return {
      status: "not_checked",
      issues: [{ code: "BSN_EMPTY", message: "BSN not supplied.", severity: "info", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  if (digits.length !== 8 && digits.length !== 9) {
    return {
      status: "invalid",
      issues: [{ code: "BSN_LENGTH", message: "BSN must be 8 or 9 digits.", severity: "error", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  const padded = digits.length === 8 ? "0" + digits : digits;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += WEIGHTS[i] * Number(padded[i]);
  if (sum <= 0) {
    return {
      status: "invalid",
      issues: [{ code: "BSN_ZERO_SUM", message: "BSN cannot be all zeros.", severity: "error", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  if (sum % 11 !== 0) {
    return {
      status: "invalid",
      issues: [
        {
          code: "BSN_ELFPROEF",
          message: `Elfproef failed: sum=${sum}, sum mod 11 = ${sum % 11}.`,
          severity: "error",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  return {
    status: "valid",
    value: { normalized: padded, sum },
    issues: [],
    sourceIds: SOURCE_IDS,
  };
}

/** Generate a synthetic BSN that passes the elfproef. */
export function generateBsn(): string {
  for (let attempt = 0; attempt < 256; attempt++) {
    let base = "";
    for (let i = 0; i < 8; i++) base += Math.floor(Math.random() * 10);
    let partial = 0;
    for (let i = 0; i < 8; i++) partial += WEIGHTS[i] * Number(base[i]);
    const d9 = partial % 11;
    if (d9 < 10) {
      const candidate = base + String(d9);
      if (Number(candidate) > 0) return candidate;
    }
  }
  return "111222333";
}
