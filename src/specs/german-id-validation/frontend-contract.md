# Frontend Contract

## Import

```ts
import { validateGermanIdentityDocumentPublic } from "../src/index";
```

## Form Model

Use one form state object:

```ts
type GermanValidationForm = {
  family: "identity_card" | "passport" | "driving_licence";
  documentType?: string;
  issueDate?: string;
  expiryDate?: string;
  visibleDocumentNumber?: string;
  mrz?: string;
  holderAgeAtIssue?: number;
  holderBirthYear?: number;
  licenceCategories?: string[];
  categoryExpiryDate?: string;
};
```

## Family Field Rules

Identity card:

- show `documentType`;
- show `issueDate`;
- show `expiryDate`;
- show `visibleDocumentNumber`;
- show `holderAgeAtIssue` for ordinary cards;
- show `mrz` only for ordinary cards.

Passport:

- show `documentType`;
- show `issueDate`;
- show `expiryDate`;
- show `visibleDocumentNumber`;
- show `holderAgeAtIssue`;
- show `mrz`.

Driving licence:

- show `documentType`;
- show `issueDate`;
- show `expiryDate`;
- show `visibleDocumentNumber` labelled as "Field 5 licence number";
- show `holderBirthYear` only for legacy/pre-2013 exchange workflows;
- show `licenceCategories`;
- show `categoryExpiryDate` if C/D categories are selected;
- hide `mrz`.

## Status Handling

`valid`:

- Use a neutral success state.
- Text: "The supplied public fields are consistent with the researched public rules."

`invalid`:

- Use an error state.
- Show every issue with `severity: "error"` first.

`not_checked`:

- Use a caution state, not success.
- Text: "One or more fields cannot be checked locally from public rules."

## Source Drawer

Load `data/sourceIndex.json` once. For each issue:

1. Read `issue.sourceIds`.
2. Match each ID to `sourceIndex.json`.
3. Show title, authority, URL, confidence, and notes.

If an issue has no source ID, show it under "Input validation".

## Document-Type Routing Table

| Family | Document type value | Validator route |
| --- | --- | --- |
| `identity_card` | `ordinary_identity_card` | Personalausweis ordinary |
| `identity_card` | `temporary_identity_card` | temporary/provisional Personalausweis |
| `identity_card` | `replacement_identity_card` | replacement Personalausweis |
| `passport` | `ordinary_passport` | ordinary Reisepass |
| `passport` | `ordinary_passport_48_pages` | ordinary 48-page Reisepass |
| `passport` | `temporary_passport` | vorlaeufiger Reisepass |
| `passport` | `child_passport` | legacy Kinderreisepass |
| `passport` | `diplomatic_passport` | diplomatic passport |
| `passport` | `service_passport` | service/official passport |
| `passport` | `non_national_travel_document` | documented adjacent series, not full validation |
| `driving_licence` | `ordinary_driving_licence` | ordinary Fuehrerschein card |
| `driving_licence` | `legacy_driving_licence_exchange_only` | pre-2013 exchange-deadline workflow |
| `driving_licence` | `fahrerqualifizierungsnachweis` | related document, not ordinary card |

## Required Empty-State Copy

Before validation:

`Select a document type and enter the public fields you want to check.`

When no local check exists:

`This field is documented publicly, but no safe public local validation algorithm is available.`

When source evidence is requested:

`Sources show why this field is checked, not proof that a specific document is genuine.`
