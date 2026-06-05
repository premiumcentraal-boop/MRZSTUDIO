import { type ToolMetadata } from "../core/types.ts";
import { SYNTHETIC_STEUERNUMMER_WARNING } from "../steuernummer/types.ts";

const ELSTER_PDF_URL = "https://download.elster.de/download/schnittstellen/Pruefung_der_Steuer_und_Steueridentifikatsnummer.pdf";
const BZST_URL = "https://online.portal.bzst.de/SharedDocs/Leistungsbeschreibung/DE/erneute_mitteilung_der_ID-Nr.html";

export function getMetadata(): ToolMetadata {
  return {
    id: "de-steuer-id",
    name: "German Steuer-ID / IdNr Validator",
    officialName: "Steueridentifikationsnummer / Identifikationsnummer",
    scope: "Germany, Steuer-ID / IdNr only",
    category: "Tax",
    type: "de-steuer-id",
    format: "11 digits.",
    length: "11 digits.",
    allowedCharacters: "Digits in normalized format; common separators can be stripped for validation.",
    prefixes: [],
    checksum: "ISO 7064 MOD 11,10 over the first 10 digits.",
    validationRules: [
      "Require 11 digits.",
      "First digit normally cannot be zero except official test cases.",
      "First 10 digits must satisfy the official repetition rule.",
      "Validate the 11th digit with ISO 7064 MOD 11,10.",
      "Do not treat Steuer-ID as a Steuernummer.",
    ],
    generationRules: [
      "No public Steuer-ID generator is exposed here.",
      "Use official test IDs only where official documentation permits.",
    ],
    knownEdgeCases: [
      "Steuer-ID is non-speaking and encodes no Bundesland, city, gender, birthdate, or Finanzamt.",
      "Public checksum failure output must not disclose the replacement check digit.",
    ],
    sourceUrls: [ELSTER_PDF_URL, BZST_URL],
    confidence: "confirmed",
    implementationStatus: "validator_only",
    safetyNotes: [
      SYNTHETIC_STEUERNUMMER_WARNING,
      "This module validates structure only and never verifies identity or assignment.",
    ],
    exampleValidSynthetic: "No generated Steuer-ID example is exposed by default.",
    exampleInvalid: "123",
    unitTestsRequired: [
      "Length failure tests.",
      "Non-numeric input tests.",
      "Repetition-rule tests.",
      "Checksum pass/fail tests.",
    ],
  };
}

