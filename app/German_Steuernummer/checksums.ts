import {
  FACTORS_11ER_BAYERN_STYLE,
  FACTORS_11ER_BREMEN_HAMBURG,
  FACTORS_11ER_NIEDERSACHSEN,
  FACTORS_BERLIN_A,
  FACTORS_BERLIN_B,
  FACTORS_NRW,
  RHEINLAND_PFALZ_FACTORS,
  TWOER_FACTORS,
  TWOER_SUMMANDS,
  detectBerlinMethod,
  getRule,
} from "./rules.ts";
import { ELSTER_STEUERNUMMER_SOURCE, type Bundesland, type SteuernummerMethod } from "./types.ts";
import { isDigits, splitElster13 } from "./normalize.ts";

export type CheckDigitCalculation = {
  check_digit: string | null;
  method_used: SteuernummerMethod;
  sum: number;
  invalid_remainder: boolean;
  source_refs: string[];
};

function digits12(value: string): number[] {
  if (value.length !== 12 || !isDigits(value)) {
    throw new Error("Checksum input must be exactly 12 digits.");
  }
  return value.split("").map((digit) => Number(digit));
}

function digitalRoot(value: number): number {
  let current = value;
  while (current > 9) {
    current = String(current)
      .split("")
      .reduce((sum, digit) => sum + Number(digit), 0);
  }
  return current;
}

function calc2er(input12: string): CheckDigitCalculation {
  const digits = digits12(input12);
  const sum = digits.reduce((total, digit, index) => {
    const prepared = (digit + TWOER_SUMMANDS[index]) % 10;
    return total + digitalRoot(prepared * TWOER_FACTORS[index]);
  }, 0);
  return {
    check_digit: String((10 - (sum % 10)) % 10),
    method_used: "2er",
    sum,
    invalid_remainder: false,
    source_refs: [ELSTER_STEUERNUMMER_SOURCE],
  };
}

function calcModifiedRheinlandPfalz(input12: string): CheckDigitCalculation {
  const digits = digits12(input12);
  const sum = digits.reduce((total, digit, index) => {
    const product = digit * RHEINLAND_PFALZ_FACTORS[index];
    return total + (product >= 10 ? (product % 10) + 1 : product);
  }, 0);
  return {
    check_digit: String((10 - (sum % 10)) % 10),
    method_used: "11er_modified_rheinland_pfalz",
    sum,
    invalid_remainder: false,
    source_refs: [ELSTER_STEUERNUMMER_SOURCE],
  };
}

function calc11er(input12: string, factors: readonly number[], method: SteuernummerMethod): CheckDigitCalculation {
  const digits = digits12(input12);
  const sum = digits.reduce((total, digit, index) => total + digit * factors[index], 0);
  const check = (11 - (sum % 11)) % 11;
  return {
    check_digit: check > 9 ? null : String(check),
    method_used: method,
    sum,
    invalid_remainder: check > 9,
    source_refs: [ELSTER_STEUERNUMMER_SOURCE],
  };
}

function calcNrw(input12: string): CheckDigitCalculation {
  const digits = digits12(input12);
  const sum = digits.reduce((total, digit, index) => total + digit * FACTORS_NRW[index], 0);
  const check = sum % 11;
  return {
    check_digit: check > 9 ? null : String(check),
    method_used: "11er_nrw_remainder",
    sum,
    invalid_remainder: check > 9,
    source_refs: [ELSTER_STEUERNUMMER_SOURCE],
  };
}

function factorsFor11er(bundesland: Bundesland): readonly number[] {
  if (bundesland === "bremen" || bundesland === "hamburg") return FACTORS_11ER_BREMEN_HAMBURG;
  if (bundesland === "niedersachsen") return FACTORS_11ER_NIEDERSACHSEN;
  return FACTORS_11ER_BAYERN_STYLE;
}

export function calculateCheckDigit(input12: string, bundesland: Bundesland): CheckDigitCalculation {
  const rule = getRule(bundesland);
  if (rule.method === "2er") return calc2er(input12);
  if (rule.method === "11er_modified_rheinland_pfalz") return calcModifiedRheinlandPfalz(input12);
  if (rule.method === "11er_nrw_remainder") return calcNrw(input12);
  if (rule.method === "berlin") {
    const parts = splitElster13(`${input12}0`);
    const method = detectBerlinMethod(parts.bundesfinanzamtsnummer, parts.nonNrwBezirk);
    return calc11er(input12, method === "berlin_a" ? FACTORS_BERLIN_A : FACTORS_BERLIN_B, method);
  }
  return calc11er(input12, factorsFor11er(bundesland), "11er");
}

export function validateCheckDigit(elster13: string, bundesland: Bundesland): CheckDigitCalculation & { passed: boolean } {
  if (elster13.length !== 13 || !isDigits(elster13)) {
    throw new Error("Checksum validation input must be exactly 13 digits.");
  }
  const calculation = calculateCheckDigit(elster13.slice(0, 12), bundesland);
  return {
    ...calculation,
    passed: calculation.check_digit !== null && calculation.check_digit === elster13[12],
  };
}

