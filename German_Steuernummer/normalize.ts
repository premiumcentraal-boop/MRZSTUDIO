export function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isDigits(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function leftPadDigits(value: string, length: number): string {
  const digits = normalizeDigits(value);
  if (digits.length > length) return digits;
  return digits.padStart(length, "0");
}

export function splitElster13(value: string) {
  const normalized = normalizeDigits(value);
  return {
    normalized,
    bundesfinanzamtsnummer: normalized.slice(0, 4),
    fixedZero: normalized.slice(4, 5),
    nonNrwBezirk: normalized.slice(5, 8),
    nonNrwUnterscheidungsnummer: normalized.slice(8, 12),
    nrwBezirk: normalized.slice(5, 9),
    nrwUnterscheidungsnummer: normalized.slice(9, 12),
    pruefziffer: normalized.slice(12, 13),
  };
}

