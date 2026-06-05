/* German Steuer-IdNr (Steuerliche Identifikationsnummer).
 *
 * Format : 11 digits.
 * Rules  : First digit ≠ 0. In the first 10 digits exactly one digit appears
 *          2 or 3 times; every other digit appears 0 or 1 times.
 * Check  : 11th digit is the ISO 7064 MOD 11,10 check digit over the first 10.
 *
 * Source : SRC-BZSt-STEUER-ID. */

import type { ValidationResult } from "./types";

const SOURCE_IDS = ["SRC-BZSt-STEUER-ID"];

/** ISO 7064 MOD 11,10 check digit over a numeric string. */
export function iso7064Mod11_10(digits: string): string {
  let p = 10;
  for (let i = 0; i < digits.length; i++) {
    let s = (Number(digits[i]) + p) % 10;
    if (s === 0) s = 10;
    p = (s * 2) % 11;
  }
  return String((11 - p) % 10);
}

function firstTenRepetitionRuleOk(first10: string): boolean {
  // Count each digit's frequency in the first 10 positions.
  const counts: Record<string, number> = {};
  for (const c of first10) counts[c] = (counts[c] ?? 0) + 1;
  const freqs = Object.values(counts);
  const repeated = freqs.filter((n) => n >= 2);
  // Exactly one digit may repeat, and at most three times.
  if (repeated.length !== 1) return false;
  if (repeated[0] !== 2 && repeated[0] !== 3) return false;
  return true;
}

export function validateSteuerId(
  raw: string | undefined,
): ValidationResult<{ normalized: string }> {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) {
    return {
      status: "not_checked",
      issues: [{ code: "STEUER_ID_EMPTY", message: "Steuer-IdNr not supplied.", severity: "info", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  if (digits.length !== 11) {
    return {
      status: "invalid",
      issues: [{ code: "STEUER_ID_LENGTH", message: "Steuer-IdNr must be exactly 11 digits.", severity: "error", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  if (digits[0] === "0") {
    return {
      status: "invalid",
      issues: [{ code: "STEUER_ID_LEADING_ZERO", message: "Steuer-IdNr cannot start with 0.", severity: "error", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  const first10 = digits.slice(0, 10);
  if (!firstTenRepetitionRuleOk(first10)) {
    return {
      status: "invalid",
      issues: [
        {
          code: "STEUER_ID_REPETITION_RULE",
          message: "First 10 digits must contain exactly one digit that repeats 2 or 3 times; others may appear at most once.",
          severity: "error",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  const expected = iso7064Mod11_10(first10);
  if (digits[10] !== expected) {
    return {
      status: "invalid",
      issues: [
        {
          code: "STEUER_ID_CHECK_DIGIT",
          message: `ISO 7064 MOD 11,10 check digit mismatch: expected '${expected}', got '${digits[10]}'.`,
          severity: "error",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  return {
    status: "valid",
    value: { normalized: digits },
    issues: [],
    sourceIds: SOURCE_IDS,
  };
}

/** Generate a synthetic Steuer-IdNr that passes the repetition rule and the
 * ISO 7064 MOD 11,10 check. Synthetic test data only. */
export function generateSteuerId(): string {
  for (let attempt = 0; attempt < 400; attempt++) {
    // Pick 7 distinct non-overlapping "singleton" digits plus one digit that
    // appears 3 times — total of 10 unique-by-rule digits in the first 10
    // positions (7 + 3 = 10).
    const allDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    // shuffle
    for (let i = allDigits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allDigits[i], allDigits[j]] = [allDigits[j], allDigits[i]];
    }
    const repeatTimes = Math.random() < 0.5 ? 2 : 3;
    const uniqueCount = 10 - repeatTimes; // 8 or 7
    const repeatDigit = allDigits[0];
    const singletons = allDigits.slice(1, 1 + uniqueCount);
    const slots: string[] = [];
    for (let i = 0; i < repeatTimes; i++) slots.push(repeatDigit);
    slots.push(...singletons);
    // shuffle slots
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    if (slots[0] === "0") continue; // first digit non-zero
    const first10 = slots.join("");
    const check = iso7064Mod11_10(first10);
    return first10 + check;
  }
  return "12345678903";
}
