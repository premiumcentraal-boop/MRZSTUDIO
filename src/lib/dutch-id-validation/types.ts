/* Public types for the Dutch ID validation library.
 *
 * The shape mirrors the contract in
 * `src/specs/dutch-id-validation/04-full-stack-contract.md` so any backend
 * or server route can adopt the same payloads verbatim. */

export type DocumentFamily = "passport" | "identity_card" | "driving_licence";

export type DutchPassportDocumentType =
  | "national_passport"
  | "business_passport"
  | "diplomatic_passport"
  | "service_passport"
  | "refugee_travel_document"
  | "alien_travel_document"
  | "emergency_passport"
  | "laissez_passer";

export type DutchIdentityCardDocumentType = "identity_card";
export type DutchDrivingLicenceDocumentType = "ordinary_driving_licence";

export type DutchDocumentType =
  | DutchPassportDocumentType
  | DutchIdentityCardDocumentType
  | DutchDrivingLicenceDocumentType;

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

export type DutchDocumentValidationRequest = {
  family: DocumentFamily;
  documentType?: string;
  issueDate?: string;
  visibleDocumentNumber?: string;
  bsn?: string;
  mrz?: string | string[];
  drivingLicenceNumber?: string;
  drivingLicenceMrzLine?: string;
  drivingLicenceValidity?: {
    applicationDate: string;
    expiryDate: string;
    categories?: string[];
    holderAgeAtApplication?: number;
  };
};

export type ModelSeriesEntry = {
  id: string;
  family: DocumentFamily;
  documentTypes: string[];
  modelName: string;
  issueDateFrom: string;
  issueDateTo: string | null;
  validationProfileId: string;
  maxValidityYears?: number;
  sourceIds: string[];
  publicChecks: string[];
  unavailableChecks: string[];
  notes: string[];
};

export type ResolveDutchModelSeriesInput = {
  family: DocumentFamily;
  documentType?: string;
  issueDate?: string;
};

export type DutchValidationValue = {
  modelProfiles: ModelSeriesEntry[];
  normalizedVisibleDocumentNumber?: string;
  normalizedBsn?: string;
  mrzCheckDigit?: string;
};
