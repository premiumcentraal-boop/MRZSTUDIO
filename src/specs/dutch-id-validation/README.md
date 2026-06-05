# Figma Website Handoff

This folder is the implementation handoff for a Figma-built website that already chooses tools based on document type and date inputs.

Use these files together:

1. `01-implementation-plan.md` explains the build phases and integration order.
2. `02-figma-build-prompt.md` is the prompt to paste into Figma/Figma Make or your website-building agent.
3. `03-file-system-and-placement-map.md` tells the builder exactly where each system belongs.
4. `04-full-stack-contract.md` defines request/response models, UI state, and validator usage.
5. `tool-routing-config.json` is a machine-readable routing config for document type/date selection.
6. `ui-copy-and-safety.md` contains publication-safe labels, helper text, warnings, and result copy.

Important date rule:

- Use `issueDate` to select passport, ID-card, and driving-licence model profiles.
- Use `expiryDate` or validity date only for validity-period checks.
- If the existing UI only has a "validity date" field, rename or split it into "Issue date" and "Expiry date" before wiring the validators.
