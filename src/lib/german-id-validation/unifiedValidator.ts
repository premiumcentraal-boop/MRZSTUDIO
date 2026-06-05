/* Page-level validator for German documents. Mirrors the contract in
 * `src/specs/german-id-validation/frontend-contract.md`. */

import { validateSteuerId } from "./steuerId";
import { parseMrz } from "./mrz";
import { validateGermanTravelDocumentNumber } from "./travelDocumentNumber";
import { validateGermanDrivingLicencePublic } from "./drivingLicence";
import { pickPrimaryModelSeries, resolveGermanModelSeries } from "./modelSeries";
import type {
  GermanDocumentValidationRequest,
  GermanValidationValue,
  ValidationIssue,
  ValidationResult,
  ValidationStatus,
} from "./types";

function reduceStatus(parts: ValidationStatus[]): ValidationStatus {
  if (parts.includes("invalid")) return "invalid";
  if (parts.includes("not_checked")) return "not_checked";
  return "valid";
}

export function validateGermanIdentityDocumentPublic(
  input: GermanDocumentValidationRequest,
): ValidationResult<GermanValidationValue> {
  const issues: ValidationIssue[] = [];
  const allSources = new Set<string>();
  const statuses: ValidationStatus[] = [];

  const modelProfiles = resolveGermanModelSeries({
    family: input.family,
    documentType: input.documentType,
    issueDate: input.issueDate,
  });
  modelProfiles.forEach((m) => m.sourceIds.forEach((s) => allSources.add(s)));

  if (input.issueDate && modelProfiles.length === 0) {
    issues.push({
      code: "MODEL_NOT_FOUND",
      message: `No published German ${input.family} model matches issueDate ${input.issueDate}.`,
      severity: "warning",
    });
    statuses.push("not_checked");
  }

  const value: GermanValidationValue = { modelProfiles };

  if (input.family === "passport" || input.family === "identity_card") {
    if (input.visibleDocumentNumber !== undefined) {
      const res = validateGermanTravelDocumentNumber(input.visibleDocumentNumber);
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

  if (input.steuerId !== undefined) {
    const res = validateSteuerId(input.steuerId);
    res.sourceIds.forEach((s) => allSources.add(s));
    issues.push(...res.issues);
    statuses.push(res.status);
    if (res.value) value.normalizedSteuerId = res.value.normalized;
  }

  if (input.family === "driving_licence") {
    const legacyExchange = input.documentType === "legacy_driving_licence_exchange_only";
    const res = validateGermanDrivingLicencePublic({
      drivingLicenceNumber: input.visibleDocumentNumber,
      drivingLicenceValidity:
        input.issueDate && input.expiryDate
          ? {
              issueDate: input.issueDate,
              expiryDate: input.expiryDate,
              categories: input.licenceCategories,
              categoryExpiryDate: input.categoryExpiryDate,
              holderBirthYear: input.holderBirthYear,
            }
          : undefined,
      holderBirthYear: input.holderBirthYear,
      legacyExchange,
    });
    res.sourceIds.forEach((s) => allSources.add(s));
    issues.push(...res.issues);
    statuses.push(res.status);
  }

  if (statuses.length === 0) statuses.push(modelProfiles.length > 0 ? "valid" : "not_checked");

  return {
    status: reduceStatus(statuses),
    value,
    issues,
    sourceIds: Array.from(allSources),
  };
}
