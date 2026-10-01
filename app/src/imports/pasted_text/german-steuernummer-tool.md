Figma Make Prompt: Add German Steuernummer Tool
Build a new tool on the existing Validate & Generate Tools page for German tax-number examples.

Safety Boundary
This is a compliance-focused synthetic data tool.

Do not claim generated values are real, assigned, active, or accepted by ELSTER.
Do not use personal data.
Every generated Steuernummer example must be labeled SYNTHETIC TEST DATA.
Validation is structural/checksum validation only.
Public validation errors must not reveal the corrected replacement check digit.
Steuer-ID / IdNr must be shown as separate from Steuernummer.
Files To Import / Use
Add these source files to the Figma site codebase using the same paths if possible:

src/steuernummer/types.ts
src/steuernummer/rules.ts
src/steuernummer/normalize.ts
src/steuernummer/detect.ts
src/steuernummer/convert.ts
src/steuernummer/checksums.ts
src/steuernummer/validate.ts
src/steuernummer/generateSynthetic.ts
src/steuernummer/metadata.ts
src/steuernummer/index.ts

src/steuerId/checksum.ts
src/steuerId/validate.ts
src/steuerId/metadata.ts
src/steuerId/index.ts
Also update these existing exports/routes if they exist in the hosted app:

src/synthetic-data.ts
src/api/routes.ts
Reference docs to keep in the project or attach as implementation notes:

docs/sources.md
docs/steuernummer-region-matrix.md
docs/equations.md
docs/input-schema.md
docs/examples-synthetic-only.md
Tests and CLI helper are optional for Figma hosting, but useful for development:

tests/steuernummer/steuernummer.test.cjs
tests/steuerId/steuer-id.test.cjs
scripts/generate-steuernummer-examples.mjs
New Tool Card
On the Validate & Generate Tools page, add a new card:

German Steuernummer
Generate and validate SYNTHETIC TEST DATA examples for all German Bundeslaender.
Supports ELSTER 13-digit format, local display format, regional checksums, Berlin A/B, NRW, and Steuer-ID distinction.
Primary actions:

Generate examples
Validate number
Convert format
Open docs
Generator UI
Create a generator panel with:

Bundesland dropdown with all 16 Bundeslaender:
Baden-Wuerttemberg
Bayern
Berlin
Brandenburg
Bremen
Hamburg
Hessen
Mecklenburg-Vorpommern
Niedersachsen
Nordrhein-Westfalen
Rheinland-Pfalz
Saarland
Sachsen
Sachsen-Anhalt
Schleswig-Holstein
Thueringen
Output format segmented control:
ELSTER 13
Local display
Optional seed input for repeatable test data.
Optional fields:
Bundesfinanzamtsnummer
Bezirk number
Unterscheidungsnummer
Hidden/fixed generation value:
generation_mode: "synthetic_test_only"
Button:
Generate synthetic example
When clicked, call:

import { generateSyntheticSteuernummer } from "@/steuernummer";

const result = generateSyntheticSteuernummer({
  bundesland,
  generation_mode: "synthetic_test_only",
  output_format,
  seed,
  bundesfinanzamtsnummer,
  bezirk_number,
  unterscheidungsnummer,
});
Display:

Generated value
ELSTER 13 value
Local display value
Bundesland
Method used
Field breakdown:
Bundesfinanzamtsnummer
Bezirk
Unterscheidungsnummer
Pruefziffer
Validation result:
valid_structure
valid_checksum
structural_only
assigned_or_active_verified
Warning banner:
SYNTHETIC TEST DATA only. Not assigned, not active, and not proof of ELSTER acceptance.
Also add a secondary button:

import { generateSyntheticExamples } from "@/steuernummer";

const allExamples = generateSyntheticExamples({
  output_format,
  seed,
});
This should render one synthetic example per Bundesland in a table.

Validator UI
Create a validator panel with:

Input text field: Steuernummer
Bundesland dropdown:
optional for ELSTER 13 when detectable
required for local display formats
Toggle:
Allow legacy local display formats
Button:
Validate
Call:

import { validate } from "@/steuernummer";

const result = validate(value, {
  bundesland,
  allow_legacy_formats,
  strict_official_ranges: false,
  debug: false,
});
Display:

valid_structure
valid_checksum
detected Bundesland
detected format
method used
normalized ELSTER 13 value
local display value
field breakdown
warnings
errors
Do not display the corrected replacement check digit on checksum failure.

Conversion UI
Create a small conversion panel:

Input Steuernummer
Bundesland dropdown
Buttons:
Local to ELSTER 13
ELSTER 13 to local
Use:

import { localToElster13, elster13ToLocal } from "@/steuernummer";
For local-to-ELSTER, require Bundesland. For ambiguous prefixes, show a warning that strict Finanzamt assignment detection requires an official Finanzamtsdaten file.

Steuer-ID / IdNr Panel
Add a separate compact panel named:

Steuer-ID / IdNr Validator
Explain in one short note:

Steuer-ID is not a Steuernummer. It is 11 digits, non-speaking, lifelong, and encodes no Bundesland or Finanzamt.
Input:

Steuer-ID value
Toggle:
Allow official test leading zero
Call:

import { validate as validateSteuerId } from "@/steuerId";

const result = validateSteuerId(value, {
  allow_official_test_leading_zero,
  debug: false,
});
Display:

valid_structure
valid_checksum
checks
warnings
errors
Do not add a public Steuer-ID generator.

Important UI Behavior
Use labels like Synthetic example, not Valid taxpayer number.
Never say “real”, “assigned”, “active”, or “ELSTER accepted”.
If a result passes structure and checksum, phrase it as:
Structurally valid synthetic example
If a result fails checksum, phrase it as:
Checksum failed
Do not show the expected replacement digit.
Show a constant disclaimer near the tool:
This tool validates structure and checksum only. It does not verify taxpayer identity, Finanzamt assignment, or real-world tax status.
Recommended Page Layout
Use the existing Validate & Generate Tools page style.

Sections:

Tool header: German Steuernummer
Safety/disclaimer banner
Tabs:
Generate
Validate
Convert
Steuer-ID
Sources
Result panel below the active tab
For generated examples, include copy buttons for:
value
ELSTER 13
local display
Source / Docs Tab
Show these source links:

ELSTER/Bayerisches Landesamt fuer Steuern, Pruefung der Steuer- und Steueridentifikationsnummer, Stand 2026-04-15:
https://download.elster.de/download/schnittstellen/Pruefung_der_Steuer_und_Steueridentifikatsnummer.pdf
BZSt Online Portal, Steueridentifikationsnummer erhalten:
https://online.portal.bzst.de/SharedDocs/Leistungsbeschreibung/DE/erneute_mitteilung_der_ID-Nr.html
Also show:

Current implementation does not bundle official Finanzamtsdaten.xml/xlsx.
Therefore strict Finanzamt assignment validation is not enabled.
Bundesfinanzamtsnummer checks are structural unless a versioned official Finanzamtsdaten file is added later.
Acceptance Checks
After implementation:

Generating one example for each Bundesland works.
Generated examples all show synthetic_test_data: true.
Generated examples pass valid_structure and valid_checksum.
Mutating the last digit makes checksum validation fail.
NRW uses method 11er_nrw_remainder.
Berlin can produce both berlin_a and berlin_b method results.
Local-to-ELSTER conversion round-trips generated examples.
Steuer-ID validation is separate and does not show location/state info.
No UI text claims real assignment, taxpayer identity, or ELSTER acceptance.