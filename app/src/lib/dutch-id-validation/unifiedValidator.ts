/* Page-level validator. Aggregates the family-specific checks behind a
 * single function that maps directly to the contract in
 * `src/specs/dutch-id-validation/04-full-stack-contract.md`. */

import { validateBsn } from "./bsn";
import { parseMrz } from "./mrz";
import { validateDutchTravelDocumentNumber } from "./travelDocumentNumber";
import { validateDutchDrivingLicencePublic } from "./drivingLicence";
import { eraForModel, pickPrimaryModelSeries, resolveDutchModelSeries } from "./modelSeries";
import type {
  DutchDocumentValidationRequest,
  DutchValidationValue,
  ValidationIssue,
  ValidationResult,
  ValidationStatus,
} from "./types";

function reduceStatus(parts: ValidationStatus[]): ValidationStatus {
  if (parts.includes("invalid")) return "invalid";
  if (parts.includes("not_checked")) return "not_checked";
  return "valid";
}

export function validateDutchIdentityDocumentPublic(
  input: DutchDocumentValidationRequest,
): ValidationResult<DutchValidationValue> {
  const issues: ValidationIssue[] = [];
  const allSources = new Set<string>();
  const statuses: ValidationStatus[] = [];

  const modelProfiles = resolveDutchModelSeries({
    family: input.family,
    documentType: input.documentType,
    issueDate: input.issueDate,
  });
  modelProfiles.forEach((m) => m.sourceIds.forEach((s) => allSources.add(s)));

  const primary = pickPrimaryModelSeries({
    family: input.family,
    documentType: input.documentType,
    issueDate: input.issueDate,
  });
  const era = eraForModel(primary);

  if (input.issueDate && modelProfiles.length === 0) {
    issues.push({
      code: "MODEL_NOT_FOUND",
      message: `No published Dutch ${input.family} model matches issueDate ${input.issueDate}.`,
      severity: "warning",
    });
    statuses.push("not_checked");
  }

  const value: DutchValidationValue = { modelProfiles };

  if (input.family === "passport" || input.family === "identity_card") {
    if (input.visibleDocumentNumber !== undefined) {
      const res = validateDutchTravelDocumentNumber(input.visibleDocumentNumber, era);
      res.sourceIds.forEach((s) => allSources.add(s));
      issues.push(...res.issues);
      statuses.push(res.status);
      if (res.value) value.normalizedVisibleDocumentNumber = res.value.normalized;
    }
    if (input.mrz !== undefined) {
      const res = parseMrz(input.mrz);
      res.sourceIds.forEach((s) => allSources.add(s));
      issues.push(...res.issues);
      statuses.push(res.status);
    }
  }

  if (input.bsn !== undefined) {
    const res = validateBsn(input.bsn);
    res.sourceIds.forEach((s) => allSources.add(s));
    issues.push(...res.issues);
    statuses.push(res.status);
    if (res.value) value.normalizedBsn = res.value.normalized;
  }

  if (input.family === "driving_licence") {
    const res = validateDutchDrivingLicencePublic({
      drivingLicenceNumber: input.drivingLicenceNumber,
      drivingLicenceMrzLine: input.drivingLicenceMrzLine,
      drivingLicenceValidity: input.drivingLicenceValidity,
    });
    res.sourceIds.forEach((s) => allSources.add(s));
    issues.push(...res.issues);
    statuses.push(res.status);
  }

  // If the caller supplied no inputs at all, surface the model profile only.
  if (statuses.length === 0) statuses.push(modelProfiles.length > 0 ? "valid" : "not_checked");

  return {
    status: reduceStatus(statuses),
    value,
    issues,
    sourceIds: Array.from(allSources),
  };
}
