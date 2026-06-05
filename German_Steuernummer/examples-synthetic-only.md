# German Steuernummer Synthetic Examples Policy

The TypeScript generator is implemented in `src/steuernummer/generateSynthetic.ts`.

Run it from the project folder:

```bash
npm run generate:steuernummer-examples -- --format elster_13 --seed demo
```

For local display formatting:

```bash
npm run generate:steuernummer-examples -- --format local --seed demo
```

To write JSON:

```bash
npm run generate:steuernummer-examples -- --format elster_13 --seed demo --out steuernummer-examples.json
```

The command returns one generated synthetic example per Bundesland. Every output includes both `elster_13` and `local`, a field breakdown, a validation report, and the synthetic-only warnings.

All future generated fixtures must include:

```json
{
  "synthetic_test_data": true,
  "assigned_or_active_verified": false,
  "structural_only": true,
  "warning": "SYNTHETIC TEST DATA for validation/UI tests only. Not assigned, not active, and not proof of ELSTER acceptance."
}
```

## Example Response Shape

```json
{
  "synthetic_test_data": true,
  "bundesland": "baden_wuerttemberg",
  "output_format": "elster_13",
  "value": "<generated-by-code-after-checksum-implementation>",
  "field_breakdown": {
    "bundesfinanzamtsnummer": "<4 digits>",
    "bezirk_number": "<3 digits>",
    "unterscheidungsnummer": "<4 digits>",
    "pruefziffer": "<1 digit>"
  },
  "validation_report": {
    "valid_structure": true,
    "valid_checksum": true,
    "assigned_or_active_verified": false,
    "structural_only": true
  },
  "warnings": [
    "SYNTHETIC TEST DATA only.",
    "This does not verify a real taxpayer or real Finanzamt assignment.",
    "A structurally valid number may still be rejected by production systems."
  ]
}
```

## Fixture Rules For Future Tests

- One passing generated fixture per Bundesland.
- One failing checksum fixture per Bundesland created by mutating the check digit from a generated passing fixture.
- No personal data.
- No real taxpayer records.
- No public-facing failed-checksum response may disclose the correct replacement check digit.
- Official ELSTER/BZSt examples may be used only as algorithm regression references if explicitly labeled as official documentation examples and never used for real transmissions.

## Deterministic Generation Strategy

1. Require `generation_mode: "synthetic_test_only"`.
2. Select Bundesland rule metadata.
3. Select or generate a BUFA:
   - strict mode: choose from a versioned official test/supported Finanzamtsdaten fixture;
   - non-strict structural mode: choose a structurally plausible prefix/pattern and return a warning.
4. Generate Bezirk within region constraints.
5. Generate Unterscheidungsnummer within region constraints.
6. Calculate the check digit.
7. Reject candidates where the check digit would be multi-digit or where region-specific formal rules fail.
8. Re-validate the result with the validator.
9. Return only with `synthetic_test_data: true`.
