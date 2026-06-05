import { BZST_IDNR_SOURCE, ELSTER_STEUERNUMMER_SOURCE } from "../steuernummer/types.ts";

export type SteuerIdChecksumResult = {
  check_digit: string;
  source_refs: string[];
};

export function calculateSteuerIdCheckDigit(first10Digits: string): SteuerIdChecksumResult {
  if (!/^[0-9]{10}$/.test(first10Digits)) {
    throw new Error("Steuer-ID checksum input must be exactly the first 10 digits.");
  }
  let product = 10;
  for (const character of first10Digits) {
    let sum = (Number(character) + product) % 10;
    if (sum === 0) sum = 10;
    product = (2 * sum) % 11;
  }
  const rawCheck = 11 - product;
  return {
    check_digit: String(rawCheck === 10 ? 0 : rawCheck),
    source_refs: [ELSTER_STEUERNUMMER_SOURCE, BZST_IDNR_SOURCE],
  };
}

export function passesSteuerIdRepetitionRule(first10Digits: string): boolean {
  if (!/^[0-9]{10}$/.test(first10Digits)) return false;
  const counts = new Map<string, number>();
  for (const digit of first10Digits) counts.set(digit, (counts.get(digit) ?? 0) + 1);
  const repeated = [...counts.entries()].filter(([, count]) => count > 1);
  if (repeated.length !== 1) return false;
  const [digit, count] = repeated[0];
  if (count !== 2 && count !== 3) return false;
  if (count === 3 && first10Digits.includes(`${digit}${digit}`)) return false;
  return true;
}
