# File System Map For Website Implementation

Copy this folder into the site repo as a validation module:

```txt
lib/german-validation/
  src/
    index.ts
    types.ts
    coreStandards.ts
    mrz.ts
    modelSeries.ts
    personalausweis.ts
    passport.ts
    drivingLicence.ts
  data/
    sourceIndex.json
    rulesets.json
    model-series-2016-2026.json
    researchStatus.json
  docs/
    validation-matrix.md
    validation-limits.md
    model-series-2016-2026.md
    uncertainty-log.md
```

Recommended app structure:

```txt
app/
  german-validation/
    page.tsx
    components/
      DocumentFamilyTabs.tsx
      DocumentTypeSelect.tsx
      DynamicValidationFields.tsx
      ValidationResultPanel.tsx
      SourceDrawer.tsx
      SafetyBoundaryBanner.tsx
lib/
  german-validation/
    src/
    data/
    docs/
```

## Component Responsibilities

`DocumentFamilyTabs`

- lets users choose identity card, passport, or driving licence;
- resets document-type-specific fields when family changes.

`DocumentTypeSelect`

- uses the document type routing table from `frontend-contract.md`;
- keeps display labels human-readable and passes canonical values to the validator.

`DynamicValidationFields`

- renders only fields relevant to the selected family and document type;
- preserves ISO date input format `YYYY-MM-DD`.

`ValidationResultPanel`

- calls `validateGermanIdentityDocumentPublic(formState)`;
- groups issues by severity;
- never rewrites `not_checked` as success.

`SourceDrawer`

- loads `data/sourceIndex.json`;
- resolves `sourceIds`;
- shows source title, URL, authority, confidence, and notes.

`SafetyBoundaryBanner`

- always visible near results;
- uses copy from `website-copy-rules.md`.

## Data Ownership

Do not hardcode model dates or source URLs in UI components. Read them from:

- `data/model-series-2016-2026.json`
- `data/sourceIndex.json`
- validator return payloads

## Build Notes

The validation code is TypeScript ESM. Keep `.ts` imports using the repo's module style or adjust the build config consistently when integrating into a frontend framework.
