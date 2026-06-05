/* Dutch driving licence — public surface validation only.
 *
 * No public checksum is published for the Dutch driving-licence number, so
 * deeper validity claims are intentionally returned as `not_checked`. The
 * one-line MRZ surface on the back of the card likewise has no publicly
 * documented grammar; structure is observed, contents are not authenticated.
 *
 * Sources: SRC-NL-DRIVING-LICENCE-2025, SRC-NL-DRIVING-LICENCE-MRZ. */

import type { ValidationResult } from "./types";

const SOURCE_IDS = ["SRC-NL-DRIVING-LICENCE-2025"];
const MRZ_SOURCE_IDS = ["SRC-NL-DRIVING-LICENCE-MRZ"];

export function validateDutchDrivingLicenceNumber(
  raw: string | undefined,
): ValidationResult<{ normalized: string }> {
  const v = (raw ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!v) {
    return {
      status: "not_checked",
      issues: [
        {
          code: "DL_NUMBER_EMPTY",
          message: "Driving licence number not supplied.",
          severity: "info",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (v.length < 9 || v.length > 10) {
    return {
      status: "invalid",
      issues: [
        {
          code: "DL_NUMBER_LENGTH",
          message: "Driving licence number must be 9–10 alphanumeric characters.",
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
          "Format passes, but no publicly documented checksum exists for the Dutch driving licence number — this cannot prove the number is genuine or issued.",
        severity: "warning",
        sourceIds: SOURCE_IDS,
      },
    ],
    sourceIds: SOURCE_IDS,
  };
}

export function validateDutchDrivingLicenceMrzLine(
  raw: string | undefined,
): ValidationResult<{ normalized: string }> {
  const v = (raw ?? "").toUpperCase().replace(/\s+/g, "");
  if (!v) {
    return {
      status: "not_checked",
      issues: [
        {
          code: "DL_MRZ_EMPTY",
          message: "Driving licence MRZ line not supplied.",
          severity: "info",
          sourceIds: MRZ_SOURCE_IDS,
        },
      ],
      sourceIds: MRZ_SOURCE_IDS,
    };
  }
  return {
    status: "not_checked",
    value: { normalized: v },
    issues: [
      {
        code: "DL_MRZ_NO_PUBLIC_GRAMMAR",
        message:
          "No public grammar is published for the Dutch driving licence one-line MRZ. Content cannot be parsed authoritatively.",
        severity: "warning",
        sourceIds: MRZ_SOURCE_IDS,
      },
    ],
    sourceIds: MRZ_SOURCE_IDS,
  };
}

export type DrivingLicenceValidityInput = {
  applicationDate: string;
  expiryDate: string;
  categories?: string[];
  holderAgeAtApplication?: number;
};

/** Public validity-period check. Only checks the dates make sense and the
 * issued window respects RDW's published max-validity rules — never claims
 * the licence is currently in force or not withdrawn. */
export function validateDutchDrivingLicenceValidity(
  input: DrivingLicenceValidityInput | undefined,
): ValidationResult<{ validForYears: number }> {
  if (!input) {
    return {
      status: "not_checked",
      issues: [
        {
          code: "DL_VALIDITY_EMPTY",
          message: "Validity dates not supplied.",
          severity: "info",
          sourceIds: SOURCE_IDS,
        },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  const start = Date.parse(input.applicationDate);
  const end = Date.parse(input.expiryDate);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return {
      status: "invalid",
      issues: [
        { code: "DL_VALIDITY_BAD_DATE", message: "Application or expiry date is not a valid YYYY-MM-DD.", severity: "error", sourceIds: SOURCE_IDS },
      ],
      sourceIds: SOURCE_IDS,
    };
  }
  if (end <= start) {
    return {
      status: "invalid",
      issues: [{ code: "DL_VALIDITY_ORDER", message: "Expiry date must be after application date.", severity: "error", sourceIds: SOURCE_IDS }],
      sourceIds: SOURCE_IDS,
    };
  }
  const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  const issues: ValidationResult["issues"] = [];
  // RDW: ordinary licences are typically issued for up to 10 years (5 for
  // category C/D/E or holders aged 65+). We can't tell which without the
  // category + age, so emit a warning, not an error.
  if (years > 10.1) {
    issues.push({
      code: "DL_VALIDITY_OVER_10Y",
      message: "Validity period exceeds 10 years — exceeds RDW's published maximum for any ordinary licence.",
      severity: "error",
      sourceIds: SOURCE_IDS,
    });
  } else if ((input.categories?.some((c) => /^[CDE]/.test(c)) || (input.holderAgeAtApplication ?? 0) >= 65) && years > 5.1) {
    issues.push({
      code: "DL_VALIDITY_OVER_5Y_RESTRICTED",
      message: "Validity exceeds 5 years for category C/D/E or holders 65+.",
      severity: "warning",
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

export function validateDutchDrivingLicencePublic(input: {
  drivingLicenceNumber?: string;
  drivingLicenceMrzLine?: string;
  drivingLicenceValidity?: DrivingLicenceValidityInput;
}): ValidationResult<{ aggregated: true }> {
  const parts = [
    validateDutchDrivingLicenceNumber(input.drivingLicenceNumber),
    validateDutchDrivingLicenceMrzLine(input.drivingLicenceMrzLine),
    validateDutchDrivingLicenceValidity(input.drivingLicenceValidity),
  ];
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
