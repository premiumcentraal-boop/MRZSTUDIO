import { calculateCheckDigit } from "./checksums";
import { elster13ToLocal } from "./convert";
import { BUNDESLANDS, SYNTHETIC_DEFAULT_BUFA, berlinGenerationBezirk, getRule } from "./rules";
import { validate } from "./validate";
import { leftPadDigits, normalizeDigits } from "./normalize";
import {
  SYNTHETIC_STEUERNUMMER_WARNING,
  type Bundesland,
  type FieldBreakdown,
  type GenerateSyntheticSteuernummerInput,
  type SyntheticSteuernummerResult,
} from "./types";

type RandomSource = () => number;

function makeSeededRandom(seed: string | number | undefined): RandomSource {
  let state = 0x811c9dc5;
  const seedText = String(seed ?? "steuernummer-synthetic-default-seed");
  for (let index = 0; index < seedText.length; index++) {
    state ^= seedText.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(minInclusive: number, maxInclusive: number, random: RandomSource): number {
  return minInclusive + Math.floor(random() * (maxInclusive - minInclusive + 1));
}

function chooseBezirk(bundesland: Bundesland, random: RandomSource, override?: string, berlinVariant?: "A" | "B"): string {
  if (override) return leftPadDigits(override, bundesland === "nordrhein_westfalen" ? 4 : 3);
  if (bundesland === "berlin") return berlinGenerationBezirk(berlinVariant);
  if (bundesland === "nordrhein_westfalen") return leftPadDigits(String(randomInt(1, 997, random)), 4);
  const rule = getRule(bundesland);
  const minimum = rule.minBezirk ?? 1;
  return leftPadDigits(String(randomInt(minimum, 997, random)), 3);
}

function chooseUnterscheidungsnummer(bundesland: Bundesland, random: RandomSource, override?: string): string {
  if (override) return leftPadDigits(override, bundesland === "nordrhein_westfalen" ? 3 : 4);
  if (bundesland === "nordrhein_westfalen") return leftPadDigits(String(randomInt(1, 997, random)), 3);
  return leftPadDigits(String(randomInt(1, 9997, random)), 4);
}

function checkGenerationMode(input: GenerateSyntheticSteuernummerInput): void {
  if (input.generation_mode !== "synthetic_test_only") {
    throw new Error('generation_mode must be exactly "synthetic_test_only".');
  }
  if (input.strict_official_ranges) {
    throw new Error("strict_official_ranges requires a bundled official ELSTER Finanzamtsdaten file; this generator currently supports structural synthetic examples only.");
  }
}

function resolveBundesfinanzamtsnummer(input: GenerateSyntheticSteuernummerInput): string {
  if (input.bundesfinanzamtsnummer) {
    const bufa = normalizeDigits(input.bundesfinanzamtsnummer);
    if (bufa.length !== 4) throw new Error("bundesfinanzamtsnummer must be exactly 4 digits.");
    return bufa;
  }

  if (input.finanzamt_number) {
    const local = normalizeDigits(input.finanzamt_number);
    if (local.length === 4) return local;
    const rule = getRule(input.bundesland);
    if (input.bundesland === "hessen") {
      if (local.length === 3 && local[0] === "0") return `${rule.bufaPrefix}${local.slice(1)}`;
      if (local.length === 2) return `${rule.bufaPrefix}${local}`;
      throw new Error("Hessen finanzamt_number must be 2 digits or the 0FF local display component.");
    }
    const expectedLocalLength = rule.bufaPrefix.length === 1 ? 3 : 2;
    if (local.length !== expectedLocalLength) {
      throw new Error(`finanzamt_number for ${rule.displayName} must be ${expectedLocalLength} local digits or a 4-digit Bundesfinanzamtsnummer.`);
    }
    return `${rule.bufaPrefix}${local}`;
  }

  return SYNTHETIC_DEFAULT_BUFA[input.bundesland];
}

function buildInput12(
  bundesland: Bundesland,
  bufa: string,
  bezirk: string,
  unterscheidungsnummer: string,
): string {
  if (bundesland === "nordrhein_westfalen") {
    return `${bufa}0${bezirk}${unterscheidungsnummer}`;
  }
  return `${bufa}0${bezirk}${unterscheidungsnummer}`;
}

function fullBreakdown(elster13: string, bundesland: Bundesland): Required<FieldBreakdown> {
  if (bundesland === "nordrhein_westfalen") {
    return {
      bundesfinanzamtsnummer: elster13.slice(0, 4),
      bezirk_number: elster13.slice(5, 9),
      unterscheidungsnummer: elster13.slice(9, 12),
      pruefziffer: elster13.slice(12),
    };
  }
  return {
    bundesfinanzamtsnummer: elster13.slice(0, 4),
    bezirk_number: elster13.slice(5, 8),
    unterscheidungsnummer: elster13.slice(8, 12),
    pruefziffer: elster13.slice(12),
  };
}

export function generateSyntheticSteuernummer(input: GenerateSyntheticSteuernummerInput): SyntheticSteuernummerResult {
  checkGenerationMode(input);
  const random = makeSeededRandom(`${input.seed ?? "default"}:${input.bundesland}`);
  const bundesland = input.bundesland;
  const bufa = resolveBundesfinanzamtsnummer(input);
  const outputFormat = input.output_format ?? "elster_13";

  for (let attempt = 0; attempt < 500; attempt++) {
    const bezirk = chooseBezirk(bundesland, random, input.bezirk_number, input.berlin_variant);
    const unterscheidungsnummer = chooseUnterscheidungsnummer(bundesland, random, input.unterscheidungsnummer);
    const input12 = buildInput12(bundesland, bufa, bezirk, unterscheidungsnummer);
    if (input12.length !== 12) throw new Error("Internal generation error: checksum input is not 12 digits.");
    const check = calculateCheckDigit(input12, bundesland);
    if (check.check_digit === null) continue;
    const elster13 = `${input12}${check.check_digit}`;
    const validation = validate(elster13, {
      bundesland,
      allow_legacy_formats: input.allow_legacy_formats,
      strict_official_ranges: false,
    });
    if (validation.valid_structure && validation.valid_checksum) {
      const local = elster13ToLocal(elster13, bundesland);
      return {
        synthetic_test_data: true,
        value: outputFormat === "local" ? local : elster13,
        elster_13: elster13,
        local,
        bundesland,
        output_format: outputFormat,
        field_breakdown: fullBreakdown(elster13, bundesland),
        validation_report: validation,
        warnings: [
          SYNTHETIC_STEUERNUMMER_WARNING,
          "No official Finanzamtsdaten assignment lookup was performed.",
          "Do not use generated values for real filings or identity/taxpayer verification.",
        ],
      };
    }
  }

  throw new Error(`Could not generate a structurally valid synthetic ${bundesland} Steuernummer after repeated attempts.`);
}

export function generateSyntheticExamples(options: { output_format?: "elster_13" | "local"; seed?: string | number } = {}): SyntheticSteuernummerResult[] {
  return BUNDESLANDS.map((bundesland) =>
    generateSyntheticSteuernummer({
      bundesland,
      generation_mode: "synthetic_test_only",
      output_format: options.output_format ?? "elster_13",
      seed: options.seed ?? "all-bundeslaender",
    }),
  );
}
