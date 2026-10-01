# German Steuernummer Tool Bundle

Minimal bundle for adding the German Steuernummer tool to a Figma-hosted site.

## What This Bundle Contains

```text
src/core/types.ts
src/steuernummer/*.ts
src/steuerId/*.ts
docs/*.md
```

The `src` folder contains the runtime logic:

- Generate SYNTHETIC TEST DATA Steuernummer examples.
- Validate Steuernummer structure and checksum.
- Convert local display format to ELSTER 13 and back.
- Validate Steuer-ID / IdNr separately.

The `docs` folder contains:

- Official source notes.
- Equation notes.
- Region matrix.
- Figma implementation prompt.

## How To Add To Figma Site Code

1. Copy this bundle's `src/core/types.ts` only if the target site does not already have it.
2. Copy this bundle's `src/steuernummer` folder into the target site's `src`.
3. Copy this bundle's `src/steuerId` folder into the target site's `src`.
4. Use `docs/FIGMA_STEUERNUMMER_TOOL_PROMPT.md` as the prompt/instructions for building the UI on the Validate & Generate Tools page.

## Main Imports

```ts
import {
  generateSyntheticSteuernummer,
  generateSyntheticExamples,
  validate,
  localToElster13,
  elster13ToLocal,
} from "@/steuernummer";

import { validate as validateSteuerId } from "@/steuerId";
```

## Safety Rules

- Generated Steuernummer values are SYNTHETIC TEST DATA only.
- Do not claim examples are real, assigned, active, or ELSTER accepted.
- Do not use personal data.
- Public checksum errors must not reveal the corrected replacement digit.
- Steuer-ID is separate from Steuernummer and has no Bundesland or Finanzamt encoded.

## Quick Example

```ts
const example = generateSyntheticSteuernummer({
  bundesland: "bayern",
  generation_mode: "synthetic_test_only",
  output_format: "elster_13",
  seed: "demo",
});
```

The returned object includes:

- `synthetic_test_data: true`
- `value`
- `elster_13`
- `local`
- `field_breakdown`
- `validation_report`
- safety warnings
