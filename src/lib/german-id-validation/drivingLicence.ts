/* German driving licence (Führerschein) — public surface validation.
 *
 * Field 5 (the licence number) has no publicly documented checksum, so
 * deeper claims return `not_checked`. Validity is checked against EU
 * Directive 2006/126/EC limits (15 years for AM/A/B/BE/T, 5 years for
 * C/D/E categories), and FeV Anlage 8e exchange deadlines for pre-2013
 * licences.
 *
 * Sources: SRC-EU-DL-2006-126, SRC-FEV-ANLAGE-8E, SRC-BMVI-FUEHRERSCHEIN. */

import type { ValidationResult } from "./types";

const SOURCE_IDS = ["SRC-EU-DL-2006-126", "SRC-BMVI-FUEHRERSCHEIN"];
const FEV_SOURCE = ["SRC-FEV-ANLAGE-8E"];

export function validateGermanDrivingLicenceNumber(
  raw: string | undefined,
): ValidationResult<{ normalized: string }> {
  const v = (raw ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!v) {
    return {
      status: "not_checked",
      issues: [
        {
          code: "DL_NUMBER_EMPTY",
          message: "Field 5 licence number not supplied.",
          severity: "info",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (v.length < 8 || v.length > 12) {
    return {
      status: "invalid",
      issues: [
        {
          code: "DL_NUMBER_LENGTH",
          message: "Field 5 must be 8–12 alphanumeric characters.",
          severity: "error",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  return {
    status: "not_checked",
    value: { normalized: v },
    issues: [
      {
        code: "DL_NUMBER_NO_PUBLIC_CHECKSUM",
        message:
          "Format passes, but no publicly documented checksum exists for field 5 — this cannot prove the number is authentic.",
        severity: "warning",
        sourceIds: SOURCE_IDS,
      },
    ],
    sourceIds: SOURCE_IDS,
  };
}

export type DrivingLicenceValidityInput = {
  issueDate: string;
  expiryDate: string;
  categories?: string[];
  categoryExpiryDate?: string;
  holderBirthYear?: number;
};

/** Public validity check. Verifies the issue/expiry pair against the 15-year
 * AM/A/B/BE/T ceiling and the 5-year C/D/E ceiling per EU Directive
 * 2006/126/EC. Never claims a licence is currently in force. */
export function validateGermanDrivingLicenceValidity(
  input: DrivingLicenceValidityInput | undefined,
): ValidationResult<{ validForYears: number }> {
  if (!input) {
    return {
      status: "not_checked",
      issues: [
        { code: "DL_VALIDITY_EMPTY", message: "Issue/expiry dates not supplied.", severity: "info", sourceIds: SOURCE_IDS },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  const start = Date.parse(input.issueDate);
  const end = Date.parse(input.expiryDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      status: "invalid",
      issues: [
        { code: "DL_VALIDITY_BAD_DATE", message: "Issue or expiry date is not a valid YYYY-MM-DD.", severity: "error", sourceIds: SOURCE_IDS },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (end <= start) {
    return {
      status: "invalid",
      issues: [{ code: "DL_VALIDITY_ORDER", message: "Expiry date must be after issue date.", severity: "error", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  const restricted = (input.categories ?? []).some((c) => /^[CDE]/.test(c));
  const issues: ValidationResult["issues"] = [];
  if (restricted && years > 5.1) {
    issues.push({
      code: "DL_VALIDITY_OVER_5Y_CDE",
      message: "Validity exceeds 5 years for category C/D/E.",
      severity: "error",
      sourceIds: SOURCE_IDS,
    });
  } else if (!restricted && years > 15.1) {
    issues.push({
      code: "DL_VALIDITY_OVER_15Y",
      message: "Validity exceeds 15 years — exceeds EU Directive 2006/126/EC ceiling.",
      severity: "error",
      sourceIds: SOURCE_IDS,
    });
  }
  return {
    status: issues.some((i) => i.severity === "error") ? "invalid" : "valid",
    value: { validForYears: Number(years.toFixed(2)) },
    issues,
    sourceIds: SOURCE_IDS,
  };
}

/** Pre-2013 exchange-deadline plausibility check per FeV Anlage 8e. Returns a
 * caution-style status only — never claims the licence has been exchanged. */
export function validatePre2013ExchangeDeadline(
  holderBirthYear: number | undefined,
  today: Date = new Date(),
): ValidationResult<{ deadlineYear: number }> {
  if (!holderBirthYear) {
    return {
      status: "not_checked",
      issues: [
        { code: "DL_EXCHANGE_NO_BIRTH_YEAR", message: "Holder birth year not supplied.", severity: "info", sourceIds: FEV_SOURCE },
      ],
      sourceIds: FEV_SOURCE,
    };
  }
  // FeV Anlage 8e staged schedule (paper licences pre-1999):
  //   pre-1953: 19-Jan-2033, 1953-1958: 2022, 1959-1964: 2023, 1965-1970: 2024,
  //   1971+: 2025. Card licences 1999-2013: staged 2026–2033 by issue year.
  let deadlineYear: number;
  if (holderBirthYear < 1953) deadlineYear = 2033;
  else if (holderBirthYear <= 1958) deadlineYear = 2022;
  else if (holderBirthYear <= 1964) deadlineYear = 2023;
  else if (holderBirthYear <= 1970) deadlineYear = 2024;
  else deadlineYear = 2025;
  const passed = today.getUTCFullYear() > deadlineYear;
  return {
    status: passed ? "not_checked" : "valid",
    value: { deadlineYear },
    issues: passed
      ? [
          {
            code: "DL_EXCHANGE_DEADLINE_PASSED",
            message: `FeV Anlage 8e exchange deadline (${deadlineYear}) for this birth-year cohort has already passed. Authority verification required.`,
            severity: "warning",
            sourceIds: FEV_SOURCE,
          },
        ]
      : [
          {
            code: "DL_EXCHANGE_DEADLINE_PLAUSIBLE",
            message: `FeV Anlage 8e exchange deadline for this birth-year cohort: ${deadlineYear}.`,
            severity: "info",
            sourceIds: FEV_SOURCE,
          },
        ],
    sourceIds: FEV_SOURCE,
  };
}

export function validateGermanDrivingLicencePublic(input: {
  drivingLicenceNumber?: string;
  drivingLicenceValidity?: DrivingLicenceValidityInput;
  holderBirthYear?: number;
  legacyExchange?: boolean;
}): ValidationResult<{ aggregated: true }> {
  const parts = [
    validateGermanDrivingLicenceNumber(input.drivingLicenceNumber),
    validateGermanDrivingLicenceValidity(input.drivingLicenceValidity),
  ];
  if (input.legacyExchange) {
    parts.push(validatePre2013ExchangeDeadline(input.holderBirthYear));
  }
  const issues = parts.flatMap((p) => p.issues);
  const sourceIds = Array.from(new Set(parts.flatMap((p) => p.sourceIds)));
  const anyInvalid = parts.some((p) => p.status === "invalid");
  const anyNotChecked = parts.some((p) => p.status === "not_checked");
  return {
    status: anyInvalid ? "invalid" : anyNotChecked ? "not_checked" : "valid",
    value: { aggregated: true },
    issues,
    sourceIds,
  };
}
