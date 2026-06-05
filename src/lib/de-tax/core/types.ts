export type ConfidenceLevel = "confirmed" | "partially_confirmed" | "format_only" | "not_implemented";

export type ImplementationStatus =
  | "implement_now"
  | "implement_format_only"
  | "blocked_until_source_confirmed"
  | "validator_only"
  | "unsafe_to_generate";

export type CheckResult = {
  name: string;
  passed: boolean;
  details?: string;
};

export type ValidationResult = {
  valid: boolean;
  normalized: string | null;
  formatted: string | null;
  country?: string;
  type: string;
  reason?: string;
  checks: CheckResult[];
};

export type GenerationResult = {
  value: string;
  formatted: string;
  country?: string;
  type: string;
  synthetic: true;
  warning: string;
};

export type ToolMetadata = {
  id: string;
  name: string;
  officialName: string;
  scope: string;
  category: string;
  type: string;
  format: string;
  length: string;
  allowedCharacters: string;
  prefixes: string[];
  checksum: string;
  validationRules: string[];
  generationRules: string[];
  knownEdgeCases: string[];
  sourceUrls: string[];
  confidence: ConfidenceLevel;
  implementationStatus: ImplementationStatus;
  safetyNotes: string[];
  exampleValidSynthetic: string;
  exampleInvalid: string;
  unitTestsRequired: string[];
};

export type ExplainResult = {
  type: string;
  normalized: string | null;
  formatted: string | null;
  summary: string;
  checks: CheckResult[];
  metadata: ToolMetadata;
};

export const SYNTHETIC_WARNING = "Synthetic test data only. Not for real-world use.";
