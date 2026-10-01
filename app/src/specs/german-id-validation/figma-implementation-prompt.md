# Prompt For Figma Website Implementation

Build the German document validation experience using the completed research and TypeScript validation library in this repository.

## Goal

Create a practical validation tool for German documents from the 2016-06-01 through 2026-06-01 research window. The user selects document family, document type, issue date, validity/expiry date, and optional document-specific fields. The UI calls the correct validator and shows public consistency results with source-backed caveats.

## Source Files To Consume

Place or import these files into the website app:

- `src/index.ts`
- `src/types.ts`
- `src/coreStandards.ts`
- `src/mrz.ts`
- `src/modelSeries.ts`
- `src/personalausweis.ts`
- `src/passport.ts`
- `src/drivingLicence.ts`
- `data/sourceIndex.json`
- `data/rulesets.json`
- `data/model-series-2016-2026.json`
- `data/researchStatus.json`

Use docs for UI labels and source drawers:

- `docs/validation-matrix.md`
- `docs/validation-limits.md`
- `docs/model-series-2016-2026.md`
- `docs/uncertainty-log.md`

## Main API

Call:

```ts
import { validateGermanIdentityDocumentPublic } from "./src/index";
```

Input shape:

```ts
{
  family: "identity_card" | "passport" | "driving_licence",
  documentType?: string,
  issueDate?: "YYYY-MM-DD",
  expiryDate?: "YYYY-MM-DD",
  visibleDocumentNumber?: string,
  mrz?: string | string[],
  holderAgeAtIssue?: number,
  holderBirthYear?: number,
  licenceCategories?: string[],
  categoryExpiryDate?: "YYYY-MM-DD"
}
```

Return shape:

```ts
{
  status: "valid" | "invalid" | "not_checked",
  value?: unknown,
  issues: Array<{
    code: string,
    message: string,
    severity: "error" | "warning" | "info",
    sourceIds?: string[]
  }>,
  sourceIds: string[]
}
```

## Document Routing

Identity card:

- `ordinary_identity_card`
- `temporary_identity_card`
- `replacement_identity_card`

Show fields:

- issue date;
- expiry date;
- visible document number;
- MRZ for ordinary identity cards;
- holder age at issue for ordinary validity checks.

Passport:

- `ordinary_passport`
- `ordinary_passport_48_pages`
- `temporary_passport`
- `child_passport`
- `diplomatic_passport`
- `service_passport`
- `temporary_diplomatic_passport`
- `temporary_service_passport`
- `non_national_travel_document`

Show fields:

- issue date;
- expiry date;
- visible document number;
- MRZ;
- holder age at issue;
- child-passport warning for 2024-01-01 and later.

Driving licence:

- `ordinary_driving_licence`
- `legacy_driving_licence_exchange_only`
- `fahrerqualifizierungsnachweis`

Show fields:

- issue date;
- expiry/validity date;
- field 5 licence number;
- holder birth year for legacy exchange deadlines;
- licence categories;
- category expiry date for C/D category checks.

Do not show MRZ as a normal driving-licence field.

## Result UI

Use three result states:

- `valid`: public fields are consistent with researched public rules.
- `invalid`: at least one source-backed public rule failed.
- `not_checked`: a field exists, but no safe public algorithm or official local route exists.

Always show a safety banner:

`This is a public consistency check, not an official authenticity, status, or identity verification.`

Show issue groups:

- Errors: failed source-backed rule.
- Warnings: not checked or authority-only.
- Info: caveats and local-validation boundaries.

For every issue with `sourceIds`, show a source drawer that resolves IDs from `data/sourceIndex.json`.

## Required Blocked Claims

Never display:

- "genuine document"
- "officially verified"
- "currently valid"
- "not lost or stolen"
- "identity verified"
- "safe to accept"
- "holder may drive"

Allowed wording:

- "public fields are structurally consistent"
- "MRZ check digits match"
- "date range is plausible"
- "authority verification required"
- "field not checked because no public algorithm exists"

## Implementation Finish Criteria

- All three document families route through `validateGermanIdentityDocumentPublic`.
- Document-type selectors dynamically show only relevant fields.
- Result panel preserves `valid`, `invalid`, and `not_checked`.
- Source drawer resolves all `sourceIds`.
- Driving licence field 5 never claims checksum validity.
- No generators or fake-document examples are added.
