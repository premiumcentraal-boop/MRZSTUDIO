/* ============================================================================
 * IBAN — validate, generate, and break down per SWIFT ISO 13616 registry.
 *
 * Synthetic test data only. MOD97 checksum confirmed for every country in
 * the registry below. Domestic BBAN sub-checks (national check digits, bank
 * code lookups) are NOT performed.
 * ========================================================================== */

export type IbanCountry = {
  code: string;
  name: string;
  length: number;
  // Pattern uses a tiny DSL: groups of (count, kind) where kind is n|a|c
  // n = digits 0-9, a = uppercase A-Z, c = alnum [0-9A-Z]
  bban: ReadonlyArray<readonly [number, "n" | "a" | "c"]>;
  // Optional offsets within the BBAN to label fields in the breakdown.
  fields?: {
    bank?: [number, number];
    branch?: [number, number];
    account?: [number, number];
  };
};

export const IBAN_REGISTRY: ReadonlyArray<IbanCountry> = [
  { code: "NL", name: "Netherlands", length: 18, bban: [[4, "a"], [10, "n"]], fields: { bank: [0, 4], account: [4, 14] } },
  { code: "DE", name: "Germany", length: 22, bban: [[8, "n"], [10, "n"]], fields: { bank: [0, 8], account: [8, 18] } },
  { code: "FR", name: "France", length: 27, bban: [[5, "n"], [5, "n"], [11, "c"], [2, "n"]], fields: { bank: [0, 5], branch: [5, 10], account: [10, 21] } },
  { code: "BE", name: "Belgium", length: 16, bban: [[3, "n"], [7, "n"], [2, "n"]], fields: { bank: [0, 3], account: [3, 10] } },
  { code: "ES", name: "Spain", length: 24, bban: [[4, "n"], [4, "n"], [1, "n"], [1, "n"], [10, "n"]], fields: { bank: [0, 4], branch: [4, 8], account: [10, 20] } },
  { code: "IT", name: "Italy", length: 27, bban: [[1, "a"], [5, "n"], [5, "n"], [12, "c"]], fields: { bank: [1, 6], branch: [6, 11], account: [11, 23] } },
  { code: "AT", name: "Austria", length: 20, bban: [[5, "n"], [11, "n"]], fields: { bank: [0, 5], account: [5, 16] } },
  { code: "PT", name: "Portugal", length: 25, bban: [[4, "n"], [4, "n"], [11, "n"], [2, "n"]], fields: { bank: [0, 4], branch: [4, 8], account: [8, 19] } },
  { code: "IE", name: "Ireland", length: 22, bban: [[4, "a"], [6, "n"], [8, "n"]], fields: { bank: [0, 4], branch: [4, 10], account: [10, 18] } },
  { code: "FI", name: "Finland", length: 18, bban: [[3, "n"], [11, "n"]], fields: { bank: [0, 3], account: [3, 14] } },
  { code: "LU", name: "Luxembourg", length: 20, bban: [[3, "n"], [13, "c"]], fields: { bank: [0, 3], account: [3, 16] } },
  { code: "SE", name: "Sweden", length: 24, bban: [[3, "n"], [16, "n"], [1, "n"]], fields: { bank: [0, 3], account: [3, 19] } },
  { code: "DK", name: "Denmark", length: 18, bban: [[4, "n"], [9, "n"], [1, "n"]], fields: { bank: [0, 4], account: [4, 13] } },
  { code: "NO", name: "Norway", length: 15, bban: [[4, "n"], [6, "n"], [1, "n"]], fields: { bank: [0, 4], account: [4, 10] } },
  { code: "GB", name: "United Kingdom", length: 22, bban: [[4, "a"], [6, "n"], [8, "n"]], fields: { bank: [0, 4], branch: [4, 10], account: [10, 18] } },
  { code: "PL", name: "Poland", length: 28, bban: [[8, "n"], [16, "n"]], fields: { bank: [0, 8], account: [8, 24] } },
  { code: "CZ", name: "Czech Republic", length: 24, bban: [[4, "n"], [6, "n"], [10, "n"]], fields: { bank: [0, 4], account: [4, 20] } },
  { code: "GR", name: "Greece", length: 27, bban: [[3, "n"], [4, "n"], [16, "c"]], fields: { bank: [0, 3], branch: [3, 7], account: [7, 23] } },
  { code: "CH", name: "Switzerland", length: 21, bban: [[5, "n"], [12, "c"]], fields: { bank: [0, 5], account: [5, 17] } },
];

const COUNTRY_MAP: Record<string, IbanCountry> = Object.fromEntries(
  IBAN_REGISTRY.map((c) => [c.code, c]),
);

export function normalizeIban(raw: string): string {
  return (raw || "").replace(/\s+/g, "").toUpperCase();
}

export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

function mod97(value: string): number {
  // Move first 4 chars to end, expand letters (A=10..Z=35), then mod-97.
  const rearranged = value.slice(4) + value.slice(0, 4);
  let expanded = "";
  for (const ch of rearranged) {
    if (ch >= "0" && ch <= "9") expanded += ch;
    else if (ch >= "A" && ch <= "Z") expanded += String(ch.charCodeAt(0) - 55);
    else return -1;
  }
  // Chunked mod-97 (string is too long for Number).
  let rem = 0;
  for (let i = 0; i < expanded.length; i += 7) {
    rem = Number(String(rem) + expanded.slice(i, i + 7)) % 97;
  }
  return rem;
}

function bbanPatternMatches(bban: string, country: IbanCountry): boolean {
  let offset = 0;
  for (const [count, kind] of country.bban) {
    const segment = bban.slice(offset, offset + count);
    if (segment.length !== count) return false;
    const ok =
      kind === "n" ? /^\d+$/.test(segment) :
      kind === "a" ? /^[A-Z]+$/.test(segment) :
      /^[0-9A-Z]+$/.test(segment);
    if (!ok) return false;
    offset += count;
  }
  return offset === bban.length;
}

export type IbanCheckStep = {
  label: string;
  ok: boolean;
  detail?: string;
};

export type IbanCheckResult = {
  ok: boolean;
  normalized: string;
  formatted: string;
  country?: IbanCountry;
  steps: IbanCheckStep[];
};

export function checkIban(raw: string): IbanCheckResult {
  const normalized = normalizeIban(raw);
  const formatted = formatIban(normalized);
  const steps: IbanCheckStep[] = [];

  if (normalized.length < 4) {
    steps.push({ label: "Length", ok: false, detail: "Too short to parse country code." });
    return { ok: false, normalized, formatted, steps };
  }

  const cc = normalized.slice(0, 2);
  const country = COUNTRY_MAP[cc];

  steps.push({
    label: "Country code",
    ok: !!country,
    detail: country ? `${cc} · ${country.name}` : `${cc} — not in registry.`,
  });
  if (!country) return { ok: false, normalized, formatted, steps };

  const lengthOk = normalized.length === country.length;
  steps.push({
    label: "Country length",
    ok: lengthOk,
    detail: `${normalized.length}/${country.length} characters.`,
  });
  if (!lengthOk) return { ok: false, normalized, formatted, country, steps };

  const charsOk = /^[A-Z0-9]+$/.test(normalized);
  steps.push({
    label: "Allowed characters",
    ok: charsOk,
    detail: charsOk ? "A–Z and 0–9 only." : "Contains disallowed characters.",
  });
  if (!charsOk) return { ok: false, normalized, formatted, country, steps };

  const bban = normalized.slice(4);
  const bbanOk = bbanPatternMatches(bban, country);
  steps.push({
    label: "BBAN structure",
    ok: bbanOk,
    detail: bbanOk ? "Matches registry pattern." : "BBAN does not match country pattern.",
  });
  if (!bbanOk) return { ok: false, normalized, formatted, country, steps };

  const rem = mod97(normalized);
  const checksumOk = rem === 1;
  steps.push({
    label: "MOD97-10 checksum",
    ok: checksumOk,
    detail: `remainder = ${rem} (expected 1)`,
  });

  return { ok: checksumOk, normalized, formatted, country, steps };
}

function randomChar(kind: "n" | "a" | "c"): string {
  const pool =
    kind === "n" ? "0123456789" :
    kind === "a" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" :
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomBban(country: IbanCountry): string {
  let out = "";
  for (const [count, kind] of country.bban) {
    for (let i = 0; i < count; i++) out += randomChar(kind);
  }
  return out;
}

export function generateIban(cc: string): string | null {
  const country = COUNTRY_MAP[cc];
  if (!country) return null;
  for (let attempt = 0; attempt < 50; attempt++) {
    const bban = randomBban(country);
    const stub = country.code + "00" + bban;
    const rem = mod97(stub);
    if (rem < 0) continue;
    const check = (98 - rem) % 97;
    const checkStr = check.toString().padStart(2, "0");
    const iban = country.code + checkStr + bban;
    if (checkIban(iban).ok) return iban;
  }
  return null;
}

export type IbanBreakdown = {
  country: string;
  countryName?: string;
  checkDigits: string;
  bban: string;
  bankCode?: string;
  branchCode?: string;
  accountNumber?: string;
};

export function breakdownIban(raw: string): { ok: boolean; result?: IbanBreakdown; check: IbanCheckResult } {
  const check = checkIban(raw);
  if (!check.ok || !check.country) return { ok: false, check };
  const value = check.normalized;
  const bban = value.slice(4);
  const f = check.country.fields ?? {};
  return {
    ok: true,
    check,
    result: {
      country: check.country.code,
      countryName: check.country.name,
      checkDigits: value.slice(2, 4),
      bban,
      bankCode: f.bank ? bban.slice(f.bank[0], f.bank[1]) : undefined,
      branchCode: f.branch ? bban.slice(f.branch[0], f.branch[1]) : undefined,
      accountNumber: f.account ? bban.slice(f.account[0], f.account[1]) : undefined,
    },
  };
}
