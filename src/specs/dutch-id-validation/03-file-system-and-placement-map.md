# File System And Placement Map

This map tells the website builder where to place each system.

## Recommended App Structure

```text
app/
  routes/
    dutch-id-validator/
      page.tsx
      components/
        DocumentSelector.tsx
        DateInputs.tsx
        ActiveToolPanels.tsx
        ResultSummary.tsx
        SourceDrawer.tsx
        SafetyNotice.tsx
      panels/
        BsnPanel.tsx
        TravelDocumentNumberPanel.tsx
        MrzPanel.tsx
        DrivingLicenceNumberPanel.tsx
        DrivingLicenceMrzPanel.tsx
        DrivingLicenceValidityPanel.tsx
        ModelProfilePanel.tsx
  lib/
    dutch-id-validation/
      index.ts
      types.ts
      bsn.ts
      mrz.ts
      travelDocumentNumber.ts
      drivingLicence.ts
      modelSeries.ts
      unifiedValidator.ts
    dutch-id-validation-data/
      model-series-2016-2026.json
      rulesets.json
      sources.json
      tool-routing-config.json
```

## File Placement

Copy from this library:

| Source file | Place in website |
| --- | --- |
| `src/index.ts` | `app/lib/dutch-id-validation/index.ts` |
| `src/types.ts` | `app/lib/dutch-id-validation/types.ts` |
| `src/bsn.ts` | `app/lib/dutch-id-validation/bsn.ts` |
| `src/mrz.ts` | `app/lib/dutch-id-validation/mrz.ts` |
| `src/travelDocumentNumber.ts` | `app/lib/dutch-id-validation/travelDocumentNumber.ts` |
| `src/drivingLicence.ts` | `app/lib/dutch-id-validation/drivingLicence.ts` |
| `src/modelSeries.ts` | `app/lib/dutch-id-validation/modelSeries.ts` |
| `src/unifiedValidator.ts` | `app/lib/dutch-id-validation/unifiedValidator.ts` |
| `data/model-series-2016-2026.json` | `app/lib/dutch-id-validation-data/model-series-2016-2026.json` |
| `data/rulesets.json` | `app/lib/dutch-id-validation-data/rulesets.json` |
| `data/sources.json` | `app/lib/dutch-id-validation-data/sources.json` |
| `figma-handoff/tool-routing-config.json` | `app/lib/dutch-id-validation-data/tool-routing-config.json` |

## Component Placement

### `DocumentSelector.tsx`

Responsibilities:

- Select `family`.
- Select `documentType`.
- Reset incompatible fields when family changes.

Use route config:

- `families`
- `documentTypesByFamily`

### `DateInputs.tsx`

Responsibilities:

- Always collect `issueDate`.
- Optionally collect `expiryDate`.
- For driving licences, collect `applicationDate` if validity-period check is enabled.

Do not use expiry date to resolve model profile.

### `ActiveToolPanels.tsx`

Responsibilities:

- Read `family`, `documentType`, and `issueDate`.
- Call `resolveDutchModelSeries`.
- Read active validation profiles.
- Render relevant panels.

### `ModelProfilePanel.tsx`

Responsibilities:

- Show model names from `modelProfiles`.
- Show issue-date range.
- Show `publicChecks`.
- Show `unavailableChecks`.
- Show source badges.

### `ResultSummary.tsx`

Responsibilities:

- Call `validateDutchIdentityDocumentPublic`.
- Group issues by severity.
- Show `valid`, `invalid`, or `not_checked`.
- Never display "genuine", "officially valid", or "assigned".

### `SourceDrawer.tsx`

Responsibilities:

- Load `sources.json`.
- Resolve `sourceIds` from model profiles and validation issues.
- Display title, authority, URL, accessed date, and notes.

### `SafetyNotice.tsx`

Responsibilities:

- Always show the required disclaimer.
- Keep it visible near the result summary.

## State Shape

```ts
type ValidatorFormState = {
  family: "passport" | "identity_card" | "driving_licence";
  documentType?: string;
  issueDate?: string;
  expiryDate?: string;
  visibleDocumentNumber?: string;
  bsn?: string;
  mrz?: string;
  drivingLicenceNumber?: string;
  drivingLicenceMrzLine?: string;
  categories?: string[];
  holderAgeAtApplication?: number;
};
```
