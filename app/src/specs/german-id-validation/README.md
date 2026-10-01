# German Validation Figma Handoff

Status: ready for website implementation.

This folder packages the finished German validation research and implementation contract for a Figma-built website or app.

## What To Send To The Figma Site Builder

Use these files together:

- `figma-implementation-prompt.md`: paste this into the Figma site builder or implementation assistant.
- `frontend-contract.md`: exact inputs, outputs, statuses, and UI state rules.
- `file-system-map.md`: where each research, data, source, validator, and test file belongs.
- `website-copy-rules.md`: required public-safety wording and blocked claims.

## Core Runtime Entry Point

The website should call:

```ts
validateGermanIdentityDocumentPublic(input)
```

from:

```txt
src/index.ts
```

This routes:

- `family: "identity_card"` to the Personalausweis validator.
- `family: "passport"` to the Reisepass validator.
- `family: "driving_licence"` to the Fuehrerschein validator.

## Non-Negotiable Boundary

The site must describe results as public consistency checks only. It must never say a document is genuine, officially issued, currently valid, not lost/stolen, not withdrawn, or belongs to a specific person.
