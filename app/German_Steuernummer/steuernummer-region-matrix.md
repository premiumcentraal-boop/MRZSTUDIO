# German Steuernummer Region Matrix

Status: source-backed research gate complete for format and checksum implementation.

Scope: Steuernummer only. Steuer-ID / IdNr is a separate 11-digit personal identifier and must not be mixed into this module.

Primary source: ELSTER / Bayerisches Landesamt fuer Steuern, `Pruefung der Steuer- und Steueridentifikationsnummer`, Stand 2026-04-15.

## ELSTER 13-Digit Model

For every Bundesland except Nordrhein-Westfalen:

| Position | Symbol | Meaning | Enters checksum |
|---:|---|---|---|
| 1 | F1 | Bundesfinanzamtsnummer digit 1 | method-dependent |
| 2 | F2 | Bundesfinanzamtsnummer digit 2 | method-dependent |
| 3 | F3 | Bundesfinanzamtsnummer digit 3 | method-dependent |
| 4 | F4 | Bundesfinanzamtsnummer digit 4 | method-dependent |
| 5 | 0 | fixed zero / Formatschluessel | no, factor/summand zero |
| 6 | B2 | Bezirksnummer digit 1 of 3 | yes |
| 7 | B3 | Bezirksnummer digit 2 of 3 | yes |
| 8 | B4 | Bezirksnummer digit 3 of 3 | yes |
| 9 | U1 | Unterscheidungsnummer digit 1 of 4 | yes |
| 10 | U2 | Unterscheidungsnummer digit 2 of 4 | yes |
| 11 | U3 | Unterscheidungsnummer digit 3 of 4 | yes |
| 12 | U4 | Unterscheidungsnummer digit 4 of 4 | yes |
| 13 | P | pruefziffer | expected result |

Pattern: `FFFF0BBBUUUUP`

For Nordrhein-Westfalen:

| Position | Symbol | Meaning | Enters checksum |
|---:|---|---|---|
| 1 | F1 | Bundesfinanzamtsnummer digit 1 | factor 0 |
| 2 | F2 | Bundesfinanzamtsnummer digit 2 | yes |
| 3 | F3 | Bundesfinanzamtsnummer digit 3 | yes |
| 4 | F4 | Bundesfinanzamtsnummer digit 4 | yes |
| 5 | 0 | fixed zero / Formatschluessel | no |
| 6 | B1 | Bezirksnummer digit 1 of 4 | yes |
| 7 | B2 | Bezirksnummer digit 2 of 4 | yes |
| 8 | B3 | Bezirksnummer digit 3 of 4 | yes |
| 9 | B4 | Bezirksnummer digit 4 of 4 | yes |
| 10 | U2 | Unterscheidungsnummer digit 1 of 3 | yes |
| 11 | U3 | Unterscheidungsnummer digit 2 of 3 | yes |
| 12 | U4 | Unterscheidungsnummer digit 3 of 3 | yes |
| 13 | P | pruefziffer | expected result |

Pattern: `FFFF0BBBBUUUP`

## Formal Rules Shared Across Regions

- ELSTER Steuernummer format is exactly 13 digits.
- Only numeric digits are allowed.
- Position 5 must be `0`, including NRW.
- Bundesfinanzamtsnummer positions 1-4 must be present in the current official ELSTER `Finanzamtsdaten.xml` or `Finanzamtsdaten.xlsx` list when `strict_official_ranges` is enabled.
- For all non-NRW regions, `BBB` must not be `000`, `998`, or `999`.
- For NRW, `BBBB` must not be `0000`, `0998`, or `0999`.
- For Bayern, Brandenburg, Mecklenburg-Vorpommern, Saarland, Sachsen, Sachsen-Anhalt, and Thueringen, `BBB` must be at least `100`.
- In Bayern, the combination `BBB=999`, `UUUU=9999`, `P=9` is forbidden.
- In NRW, the four-digit combination `UUUP` must be greater than `0009`.
- A checksum equation that yields a multi-digit check digit is invalid because valid Steuernummern have a one-digit pruefziffer.

## Bundesland Coverage Matrix

Legend:
- Local format uses `F` for local printed Finanzamt digits, `B` for Bezirk, `U` for Unterscheidungsnummer, `P` for check digit.
- BUFA prefix/pattern describes how the four-digit Bundesfinanzamtsnummer appears in ELSTER format before the fixed zero.
- `High` confidence means format and checksum are directly covered by the official ELSTER PDF. `Medium` means the rule also needs a current official Finanzamtsdaten file for exhaustive BUFA validation or state detection.

| Bundesland | Official local display format | ELSTER 13 pattern | BUFA prefix/pattern | Checksum method | Checksum positions/factors | Region-specific rules and edge cases | Confidence |
|---|---|---|---|---|---|---|---|
| Baden-Wuerttemberg | `FFBBB/UUUUP` | `28FF0BBBUUUUP` | `28FF` | 2er-Verfahren | Summands `0,0,9,8,0,7,6,5,4,3,2,1`; factors `0,0,512,256,0,128,64,32,16,8,4,2` | Non-NRW district rules. Local display does not include the full BUFA; ELSTER requires it. | High for checksum; Medium for live BUFA list |
| Bayern | `FFF/BBB/UUUUP` | `9FFF0BBBUUUUP` | `9FFF` | 11er-Verfahren | `0,5,4,3,0,2,7,6,5,4,3,2` | 2er legacy was fully replaced and is no longer valid. `BBB >= 100`. `999/9999/9` combination forbidden. Some official notices may omit local `FFF`; external input should handle this only with explicit Finanzamt context. | High |
| Berlin | `FF/BBB/UUUUP` | `11FF0BBBUUUUP` | `11FF` | Berlin-A or Berlin-B 11er | A: `0,0,0,0,0,7,6,5,8,4,3,2`; B: `0,0,2,9,0,8,7,6,5,4,3,2` | Berlin uses only the newer local display where last two BUFA digits are printed; leading zeros in Bezirk and Unterscheidungsnummer are printed. See Berlin routing table below. | High for checksum; Medium for BUFA route updates |
| Brandenburg | `FFF/BBB/UUUUP` | `3FFF0BBBUUUUP` | `3FFF` | 11er-Verfahren | `0,5,4,3,0,2,7,6,5,4,3,2` | `BBB >= 100`. BUFA leading `3` overlaps Sachsen and Sachsen-Anhalt; detect state from official BUFA list, not prefix alone. | High for checksum; Medium for state detection |
| Bremen | `FF BBB UUUUP` | `24FF0BBBUUUUP` | `24FF` | 11er-Verfahren | `0,0,4,3,0,2,7,6,5,4,3,2` | Non-NRW district rules. | High |
| Hamburg | `FF/BBB/UUUUP` | `22FF0BBBUUUUP` | `22FF` | 11er-Verfahren | `0,0,4,3,0,2,7,6,5,4,3,2` | Non-NRW district rules. | High |
| Hessen | `0FF BBB UUUUP` | `26FF0BBBUUUUP` | `26FF` | 2er-Verfahren | Same 2er summands/factors as Baden-Wuerttemberg | Leading local `0` is often omitted by tax advisers; parser may accept omission only as a normalization option with warning. | High |
| Mecklenburg-Vorpommern | `FFF/BBB/UUUUP` | `4FFF0BBBUUUUP` | `4FFF` | 11er-Verfahren | `0,5,4,3,0,2,7,6,5,4,3,2` | `BBB >= 100`. BUFA leading `4` overlaps Thueringen; detect state from official BUFA list, not prefix alone. | High for checksum; Medium for state detection |
| Niedersachsen | `FF/BBB/UUUUP` | `23FF0BBBUUUUP` | `23FF` | 11er-Verfahren | `0,0,2,9,0,8,7,6,5,4,3,2` | Non-NRW district rules. | High |
| Nordrhein-Westfalen | `FFF/BBBB/UUUP` | `5FFF0BBBBUUUP` | `5FFF` | NRW 11er remainder method | `0,3,2,1,0,7,6,5,4,3,2,1` | 4-digit Bezirk, 3-digit Unterscheidungsnummer. `BBBB` not `0000`, `0998`, `0999`. `UUUP > 0009`. Check digit is `sum % 11`, not the complement. Remainder `10` is invalid. | High |
| Rheinland-Pfalz | `FF/BBB/UUUUP` current; old legacy display `FF/BBB/UUUU/P` | `27FF0BBBUUUUP` | `27FF` | Modified 11er-Verfahren | `0,0,1,2,0,1,2,1,2,1,2,1` with product transform | EOSS change removed the slash before `P`; parser may support legacy display only when `allow_legacy_formats` is true. | High |
| Saarland | `FFF/BBB/UUUUP` | `1FFF0BBBUUUUP` | `1FFF` | 11er-Verfahren, Bayern-style | Official table lists Saarland factors as `0,5,4,3,0,2,7,6,5,4,3,2` after the Saarland note marker | `BBB >= 100`. Saarland adopted Bayern format and new Bayern 11er checksum. | High |
| Sachsen | `FFF/BBB/UUUUP` | `3FFF0BBBUUUUP` | `3FFF` | 11er-Verfahren | `0,5,4,3,0,2,7,6,5,4,3,2` | `BBB >= 100`. BUFA leading `3` overlaps Brandenburg and Sachsen-Anhalt; detect state from official BUFA list. | High for checksum; Medium for state detection |
| Sachsen-Anhalt | `FFF/BBB/UUUUP` | `3FFF0BBBUUUUP` | `3FFF` | 11er-Verfahren | `0,5,4,3,0,2,7,6,5,4,3,2` | `BBB >= 100`. BUFA leading `3` overlaps Brandenburg and Sachsen; detect state from official BUFA list. | High for checksum; Medium for state detection |
| Schleswig-Holstein | `FF/BBB/UUUUP` current; old legacy display `FF BBB UUUUP` | `21FF0BBBUUUUP` | `21FF` | 2er-Verfahren | Same 2er summands/factors as Baden-Wuerttemberg | EOSS changed official display from spaces to slashes; parser may support old display only when `allow_legacy_formats` is true. | High |
| Thueringen | `FFF/BBB/UUUUP` | `4FFF0BBBUUUUP` | `4FFF` | 11er-Verfahren | `0,5,4,3,0,2,7,6,5,4,3,2` | `BBB >= 100`. BUFA leading `4` overlaps Mecklenburg-Vorpommern; detect state from official BUFA list. | High for checksum; Medium for state detection |

## Berlin-A / Berlin-B Routing

Use the official BUFA-specific routing before choosing the Berlin checksum factor set.

| BUFA | Default | Berlin-B exceptions |
|---|---|---|
| 1113 Charlottenburg | Berlin-A | Bezirke 201-693 |
| 1114 Friedrichshain-Kreuzberg | Berlin-A | Bezirke 201-693 |
| 1115 Berlin International | Berlin-B | none |
| 1116 Neukoelln | Berlin-A | Bezirke 001-029, 201-693, 875-899 |
| 1117 Reinickendorf | Berlin-A | Bezirke 201-693 |
| 1118 Schoeneberg | Berlin-B | none |
| 1119 Spandau | Berlin-A | Bezirke 201-639, plus 680 and 684 |
| 1120 Steglitz | Berlin-A | Bezirke 201-693 |
| 1121 Tempelhof | Berlin-A | Bezirke 201-693 |
| 1123 Wedding | Berlin-A | Bezirke 201-693 |
| 1124 Wilmersdorf | Berlin-A | Bezirke 201-693 |
| 1125 Zehlendorf | Berlin-A | Bezirke 201-693 |
| 1127 Berlin fuer Koerperschaften I | Berlin-A | none |
| 1129 Berlin fuer Koerperschaften III | Berlin-A | none |
| 1130 Fuer Koerperschaften IV | Berlin-A | none |
| 1131 Prenzlauer Berg | Berlin-B | none |
| 1132 Lichtenberg | Berlin-B | none |
| 1133 Marzahn-Hellersdorf | Berlin-B | none |
| 1134 Mitte/Tiergarten | Berlin-B | none |
| 1135 Pankow/Weissensee | Berlin-B | none |
| 1136 Treptow-Koepenick | Berlin-B | none |
| 1137 Berlin fuer Koerperschaften II | Berlin-B | none |
| 1138 Fuer Fahndung und Strafsachen Berlin | Berlin-B | none |
| 1194 Berlin Betreuungssystem | Berlin-B | test/system context only |
| 1195 Berlin Referenzsystem | Berlin-B | test/system context only |
| 1196 Berlin Schulungssystem | Berlin-B | test/system context only |
| 1197 Berlin Testsystem | Berlin-B | test/system context only |
| 1198 Berlin Abnahmesystem | Berlin-B | test/system context only |

## Implementation Gate

Implementation may proceed for:

- ELSTER 13 normalization and parsing.
- Local display parsing/formatting based on the matrix above.
- Checksum validation and synthetic generation.
- Steuer-ID validation in a separate module.

Implementation must still source or version:

- The current official `Finanzamtsdaten.xml`/`Finanzamtsdaten.xlsx` for strict BUFA validation.
- A rule for periodically updating the official Finanzamt list.
