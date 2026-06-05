# Full-Stack Contract

## Core Function

Use this function for the page-level validator:

```ts
import { validateDutchIdentityDocumentPublic } from "@/lib/dutch-id-validation";
```

## Request Model

```ts
type DutchDocumentValidationRequest = {
  family: "passport" | "identity_card" | "driving_licence";
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
```

## Response Model

```ts
type ValidationResult<T> = {
  status: "valid" | "invalid" | "not_checked";
  value?: T;
  issues: Array<{
    code: string;
    message: string;
    severity: "error" | "warning" | "info";
    sourceIds?: string[];
  }>;
  sourceIds: string[];
};
```

## Model Profile Output

```ts
type ModelSeriesEntry = {
  id: string;
  family: "passport" | "identity_card" | "driving_licence";
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
```

## API Route Option

If the website uses server routes, create:

```text
POST /api/dutch-id/validate
```

Request body:

```json
{
  "family": "passport",
  "documentType": "national_passport",
  "issueDate": "2024-10-01",
  "visibleDocumentNumber": "NXABCDE19"
}
```

Response body:

```json
{
  "status": "valid",
  "value": {
    "modelProfiles": [
      {
        "id": "NL-PASSPORT-2024-NATIONAL-BUSINESS-ALIEN-REFUGEE",
        "modelName": "Dutch passport model 2024: national, business, alien, and refugee"
      }
    ],
    "normalizedVisibleDocumentNumber": "NXABCDE19"
  },
  "issues": [],
  "sourceIds": ["SRC-RVIG-MODEL-2024-FAQ", "SRC-RVIG-PASSPORT-2024-BROCHURE"]
}
```

## Client-Side Option

The validators are pure TypeScript. If no server is needed, call them client-side and avoid logging inputs.

Recommended:

- Client-side validation for instant UI feedback.
- No persistence of entered values.
- No analytics on raw field values.

## Tool Selection Contract

Call:

```ts
resolveDutchModelSeries({ family, documentType, issueDate });
```

Then:

- Merge all `validationProfileId` values from returned profiles.
- Read `publicChecks` and `unavailableChecks`.
- Render matching panels.

Panel mapping:

| Profile/check | Panel |
| --- | --- |
| `NL-PASSPORT-ID-VISIBLE-NUMBER` | `TravelDocumentNumberPanel` |
| `ICAO-MRZ-TD1-TD2-TD3` and passport | `MrzPanel` in TD3 mode |
| `ICAO-MRZ-TD1-TD2-TD3` and identity card | `MrzPanel` in TD1 mode |
| `NL-BSN-VISIBLE-DOCUMENT-11PROEF` | `BsnPanel` |
| `NL-DRIVING-LICENCE-PUBLIC-SURFACE` | Driving licence panels |
| Any model profile | `ModelProfilePanel` |

## Severity Mapping

| Severity | UI |
| --- | --- |
| `error` | Red issue row; result `invalid` |
| `warning` | Amber issue row; result `not_checked` |
| `info` | Neutral issue row; does not block validity |

## Privacy Contract

Do not persist:

- BSN.
- MRZ.
- Document number.
- Driving licence number.
- Date of birth.
- Full user-entered validation payload.

Allowed telemetry:

- selected family;
- selected document type;
- result status;
- issue codes without raw values.
