import { type ToolMetadata } from "../core/types";
import { BUNDESLANDS } from "./rules";
import { SYNTHETIC_STEUERNUMMER_WARNING } from "./types";

const ELSTER_PDF_URL = "https://download.elster.de/download/schnittstellen/Pruefung_der_Steuer_und_Steueridentifikatsnummer.pdf";

export function getMetadata(): ToolMetadata {
  return {
    id: "de-steuernummer",
    name: "German Steuernummer Synthetic Example Generator and Validator",
    officialName: "Steuernummer",
    scope: "Germany, all Bundeslaender, ELSTER-compatible 13-digit structural format",
    category: "Tax",
    type: "de-steuernummer",
    format: "ELSTER 13-digit normalized format plus Bundesland-specific local display formats.",
    length: "13 digits in ELSTER format; local format depends on Bundesland.",
    allowedCharacters: "Digits in normalized format; common separators are accepted only for local display parsing.",
    prefixes: [...BUNDESLANDS],
    checksum: "Bundesland-specific 2er, 11er, modified 11er, Berlin-A/B, and NRW remainder methods.",
    validationRules: [
      "Normalize local display format to ELSTER 13 digits with Bundesland context.",
      "Require position 5 fixed zero.",
      "Validate region-specific Bezirk and Unterscheidungsnummer restrictions.",
      "Calculate the Bundesland-specific check digit.",
      "Do not claim real-world assignment, identity, Finanzamt acceptance, or active taxpayer status.",
    ],
    generationRules: [
      'Require generation_mode: "synthetic_test_only".',
      "Generate structural test candidates only.",
      "Calculate checksum internally and revalidate before returning.",
      "Return both ELSTER 13-digit and local display formats.",
      "Attach synthetic-only warnings to every result.",
    ],
    knownEdgeCases: [
      "NRW has a four-digit Bezirk and uses the checksum remainder, not the complement.",
      "Berlin requires Berlin-A/B routing by BUFA and Bezirk.",
      "Bayern legacy 2er numbers are not accepted by this tool.",
      "Strict official Finanzamt validation requires a separately bundled current ELSTER Finanzamtsdaten file.",
    ],
    sourceUrls: [ELSTER_PDF_URL],
    confidence: "confirmed",
    implementationStatus: "implement_now",
    safetyNotes: [
      SYNTHETIC_STEUERNUMMER_WARNING,
      "No generated example is real taxpayer data.",
      "No live ELSTER, Finanzamt, or taxpayer registry lookup is performed.",
    ],
    exampleValidSynthetic: "Use generateSyntheticSteuernummer({ bundesland: 'bayern', generation_mode: 'synthetic_test_only' }).",
    exampleInvalid: "Use a generated example and mutate the last digit to create a checksum failure fixture.",
    unitTestsRequired: [
      "One generated passing example per Bundesland.",
      "One mutated failing checksum example per Bundesland.",
      "Local-to-ELSTER and ELSTER-to-local round-trip tests.",
      "Berlin-A, Berlin-B, NRW, and Bayern legacy-current regressions.",
    ],
  };
}

