/* Smart address generator for Dutch cities.
 *
 * Produces a plausible "Street House-number, Postcode City" line using real
 * street names and the postal-code range that actually covers each city.
 * The street + house-number combinations are randomised but the city /
 * postcode pairing is always internally consistent. */

type CityKey = "rotterdam" | "amsterdam" | "zoetermeer";

type CitySpec = {
  display: string;
  streets: string[];
  /** Postcode is 4 digits where the first digit(s) below act as prefix. */
  postcodeRange: [number, number];
  postcodeLetters: string[];
};

const CITIES: Record<CityKey, CitySpec> = {
  rotterdam: {
    display: "Rotterdam",
    streets: [
      "Coolsingel",
      "Westzeedijk",
      "Witte de Withstraat",
      "Nieuwe Binnenweg",
      "Goudsesingel",
      "Hoogstraat",
      "Mauritsweg",
      "Meent",
      "Westersingel",
      "Schiekade",
      "Beursplein",
      "Boompjes",
      "Karel Doormanstraat",
      "Eendrachtsplein",
      "Lijnbaan",
    ],
    postcodeRange: [3011, 3089],
    postcodeLetters: ["AB", "AD", "AH", "BN", "CK", "DK", "GR", "HJ", "JT", "KP", "LM", "NP", "RS", "TV", "WX"],
  },
  amsterdam: {
    display: "Amsterdam",
    streets: [
      "Damrak",
      "Prinsengracht",
      "Herengracht",
      "Keizersgracht",
      "Spuistraat",
      "Leidsestraat",
      "Rokin",
      "Kalverstraat",
      "Nieuwezijds Voorburgwal",
      "Singel",
      "Haarlemmerstraat",
      "Utrechtsestraat",
      "Vijzelstraat",
      "Reguliersdwarsstraat",
      "Overtoom",
    ],
    postcodeRange: [1011, 1099],
    postcodeLetters: ["AA", "AB", "BD", "CK", "DH", "EL", "GJ", "HM", "JR", "KP", "LT", "NX", "PR", "RV", "SW"],
  },
  zoetermeer: {
    display: "Zoetermeer",
    streets: [
      "Dorpsstraat",
      "Stadhuisplein",
      "Engelandlaan",
      "Spechtlaan",
      "Marktplein",
      "Eerste Stationsstraat",
      "Frankrijklaan",
      "Italiëlaan",
      "Oostwaarts",
      "Westwaarts",
      "Nederlandlaan",
      "Promenade",
      "Vlamingstraat",
      "Argonstraat",
      "Plataanhout",
    ],
    postcodeRange: [2711, 2729],
    postcodeLetters: ["AA", "BD", "CK", "DH", "EL", "GJ", "HM", "JR", "KP", "LT", "NX"],
  },
};

const ALIASES: Record<string, CityKey> = {
  rotterdam: "rotterdam",
  amsterdam: "amsterdam",
  zoetermeer: "zoetermeer",
};

function normalizeCity(input: string): CityKey | null {
  const key = (input || "").trim().toLowerCase();
  if (!key) return null;
  if (key in ALIASES) return ALIASES[key];
  // Try stripping prefixes the form auto-fills ("Burg. van Rotterdam").
  const m = key.match(/([a-zà-ÿ]+)\s*$/i);
  if (m && m[1] in ALIASES) return ALIASES[m[1]];
  return null;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Build a plausible Dutch address line for the given city. Falls back to a
 * generic Rotterdam address when the city isn't recognised so the user still
 * gets a sensible result instead of an empty string.
 */
export function generateAddressForCity(city: string): string {
  const key = normalizeCity(city) ?? "rotterdam";
  const spec = CITIES[key];
  const street = pick(spec.streets);
  const houseNumber = 1 + Math.floor(Math.random() * 240);
  const suffixChance = Math.random();
  const suffix =
    suffixChance < 0.15 ? ` ${pick(["A", "B", "bis", "II"])}` : "";
  const [pcLo, pcHi] = spec.postcodeRange;
  const pcDigits = pcLo + Math.floor(Math.random() * (pcHi - pcLo + 1));
  const pcLetters = pick(spec.postcodeLetters);
  return `${street} ${houseNumber}${suffix}, ${pcDigits} ${pcLetters} ${spec.display}`;
}

export const SUPPORTED_ADDRESS_CITIES = Object.values(CITIES).map((c) => c.display);

export type AddressCheck = {
  ok: boolean;
  reason?: string;
  parts?: {
    street: string;
    houseNumber: string;
    postcode: string;
    city: string;
  };
};

/**
 * Validate that an address line is internally consistent: parseable into
 * "Street House-number, 1234 AB City", references a known street for that
 * city, and the postcode falls inside the city's published prefix range.
 */
export function checkDutchAddress(raw: string): AddressCheck {
  const input = (raw || "").trim();
  if (!input) return { ok: false, reason: "Address is empty." };

  // "<street + number[suffix]>, <4-digit pc> <2-letter pc> <city>"
  const m = input.match(
    /^(.+?)\s+(\d{1,4}(?:\s?[A-Za-z]{1,3})?)\s*,\s*(\d{4})\s*([A-Za-z]{2})\s+(.+)$/,
  );
  if (!m) {
    return {
      ok: false,
      reason: 'Expected format: "Street 123, 1234 AB City".',
    };
  }
  const [, street, houseNumber, pcDigits, pcLettersRaw, cityRaw] = m;
  const pcLetters = pcLettersRaw.toUpperCase();
  const parts = {
    street: street.trim(),
    houseNumber: houseNumber.trim(),
    postcode: `${pcDigits} ${pcLetters}`,
    city: cityRaw.trim(),
  };

  const key = normalizeCity(cityRaw);
  if (!key) {
    return {
      ok: false,
      reason: `Unknown city "${cityRaw.trim()}" — supported: ${SUPPORTED_ADDRESS_CITIES.join(", ")}.`,
      parts,
    };
  }
  const spec = CITIES[key];

  const streetMatch = spec.streets.some(
    (s) => s.toLowerCase() === parts.street.toLowerCase(),
  );
  if (!streetMatch) {
    return {
      ok: false,
      reason: `"${parts.street}" is not a known street in ${spec.display}.`,
      parts,
    };
  }

  const pcNum = parseInt(pcDigits, 10);
  const [pcLo, pcHi] = spec.postcodeRange;
  if (pcNum < pcLo || pcNum > pcHi) {
    return {
      ok: false,
      reason: `Postcode ${pcDigits} is outside ${spec.display} range ${pcLo}–${pcHi}.`,
      parts,
    };
  }

  if (!spec.postcodeLetters.includes(pcLetters)) {
    return {
      ok: false,
      reason: `Postcode letters "${pcLetters}" are not valid for ${spec.display}.`,
      parts,
    };
  }

  return { ok: true, parts };
}
