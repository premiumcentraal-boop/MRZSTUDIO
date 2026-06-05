import { validateCheckDigit } from "./checksums.ts";
import { elster13ToLocal, localToElster13 } from "./convert.ts";
import { detectBundeslandCandidates, detectBundeslandFromElster13, detectFormat } from "./detect.ts";
import { getRule } from "./rules.ts";
import { isDigits, normalizeDigits, splitElster13 } from "./normalize.ts";
import {
  ELSTER_STEUERNUMMER_SOURCE,
  SYNTHETIC_STEUERNUMMER_WARNING,
  type Bundesland,
  type SteuernummerValidationOptions,
  type SteuernummerValidationResult,
  type ValidationIssue,
} from "./types.ts";
import type { CheckResult } from "../core/types.ts";

function issue(code: string, message: string): ValidationIssue {
  return { code, message, source_refs: [ELSTER_STEUERNUMMER_SOURCE] };
}

function check(name: string, passed: boolean, details: string): CheckResult {
  return { name, passed, details };
}

function firstOrNull<T>(values: T[]): T | null {
  return values.length === 1 ? values[0] : null;
}

function regionStructureErrors(elster13: string, bundesland: Bundesland): ValidationIssue[] {
  const parts = splitElster13(elster13);
  const errors: ValidationIssue[] = [];
  const bezirk = bundesland === "nordrhein_westfalen" ? parts.nrwBezirk : parts.nonNrwBezirk;
  const unterscheidung = bundesland === "nordrhein_westfalen" ? parts.nrwUnterscheidungsnummer : parts.nonNrwUnterscheidungsnummer;
  const rule = getRule(bundesland);

  if (!parts.bundesfinanzamtsnummer.startsWith(rule.bufaPrefix)) {
    errors.push(issue("bufa_region_mismatch", `Bundesfinanzamtsnummer does not match ${rule.displayName} structural prefix.`));
  }

  if (bundesland === "nordrhein_westfalen") {
    if (["0000", "0998", "0999"].includes(bezirk)) {
      errors.push(issue("invalid_bezirk", "NRW Bezirk must not be 0000, 0998, or 0999."));
    }
    if (Number(`${unterscheidung}${parts.pruefziffer}`) <= 9) {
      errors.push(issue("invalid_unterscheidungsnummer", "NRW combined UUUP must be greater than 0009."));
    }
  } else {
    if (["000", "998", "999"].includes(bezirk)) {
      errors.push(issue("invalid_bezirk", "Bezirk must not be 000, 998, or 999."));
    }
    if (rule.minBezirk !== undefined && Number(bezirk) < rule.minBezirk) {
      errors.push(issue("invalid_bezirk", `${rule.displayName} Bezirk must be at least ${rule.minBezirk}.`));
    }
    if (bundesland === "bayern" && bezirk === "999" && unterscheidung === "9999" && parts.pruefziffer === "9") {
      errors.push(issue("invalid_bayern_combination", "Bayern combination 999/9999/9 is forbidden."));
    }
  }

  return errors;
}

export function validate(value: string, options: SteuernummerValidationOptions = {}): SteuernummerValidationResult {
  const warnings = [SYNTHETIC_STEUERNUMMER_WARNING];
  const errors: ValidationIssue[] = [];
  const checks: CheckResult[] = [];
  const inputDigits = normalizeDigits(value);
  const inputHasOnlyDigitsAndSeparators = /^[0-9\s/.-]+$/.test(value);
  const formatDetected = detectFormat(value);
  let normalized: string | null = null;
  let bundesland: Bundesland | null = null;

  checks.push(check("numeric_or_display_separators", inputHasOnlyDigitsAndSeparators, "Only digits and common display separators are accepted."));
  if (!inputHasOnlyDigitsAndSeparators) errors.push(issue("non_numeric", "Input contains characters other than digits and display separators."));

  try {
    if (formatDetected === "elster_13") {
      normalized = inputDigits;
      bundesland = detectBundeslandFromElster13(normalized, options.bundesland);
    } else if (formatDetected === "local" && options.bundesland) {
      normalized = localToElster13(value, { bundesland: options.bundesland, allow_legacy_formats: options.allow_legacy_formats });
      bundesland = options.bundesland;
    } else {
      errors.push(issue("invalid_length", "Input must be ELSTER 13 digits or a local format with Bundesland context."));
    }
  } catch (error) {
    errors.push(issue("conversion_failed", error instanceof Error ? error.message : "Local-to-ELSTER conversion failed."));
  }

  if (!normalized) {
    checks.push(check("length", false, "No normalized 13-digit ELSTER value could be produced."));
    return {
      valid_structure: false,
      valid_checksum: false,
      bundesland_detected: null,
      method_used: null,
      format_detected: formatDetected,
      normalized: null,
      formatted: null,
      field_breakdown: {},
      warnings,
      errors,
      checks,
      structural_only: true,
      assigned_or_active_verified: false,
    };
  }

  const parts = splitElster13(normalized);
  const candidates = detectBundeslandCandidates(normalized);
  bundesland = options.bundesland || firstOrNull(candidates);

  checks.push(check("length", normalized.length === 13, "ELSTER Steuernummer must be exactly 13 digits."));
  checks.push(check("digits_only", isDigits(normalized), "ELSTER Steuernummer allows digits only."));
  checks.push(check("fixed_zero_position_5", parts.fixedZero === "0", "ELSTER position 5 must be fixed zero."));
  if (normalized.length !== 13) errors.push(issue("invalid_length", "ELSTER Steuernummer must be exactly 13 digits."));
  if (!isDigits(normalized)) errors.push(issue("non_numeric", "ELSTER Steuernummer must contain digits only."));
  if (parts.fixedZero !== "0") errors.push(issue("fixed_zero_violation", "Position 5 must be 0."));

  if (!bundesland) {
    errors.push(issue("ambiguous_bundesland", candidates.length > 1 ? `Bundesland is ambiguous: ${candidates.join(", ")}.` : "Bundesland could not be detected from the Finanzamt prefix."));
  }

  if (options.strict_official_ranges) {
    errors.push(issue("official_finanzamtsdaten_not_configured", "Strict official Finanzamtsdaten validation requires a bundled current ELSTER Finanzamtsdaten file."));
  } else {
    warnings.push("Bundesfinanzamtsnummer is structurally checked only. No official Finanzamtsdaten list or real assignment lookup was used.");
  }

  let validChecksum = false;
  let methodUsed = null;
  if (bundesland) {
    errors.push(...regionStructureErrors(normalized, bundesland));
    try {
      const checksum = validateCheckDigit(normalized, bundesland);
      methodUsed = checksum.method_used;
      validChecksum = checksum.passed;
      checks.push(check("checksum", checksum.passed, checksum.passed ? `Passed ${checksum.method_used}.` : options.debug && checksum.check_digit !== null ? `Failed ${checksum.method_used}; expected ${checksum.check_digit}.` : `Failed ${checksum.method_used}.`));
      if (!checksum.passed) errors.push(issue("invalid_checksum", "Checksum failed. Public output intentionally does not disclose the replacement check digit."));
      if (checksum.invalid_remainder) errors.push(issue("invalid_checksum_remainder", "Checksum equation produced an invalid two-digit check value."));
    } catch (error) {
      errors.push(issue("checksum_error", error instanceof Error ? error.message : "Checksum calculation failed."));
    }
  } else {
    checks.push(check("checksum", false, "Checksum method requires a known or supplied Bundesland."));
  }

  const structureErrors = errors.filter((error) => !["invalid_checksum", "invalid_checksum_remainder"].includes(error.code));
  return {
    valid_structure: structureErrors.length === 0,
    valid_checksum: validChecksum,
    bundesland_detected: bundesland,
    method_used: methodUsed,
    format_detected: formatDetected,
    normalized,
    formatted: bundesland ? elster13ToLocal(normalized, bundesland) : null,
    field_breakdown: {
      bundesfinanzamtsnummer: parts.bundesfinanzamtsnummer,
      bezirk_number: bundesland === "nordrhein_westfalen" ? parts.nrwBezirk : parts.nonNrwBezirk,
      unterscheidungsnummer: bundesland === "nordrhein_westfalen" ? parts.nrwUnterscheidungsnummer : parts.nonNrwUnterscheidungsnummer,
      pruefziffer: parts.pruefziffer,
    },
    warnings,
    errors,
    checks,
    structural_only: true,
    assigned_or_active_verified: false,
  };
}

