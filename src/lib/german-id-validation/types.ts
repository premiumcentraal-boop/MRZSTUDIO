/* Public types for the German ID validation library.
 *
 * Mirrors `src/specs/german-id-validation/frontend-contract.md`. */

export type DocumentFamily = "passport" | "identity_card" | "driving_licence";

export type GermanPassportDocumentType =
  | "ordinary_passport"
  | "ordinary_passport_48_pages"
  | "temporary_passport"
  | "child_passport"
  | "diplomatic_passport"
  | "service_passport"
  | "non_national_travel_document";

export type GermanIdentityCardDocumentType =
  | "ordinary_identity_card"
  | "temporary_identity_card"
  | "replacement_identity_card";

export type GermanDrivingLicenceDocumentType =
  | "ordinary_driving_licence"
  | "legacy_driving_licence_exchange_only"
  | "fahrerqualifizierungsnachweis";

export type GermanDocumentType =
  | GermanPassportDocumentType
  | GermanIdentityCardDocumentType
  | GermanDrivingLicenceDocumentType;

export type Severity = "error" | "warning" | "info";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: Severity;
  sourceIds?: string[];
};

export type ValidationStatus = "valid" | "invalid" | "not_checked";

export type ValidationResult<T = unknown> = {
  status: ValidationStatus;
  value?: T;
  issues: ValidationIssue[];
  sourceIds: string[];
};

export type GermanDocumentValidationRequest = {
  family: DocumentFamily;
  documentType?: string;
  issueDate?: string;
  expiryDate?: string;
  visibleDocumentNumber?: string;
  mrz?: string | string[];
  steuerId?: string;
  holderAgeAtIssue?: number;
  holderBirthYear?: number;
  licenceCategories?: string[];
  categoryExpiryDate?: string;
};

export type ModelSeriesEntry = {
  id: string;
  family: DocumentFamily;
  documentTypes: string[];
  modelName: string;
  issueDateFrom: string;
  issueDateTo: string | null;
  validationProfileId: string;
  maxValidityYears?: number | null;
  sourceIds: string[];
  publicChecks: string[];
  unavailableChecks: string[];
  notes: string[];
};

export type ResolveGermanModelSeriesInput = {
  family: DocumentFamily;
  documentType?: string;
  issueDate?: string;
};

export type GermanValidationValue = {
  modelProfiles: ModelSeriesEntry[];
  normalizedVisibleDocumentNumber?: string;
  normalizedSteuerId?: string;
  mrzCheckDigit?: string;
};
