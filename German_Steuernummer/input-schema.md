# German Steuernummer Input Schema

Status: research-backed schema design, not yet implemented.

All generation must be restricted to SYNTHETIC TEST DATA.

## GenerateSyntheticSteuernummerInput

```ts
type Bundesland =
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

interface GenerateSyntheticSteuernummerInput {
  bundesland: Bundesland;
  bundesfinanzamtsnummer?: string;
  finanzamt_number?: string;
  bezirk_number?: string;
  unterscheidungsnummer?: string;
  output_format: "elster_13" | "local";
  generation_mode: "synthetic_test_only";
  allow_legacy_formats?: boolean;
  strict_official_ranges?: boolean;
  seed?: string | number;
}
```

## Field Rules

| Field | Type | Required | Length | Leading zeros | Depends on Bundesland | Validation |
|---|---|---:|---:|---:|---:|---|
| `bundesland` | enum | yes | n/a | n/a | n/a | Must be one of the supported Bundesland enum values. |
| `bundesfinanzamtsnummer` | numeric string | conditional | 4 | yes | yes | Required in strict generation unless `finanzamt_number` can be expanded. Must match Bundesland and official Finanzamtsdaten in strict mode. |
| `finanzamt_number` | numeric string | conditional | 2 or 3 local digits | yes | yes | Local printed FA component. Can be expanded only where the Bundesland prefix is unambiguous. For ambiguous prefixes, strict mode should prefer full BUFA. |
| `bezirk_number` | numeric string | optional | 3 non-NRW, 4 NRW | yes | yes | Generated if omitted. Must satisfy formal disallowed values and bayerischer Programmierverbund minimums. |
| `unterscheidungsnummer` | numeric string | optional | 4 non-NRW, 3 NRW | yes | yes | Generated if omitted. In NRW, combined `UUUP` after checksum must be greater than `0009`. |
| `output_format` | enum | yes | n/a | n/a | no | `elster_13` returns digits only; `local` returns official local display formatting. |
| `generation_mode` | literal | yes | n/a | n/a | no | Must equal `synthetic_test_only`; reject any other value. |
| `allow_legacy_formats` | boolean | no | n/a | n/a | yes | Allows parsing/formatting of Rheinland-Pfalz old slash-before-check format and Schleswig-Holstein old space-separated format. Does not enable Bayern legacy 2er checksum. |
| `strict_official_ranges` | boolean | no | n/a | n/a | yes | If true, BUFA must exist in versioned official Finanzamtsdaten. If false, only structural prefix/pattern validation is performed and a warning is returned. |
| `seed` | string or number | no | n/a | n/a | no | Deterministic generation seed. Must not encode personal data. |

## Validation Errors

Use stable machine-readable error codes:

| Code | Meaning |
|---|---|
| `unsupported_bundesland` | Bundesland enum is unknown. |
| `generation_mode_required` | `generation_mode` is absent or not `synthetic_test_only`. |
| `non_numeric` | A numeric field contains non-digits after permitted display separators are handled. |
| `invalid_length` | Field length does not match the region-specific rule. |
| `missing_bufa` | Full Bundesfinanzamtsnummer is required but absent. |
| `unknown_bufa` | BUFA is not in the official Finanzamtsdaten set in strict mode. |
| `bufa_region_mismatch` | BUFA exists but belongs to a different Bundesland than requested. |
| `fixed_zero_violation` | Position 5 of ELSTER format is not `0`. |
| `invalid_bezirk` | Bezirk is formally disallowed for the region. |
| `invalid_unterscheidungsnummer` | Unterscheidungsnummer or NRW `UUUP` combination is disallowed. |
| `invalid_checksum` | Check digit does not match. Public mode must not reveal the replacement digit. |
| `legacy_format_not_allowed` | Input uses a known old display format but `allow_legacy_formats` is false. |

## Validation Result Schema

```ts
interface SteuernummerValidationResult {
  valid_structure: boolean;
  valid_checksum: boolean;
  bundesland_detected: Bundesland | null;
  method_used: string | null;
  format_detected: "elster_13" | "local" | "unknown";
  field_breakdown: {
    bundesfinanzamtsnummer?: string;
    bezirk_number?: string;
    unterscheidungsnummer?: string;
    pruefziffer?: string;
  };
  warnings: string[];
  errors: Array<{
    code: string;
    message: string;
    source_refs: string[];
  }>;
  structural_only: true;
  assigned_or_active_verified: false;
}
```

## Conversion Functions

Required helpers:

- `normalize_input(value)` strips permitted separators, rejects non-digits where required, and never silently repairs invalid field length.
- `detect_format(value)` returns `elster_13`, known local display format, legacy local display format, or `unknown`.
- `detect_bundesland_from_finanzamt_number(bufa)` uses the official Finanzamtsdaten source when available. Prefix-only detection is not enough for `3FFF` and `4FFF` families.
- `local_to_elster_13(value, context)` requires Bundesland and, where needed, full BUFA context.
- `elster_13_to_local(value, options)` formats according to the current local display, with legacy output only if explicitly requested.
- `format_for_display(value, bundesland)` renders safe display strings and never claims real-world assignment.
