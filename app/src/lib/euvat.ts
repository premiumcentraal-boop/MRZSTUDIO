/* ============================================================================
 * EU VAT — format-only validate & generate.
 *
 * Synthetic test data only. Format-only confidence: no country-specific
 * checksum is computed and no live VIES lookup is performed.
 * ========================================================================== */

export type VatCountry = {
  code: string;
  name: string;
  // Pattern over the body (after the 2-char country prefix). Each entry is
  // a list of segments (count, kind), where kind is n|a|c plus literal "X"
  // segments for fixed characters.
  body: ReadonlyArray<readonly [number, "n" | "a" | "c"] | { literal: string }>;
  example: string;
};

export const VAT_REGISTRY: ReadonlyArray<VatCountry> = [
  { code: "AT", name: "Austria",       body: [{ literal: "U" }, [8, "n"]], example: "ATU12345678" },
  { code: "BE", name: "Belgium",       body: [[10, "n"]], example: "BE0123456789" },
  { code: "BG", name: "Bulgaria",      body: [[9, "n"]], example: "BG123456789" },
  { code: "CY", name: "Cyprus",        body: [[8, "n"], [1, "a"]], example: "CY12345678X" },
  { code: "CZ", name: "Czech Republic",body: [[8, "n"]], example: "CZ12345678" },
  { code: "DE", name: "Germany",       body: [[9, "n"]], example: "DE123456789" },
  { code: "DK", name: "Denmark",       body: [[8, "n"]], example: "DK12345678" },
  { code: "EE", name: "Estonia",       body: [[9, "n"]], example: "EE123456789" },
  { code: "EL", name: "Greece",        body: [[9, "n"]], example: "EL123456789" },
  { code: "ES", name: "Spain",         body: [[1, "c"], [7, "n"], [1, "c"]], example: "ESX1234567X" },
  { code: "FI", name: "Finland",       body: [[8, "n"]], example: "FI12345678" },
  { code: "FR", name: "France",        body: [[2, "c"], [9, "n"]], example: "FRXX123456789" },
  { code: "HR", name: "Croatia",       body: [[11, "n"]], example: "HR12345678901" },
  { code: "HU", name: "Hungary",       body: [[8, "n"]], example: "HU12345678" },
  { code: "IE", name: "Ireland",       body: [[7, "n"], [1, "a"], [1, "a"]], example: "IE1234567XX" },
  { code: "IT", name: "Italy",         body: [[11, "n"]], example: "IT12345678901" },
  { code: "LT", name: "Lithuania",     body: [[9, "n"]], example: "LT123456789" },
  { code: "LU", name: "Luxembourg",    body: [[8, "n"]], example: "LU12345678" },
  { code: "LV", name: "Latvia",        body: [[11, "n"]], example: "LV12345678901" },
  { code: "MT", name: "Malta",         body: [[8, "n"]], example: "MT12345678" },
  { code: "NL", name: "Netherlands",   body: [[9, "n"], { literal: "B" }, [2, "n"]], example: "NL123456789B01" },
  { code: "PL", name: "Poland",        body: [[10, "n"]], example: "PL1234567890" },
  { code: "PT", name: "Portugal",      body: [[9, "n"]], example: "PT123456789" },
  { code: "RO", name: "Romania",       body: [[9, "n"]], example: "RO123456789" },
  { code: "SE", name: "Sweden",        body: [[12, "n"]], example: "SE123456789012" },
  { code: "SI", name: "Slovenia",      body: [[8, "n"]], example: "SI12345678" },
  { code: "SK", name: "Slovakia",      body: [[10, "n"]], example: "SK1234567890" },
  { code: "XI", name: "Northern Ireland", body: [[9, "n"]], example: "XI123456789" },
];

const COUNTRY_MAP: Record<string, VatCountry> = Object.fromEntries(
  VAT_REGISTRY.map((c) => [c.code, c]),
);

export function normalizeVat(raw: string): string {
  return (raw || "").replace(/[\s\-\._]/g, "").toUpperCase();
}

export type VatCheckStep = { label: string; ok: boolean; detail?: string };
export type VatCheckResult = {
  ok: boolean;
  normalized: string;
  country?: VatCountry;
  steps: VatCheckStep[];
};

function matchBody(body: string, country: VatCountry): boolean {
  let offset = 0;
  for (const segment of country.body) {
    if ("literal" in segment) {
      if (body.slice(offset, offset + segment.literal.length) !== segment.literal) return false;
      offset += segment.literal.length;
    } else {
      const [count, kind] = segment;
      const chunk = body.slice(offset, offset + count);
      if (chunk.length !== count) return false;
      const ok =
        kind === "n" ? /^\d+$/.test(chunk) :
        kind === "a" ? /^[A-Z]+$/.test(chunk) :
        /^[0-9A-Z]+$/.test(chunk);
      if (!ok) return false;
      offset += count;
    }
  }
  return offset === body.length;
}

export function checkVat(raw: string): VatCheckResult {
  const normalized = normalizeVat(raw);
  const steps: VatCheckStep[] = [];

  if (normalized.length < 3) {
    steps.push({ label: "Length", ok: false, detail: "Too short to parse prefix." });
    return { ok: false, normalized, steps };
  }

  const cc = normalized.slice(0, 2);
  const country = COUNTRY_MAP[cc];
  steps.push({
    label: "Country prefix",
    ok: !!country,
    detail: country ? `${cc} · ${country.name}` : `${cc} — not an EU VAT prefix.`,
  });
  if (!country) return { ok: false, normalized, steps };

  const body = normalized.slice(2);
  const bodyOk = matchBody(body, country);
  steps.push({
    label: "Body format",
    ok: bodyOk,
    detail: bodyOk ? "Matches country pattern." : `Expected pattern like ${country.example}.`,
  });

  steps.push({
    label: "Live VIES lookup",
    ok: true,
    detail: "Skipped — format-only confidence.",
  });

  return { ok: bodyOk, normalized, country, steps };
}

export function formatVat(normalized: string): string {
  if (normalized.length <= 2) return normalized;
  return `${normalized.slice(0, 2)} ${normalized.slice(2)}`;
}

function randomBodyChar(kind: "n" | "a" | "c"): string {
  const pool =
    kind === "n" ? "0123456789" :
    kind === "a" ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" :
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return pool[Math.floor(Math.random() * pool.length)];
}

export function generateVat(cc: string): string | null {
  const country = COUNTRY_MAP[cc];
  if (!country) return null;
  let body = "";
  for (const segment of country.body) {
    if ("literal" in segment) {
      body += segment.literal;
    } else {
      const [count, kind] = segment;
      for (let i = 0; i < count; i++) body += randomBodyChar(kind);
    }
  }
  const value = country.code + body;
  return checkVat(value).ok ? value : null;
}
