# Prompt For Figma Website Builder

Use this prompt as the build instruction for the existing Figma website.

```text
You are implementing a production-quality Dutch identity-document validation website. The site already has a document-type/date driven tool-selection system. Upgrade it to use the attached Dutch ID validation library and model-series data.

Primary goal:
Build the actual validation tool interface as the first screen. Do not create a marketing landing page. The user should immediately be able to select a document family, document type, issue date, and optional validation fields.

Documents covered:
- Dutch passports and travel documents from the 2016-06-01 to 2026-06-01 issue-date window.
- Dutch identity cards from the same window.
- Dutch driving licences from the same window.

Important date handling:
- Use issueDate to select the model profile. This is required.
- Use expiryDate or validity date only for validity-period checks.
- If the current UI only has a "validity date" field, split it into two fields:
  1. Issue date
  2. Expiry date

Core validator files:
- src/index.ts
- src/unifiedValidator.ts
- src/modelSeries.ts
- src/bsn.ts
- src/mrz.ts
- src/travelDocumentNumber.ts
- src/drivingLicence.ts
- src/types.ts

Core data files:
- data/model-series-2016-2026.json
- data/rulesets.json
- data/sources.json
- figma-handoff/tool-routing-config.json

Main API to call:
validateDutchIdentityDocumentPublic(input)

Input shape:
{
  family: "passport" | "identity_card" | "driving_licence",
  documentType?: string,
  issueDate?: "YYYY-MM-DD",
  visibleDocumentNumber?: string,
  bsn?: string,
  mrz?: string | string[],
  drivingLicenceNumber?: string,
  drivingLicenceMrzLine?: string,
  drivingLicenceValidity?: {
    applicationDate: "YYYY-MM-DD",
    expiryDate: "YYYY-MM-DD",
    categories?: string[],
    holderAgeAtApplication?: number
  }
}

UI layout:
- Use a dense, professional operational-tool layout.
- Left column: document family, document type, issue date, expiry date, category controls.
- Center area: active validation panels selected by document type/date.
- Right column: model profile, public checks, unavailable checks, and sources.
- Bottom area: validation result summary with issue list and safety disclaimer.

Tool panel routing:
- Passport:
  - Show visible document-number panel.
  - Show TD3 MRZ panel.
  - Show BSN panel only as optional, never required for all passport types.
  - Show model profile and source drawer.
- Identity card:
  - Show visible document-number panel.
  - Show TD1 MRZ panel.
  - Show CAN note for 2021-01-04 and later.
  - Show BSN QR/readable placement note for model 2021 and later.
  - Show model profile and source drawer.
- Driving licence:
  - Show driving licence number panel.
  - Show BSN panel.
  - Show one-line MRZ panel.
  - Show validity-period panel.
  - Show model profile and source drawer.

Result states:
- valid: public checks passed. Do not say the document is genuine.
- invalid: a source-backed public rule failed.
- not_checked: public sources are insufficient for the requested deeper claim.

Required disclaimer:
"This checks public format and consistency rules only. It is not an official identity, document-status, or authenticity verification."

Never claim:
- A BSN is assigned.
- A document is genuine.
- A document is currently valid.
- A document is not lost, stolen, withdrawn, or cancelled.
- A chip, QR code, or physical security feature is authentic.

Design rules:
- Keep the app utilitarian and trust-focused.
- Use clear form controls and compact validation panels.
- Avoid decorative hero sections, marketing copy, or oversized cards.
- Use tabs or segmented controls for document family.
- Use select menus for document type.
- Use date inputs for issue and expiry date.
- Use checkboxes/toggles for optional supplied fields.
- Use source badges for source IDs.
- Use amber warning styling for not_checked outcomes.

Acceptance criteria:
- National passport + issueDate 2024-10-01 routes to Dutch passport model 2024 tools.
- Identity card + issueDate 2021-01-05 routes to identity-card CAN submodel profile.
- Driving licence + issueDate 2025-06-01 routes to driving licence 2025 profile.
- Driving licence number validation returns not_checked with a public-source limitation warning.
- Emergency passport validation checks base number structure but marks first-letter prefix unresolved.
- Source drawer displays source metadata from data/sources.json.
```
