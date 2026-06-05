# Implementation Plan: Dutch ID Validation Website

## Goal

Integrate the Dutch ID validation library into the existing Figma website so users can choose a document type and date, then receive the correct validation tools for Dutch passports, identity cards, and driving licences from `2016-06-01` through `2026-06-01`.

The site must remain validation-only. It must never claim a document, BSN, or licence is genuine, assigned, current, not stolen, or owned by a person.

## Existing System Assumption

The current website already has:

- A document type selector.
- A date input currently described as validity date.
- A tool-selection system that shows tools based on user input.

Required adjustment:

- Model selection must use `issueDate`, not expiry/validity date.
- Keep `expiryDate` as a separate optional field for validity-period checks.

## Phase 1: Data And Routing

Add these files from the validation library:

- `src/modelSeries.ts`
- `src/unifiedValidator.ts`
- `src/bsn.ts`
- `src/mrz.ts`
- `src/travelDocumentNumber.ts`
- `src/drivingLicence.ts`
- `src/types.ts`
- `data/model-series-2016-2026.json`
- `data/rulesets.json`
- `data/sources.json`

Add this handoff config:

- `figma-handoff/tool-routing-config.json`

Routing logic:

1. User selects `family`.
2. User selects `documentType`.
3. User enters `issueDate`.
4. Call `resolveDutchModelSeries({ family, documentType, issueDate })`.
5. Render tools based on `validationProfileId`, `publicChecks`, and `unavailableChecks`.

## Phase 2: UI Structure

Build one main checker page with four work zones:

- Left: document inputs.
- Center: active tool panels.
- Right: model profile and evidence summary.
- Bottom: validation results and safety notes.

Do not make a marketing landing page. The first screen should be the usable checker.

## Phase 3: Tool Panels

Render panels dynamically:

Passport and travel documents:

- Document number panel.
- MRZ TD3 panel.
- BSN panel when user supplies BSN or when model notes indicate BSN placement.
- Model profile panel.

Identity card:

- Document number panel.
- MRZ TD1 panel.
- CAN presence note for 2021-01-04 and later.
- BSN QR/readable placement note for model 2021 and later.
- Model profile panel.

Driving licence:

- Licence number public-surface panel.
- BSN panel.
- One-line MRZ surface panel.
- Validity-period panel with application date, expiry date, categories, and age context.
- Model profile panel.

## Phase 4: Validation Execution

Use `validateDutchIdentityDocumentPublic(input)` for the page-level validation.

Call specialized functions only for isolated panels:

- `validateBsn`
- `parseMrz`
- `validateDutchTravelDocumentNumber`
- `validateDutchDrivingLicencePublic`
- `resolveDutchModelSeries`

Result display:

- `valid`: green status, "Public checks passed."
- `invalid`: red status, show failed public rule.
- `not_checked`: amber status, show what cannot be verified from public sources.

## Phase 5: Source Traceability

Each result issue must show:

- issue code;
- plain-language message;
- source IDs;
- optional "Why this is limited" text.

Add a source drawer that reads `data/sources.json` by `sourceIds`.

## Phase 6: Privacy And Safety

Do not store user-entered values by default.

Do not send values to analytics.

Do not include complete real examples in docs, screenshots, previews, or tests.

The website must show this disclaimer near the result area:

"This checks public format and consistency rules only. It is not an official identity, document-status, or authenticity verification."

## Acceptance Tests

- Selecting national passport + `2024-10-01` shows model 2024 passport tools.
- Selecting identity card + `2021-01-05` shows 2014/CAN submodel tools.
- Selecting driving licence + `2025-06-01` shows driving licence 2025 tools.
- Entering a driving licence number returns `not_checked`, not `valid`, because no public checksum is implemented.
- Entering emergency passport shows base number checks but unresolved prefix warning.
- MRZ TD3 sample parses only in passport flow.
- MRZ TD1 sample parses only in identity-card flow.
