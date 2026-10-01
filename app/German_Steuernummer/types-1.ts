import type { CheckResult } from "../core/types.ts";

export type Bundesland =
  | "baden_wuerttemberg"
  | "bayern"
  | "berlin"
  | "brandenburg"
  | "bremen"
  | "hamburg"
  | "hessen"
  | "mecklenburg_vorpommern"
  | "niedersachsen"
  | "nordrhein_westfalen"
  | "rheinland_pfalz"
  | "saarland"
  | "sachsen"
  | "sachsen_anhalt"
  | "schleswig_holstein"
  | "thueringen";

export type SteuernummerFormat = "elster_13" | "local" | "unknown";

export type SteuernummerMethod =
  | "2er"
  | "11er"
  | "11er_modified_rheinland_pfalz"
  | "11er_nrw_remainder"
  | "berlin_a"
  | "berlin_b";

export type BerlinVariantRequest = "A" | "B";

export type FieldBreakdown = {
  bundesfinanzamtsnummer?: string;
  bezirk_number?: string;
  unterscheidungsnummer?: string;
  pruefziffer?: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  source_refs: string[];
};

export type SteuernummerValidationOptions = {
  bundesland?: Bundesland;
  allow_legacy_formats?: boolean;
  strict_official_ranges?: boolean;
  debug?: boolean;
};

export type SteuernummerValidationResult = {
  valid_structure: boolean;
  valid_checksum: boolean;
  bundesland_detected: Bundesland | null;
  method_used: SteuernummerMethod | null;
  format_detected: SteuernummerFormat;
  normalized: string | null;
  formatted: string | null;
  field_breakdown: FieldBreakdown;
  warnings: string[];
  errors: ValidationIssue[];
  checks: CheckResult[];
  structural_only: true;
  assigned_or_active_verified: false;
};

export type GenerateSyntheticSteuernummerInput = {
  bundesland: Bundesland;
  bundesfinanzamtsnummer?: string;
  finanzamt_number?: string;
  bezirk_number?: string;
  unterscheidungsnummer?: string;
  output_format?: "elster_13" | "local";
  generation_mode: "synthetic_test_only";
  allow_legacy_formats?: boolean;
  strict_official_ranges?: boolean;
  seed?: string | number;
  berlin_variant?: BerlinVariantRequest;
};

export type SyntheticSteuernummerResult = {
  synthetic_test_data: true;
  value: string;
  elster_13: string;
  local: string;
  bundesland: Bundesland;
  output_format: "elster_13" | "local";
  field_breakdown: Required<FieldBreakdown>;
  validation_report: SteuernummerValidationResult;
  warnings: string[];
};

export type SteuernummerRule = {
  bundesland: Bundesland;
  displayName: string;
  localFormat: string;
  elsterPattern: string;
  bufaPrefix: string;
  method: Exclude<SteuernummerMethod, "berlin_a" | "berlin_b"> | "berlin";
  factors?: readonly number[];
  minBezirk?: number;
  sourceRefs: readonly string[];
};

export const ELSTER_STEUERNUMMER_SOURCE =
  "ELSTER/Bayerisches Landesamt fuer Steuern, Pruefung der Steuer- und Steueridentifikationsnummer, Stand 2026-04-15";

export const BZST_IDNR_SOURCE =
  "BZSt Online Portal, Steueridentifikationsnummer erhalten, accessed 2026-05-28";

export const SYNTHETIC_STEUERNUMMER_WARNING =
  "SYNTHETIC TEST DATA only. This is structural test data, not an assigned or active Steuernummer and not proof of ELSTER acceptance.";

