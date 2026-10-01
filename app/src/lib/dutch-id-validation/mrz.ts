/* ICAO 9303 MRZ parser / verifier.
 *
 * TD3 — 2 lines × 44 chars (passport).
 * TD1 — 3 lines × 30 chars (ID card).
 *
 * Check digits use the standard [7,3,1] weight cycle. '<' counts as 0,
 * digits as their value, letters A–Z as 10–35.
 *
 * Source: SRC-ICAO-9303. */

import type { ValidationResult } from "./types";
import { icaoMrzCheckDigit } from "./travelDocumentNumber";

const SOURCE_IDS = ["SRC-ICAO-9303"];

export type MrzMode = "TD3" | "TD1";

export type ParsedMrz = {
  mode: MrzMode;
  documentCode: string;
  issuingState: string;
  documentNumber: string;
  documentNumberCheckOk: boolean;
  nationality: string;
  birthDate: string;
  birthDateCheckOk: boolean;
  sex: string;
  expiryDate: string;
  expiryDateCheckOk: boolean;
  personalNumber: string;
  personalNumberCheckOk: boolean;
  compositeCheckOk: boolean;
  surname: string;
  givenNames: string;
};

function normalizeLines(raw: string | string[]): string[] {
  if (Array.isArray(raw)) return raw.map((l) => l.replace(/\s+/g, "").toUpperCase());
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, "").toUpperCase())
    .filter(Boolean);
}

export function parseMrz(raw: string | string[] | undefined): ValidationResult<ParsedMrz> {
  if (!raw) {
    return {
      status: "not_checked",
      issues: [{ code: "MRZ_EMPTY", message: "MRZ not supplied.", severity: "info", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  const lines = normalizeLines(raw);
  if (lines.length === 2 && lines.every((l) => l.length === 44)) {
    return parseTd3(lines as [string, string]);
  }
  if (lines.length === 3 && lines.every((l) => l.length === 30)) {
    return parseTd1(lines as [string, string, string]);
  }
  return {
    status: "invalid",
    issues: [
      {
        code: "MRZ_LAYOUT",
        message: "MRZ does not match TD3 (2×44) or TD1 (3×30) layout.",
        severity: "error",
        sourceIds: SOURCE_IDS,
      },
    ],
    sourceIds: SOURCE_IDS,
  };
}

function checkField(field: string, expected: string) {
  return icaoMrzCheckDigit(field) === expected;
}

function splitName(field: string): { surname: string; givenNames: string } {
  const [surnameRaw, givenRaw = ""] = field.split("<<");
  return {
    surname: surnameRaw.replace(/</g, " ").trim(),
    givenNames: givenRaw.replace(/</g, " ").trim(),
  };
}

function parseTd3(lines: [string, string]): ValidationResult<ParsedMrz> {
  const [l1, l2] = lines;
  const documentCode = l1.slice(0, 2);
  const issuingState = l1.slice(2, 5);
  const nameField = l1.slice(5, 44);
  const { surname, givenNames } = splitName(nameField);

  const documentNumber = l2.slice(0, 9);
  const documentNumberCheck = l2[9];
  const nationality = l2.slice(10, 13);
  const birthDate = l2.slice(13, 19);
  const birthDateCheck = l2[19];
  const sex = l2.slice(20, 21);
  const expiryDate = l2.slice(21, 27);
  const expiryDateCheck = l2[27];
  const personalNumber = l2.slice(28, 42);
  const personalNumberCheck = l2[42];
  const composite =
    l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 28) + l2.slice(28, 43);
  const compositeCheck = l2[43];

  const documentNumberCheckOk = checkField(documentNumber, documentNumberCheck);
  const birthDateCheckOk = checkField(birthDate, birthDateCheck);
  const expiryDateCheckOk = checkField(expiryDate, expiryDateCheck);
  // Per ICAO 9303 Part 4: optional/personal-number check digit may be '<'
  // when personal number is unused, with the field itself padded with '<'.
  const personalNumberCheckOk =
    /^<+$/.test(personalNumber) && personalNumberCheck === "<"
      ? true
      : checkField(personalNumber, personalNumberCheck);
  const compositeCheckOk = checkField(composite, compositeCheck);

  const parsed: ParsedMrz = {
    mode: "TD3",
    documentCode,
    issuingState,
    documentNumber: documentNumber.replace(/</g, ""),
    documentNumberCheckOk,
    nationality,
    birthDate,
    birthDateCheckOk,
    sex,
    expiryDate,
    expiryDateCheckOk,
    personalNumber: personalNumber.replace(/</g, ""),
    personalNumberCheckOk,
    compositeCheckOk,
    surname,
    givenNames,
  };

  const issues = collectMrzIssues(parsed);
  return {
    status: issues.some((i) => i.severity === "error") ? "invalid" : "valid",
    value: parsed,
    issues,
    sourceIds: SOURCE_IDS,
  };
}

function parseTd1(lines: [string, string, string]): ValidationResult<ParsedMrz> {
  const [l1, l2, l3] = lines;
  const documentCode = l1.slice(0, 2);
  const issuingState = l1.slice(2, 5);
  const documentNumber = l1.slice(5, 14);
  const documentNumberCheck = l1[14];
  const personalNumber = l1.slice(15, 30);

  const birthDate = l2.slice(0, 6);
  const birthDateCheck = l2[6];
  const sex = l2.slice(7, 8);
  const expiryDate = l2.slice(8, 14);
  const expiryDateCheck = l2[14];
  const nationality = l2.slice(15, 18);
  const compositeFields =
    l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const compositeCheck = l2[29];

  const { surname, givenNames } = splitName(l3);

  const documentNumberCheckOk = checkField(documentNumber, documentNumberCheck);
  const birthDateCheckOk = checkField(birthDate, birthDateCheck);
  const expiryDateCheckOk = checkField(expiryDate, expiryDateCheck);
  const compositeCheckOk = checkField(compositeFields, compositeCheck);

  const parsed: ParsedMrz = {
    mode: "TD1",
    documentCode,
    issuingState,
    documentNumber: documentNumber.replace(/</g, ""),
    documentNumberCheckOk,
    nationality,
    birthDate,
    birthDateCheckOk,
    sex,
    expiryDate,
    expiryDateCheckOk,
    personalNumber: personalNumber.replace(/</g, ""),
    personalNumberCheckOk: true,
    compositeCheckOk,
    surname,
    givenNames,
  };

  const issues = collectMrzIssues(parsed);
  return {
    status: issues.some((i) => i.severity === "error") ? "invalid" : "valid",
    value: parsed,
    issues,
    sourceIds: SOURCE_IDS,
  };
}

function collectMrzIssues(p: ParsedMrz): ValidationResult["issues"] {
  const out: ValidationResult["issues"] = [];
  if (!p.documentNumberCheckOk)
    out.push({ code: "MRZ_DOCNUM_CHECK", message: "MRZ document-number check digit failed.", severity: "error", sourceIds: SOURCE_IDS });
  if (!p.birthDateCheckOk)
    out.push({ code: "MRZ_DOB_CHECK", message: "MRZ date-of-birth check digit failed.", severity: "error", sourceIds: SOURCE_IDS });
  if (!p.expiryDateCheckOk)
    out.push({ code: "MRZ_EXPIRY_CHECK", message: "MRZ expiry-date check digit failed.", severity: "error", sourceIds: SOURCE_IDS });
  if (!p.personalNumberCheckOk)
    out.push({ code: "MRZ_PERSONAL_CHECK", message: "MRZ personal-number check digit failed.", severity: "error", sourceIds: SOURCE_IDS });
  if (!p.compositeCheckOk)
    out.push({ code: "MRZ_COMPOSITE_CHECK", message: "MRZ composite check digit failed.", severity: "error", sourceIds: SOURCE_IDS });
  return out;
}
