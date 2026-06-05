import { type CheckResult } from "../core/types";
import { BZST_IDNR_SOURCE, SYNTHETIC_STEUERNUMMER_WARNING } from "../steuernummer/types";
import { calculateSteuerIdCheckDigit, passesSteuerIdRepetitionRule } from "./checksum";

export type SteuerIdValidationResult = {
  valid_structure: boolean;
  valid_checksum: boolean;
  normalized: string | null;
  warnings: string[];
  errors: Array<{ code: string; message: string; source_refs: string[] }>;
  checks: CheckResult[];
  structural_only: true;
  assigned_or_active_verified: false;
};

function check(name: string, passed: boolean, details: string): CheckResult {
  return { name, passed, details };
}

function error(code: string, message: string) {
  return { code, message, source_refs: [BZST_IDNR_SOURCE] };
}

export function validate(value: string, options: { allow_official_test_leading_zero?: boolean; debug?: boolean } = {}): SteuerIdValidationResult {
  const normalized = value.replace(/\D/g, "");
  const errors: Array<{ code: string; message: string; source_refs: string[] }> = [];
  const checks: CheckResult[] = [];

  checks.push(check("digits_only", /^[0-9\s/.-]+$/.test(value), "Only digits and display separators are accepted."));
  checks.push(check("length", normalized.length === 11, "Steuer-ID must contain 11 digits."));
  if (!/^[0-9\s/.-]+$/.test(value)) errors.push(error("non_numeric", "Input contains characters other than digits and display separators."));
  if (normalized.length !== 11) errors.push(error("invalid_length", "Steuer-ID must contain exactly 11 digits."));

  if (normalized.length === 11) {
    const leadingZeroOk = normalized[0] !== "0" || options.allow_official_test_leading_zero === true;
    checks.push(check("leading_zero", leadingZeroOk, "First digit normally cannot be zero except official test cases."));
    if (!leadingZeroOk) errors.push(error("leading_zero_not_allowed", "First digit normally cannot be zero except official test cases."));

    const repetitionOk = passesSteuerIdRepetitionRule(normalized.slice(0, 10));
    checks.push(check("repetition_rule", repetitionOk, "First ten digits must satisfy the official repetition rule."));
    if (!repetitionOk) errors.push(error("invalid_repetition_rule", "First ten digits do not satisfy the official repetition rule."));

    const checksum = calculateSteuerIdCheckDigit(normalized.slice(0, 10));
    const checksumOk = checksum.check_digit === normalized[10];
    checks.push(check("checksum", checksumOk, checksumOk ? "Passed ISO 7064 MOD 11,10." : options.debug ? `Failed ISO 7064 MOD 11,10; expected ${checksum.check_digit}.` : "Failed ISO 7064 MOD 11,10."));
    if (!checksumOk) errors.push(error("invalid_checksum", "Checksum failed. Public output intentionally does not disclose the replacement check digit."));
  }

  const validStructure = errors.every((item) => item.code === "invalid_checksum");
  const validChecksum = checks.find((item) => item.name === "checksum")?.passed === true;

  return {
    valid_structure: validStructure,
    valid_checksum: validChecksum,
    normalized: normalized || null,
    warnings: [
      SYNTHETIC_STEUERNUMMER_WARNING,
      "Steuer-ID is not a Steuernummer. It encodes no Bundesland, Finanzamt, city, gender, or birthdate.",
    ],
    errors,
    checks,
    structural_only: true,
    assigned_or_active_verified: false,
  };
}

