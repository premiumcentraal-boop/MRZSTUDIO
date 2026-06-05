# German Steuernummer Equation Pack

Status: source-backed research notes, implementation-ready but not yet coded.

All examples in this document are symbolic placeholders. Do not treat any constructed number as assigned, active, or accepted by ELSTER.

## Digit Model

Let `d[1..13]` be the ELSTER 13-digit Steuernummer.

- `d[5]` must be `0`.
- `d[13]` is the check digit.
- The checksum input is generally `d[1..12]`, with zero factors/summands for ignored positions.

## 2er-Verfahren

Applicable Bundeslaender:

- Baden-Wuerttemberg
- Hessen
- Schleswig-Holstein

Official summands by positions 1-12:

```text
0, 0, 9, 8, 0, 7, 6, 5, 4, 3, 2, 1
```

Official factors by positions 1-12:

```text
0, 0, 512, 256, 0, 128, 64, 32, 16, 8, 4, 2
```

Equation:

1. For each `i` from 1 to 12:
   - `s[i] = (d[i] + summand[i]) mod 10`
   - `product[i] = s[i] * factor[i]`
   - `q[i] = digital_root(product[i])`, where repeated digit-summing is applied until a single digit remains.
2. `sum = Σ q[i]`
3. If `sum mod 10 == 0`, check digit is `0`.
4. Otherwise, check digit is `10 - (sum mod 10)`.

Equivalent compact formula:

```text
p = (10 - (sum mod 10)) mod 10
```

Valid iff `p == d[13]`.

## Modified 11er-Verfahren, Rheinland-Pfalz

Applicable Bundesland:

- Rheinland-Pfalz

Official factors by positions 1-12:

```text
0, 0, 1, 2, 0, 1, 2, 1, 2, 1, 2, 1
```

Equation:

1. For each `i` from 1 to 12:
   - `product[i] = d[i] * factor[i]`
   - If `product[i]` has two digits, replace it with `(product[i] mod 10) + 1`.
   - Otherwise keep it as-is.
2. `sum = Σ transformed_product[i]`
3. `p = (10 - (sum mod 10)) mod 10`
4. Valid iff `p == d[13]`.

Note: although ELSTER names this the modified 11er procedure, the final complement is to the next higher number divisible by 10.

## 11er-Verfahren, General Complement Variant

Applicable Bundeslaender:

- Bayern
- Berlin, after selecting Berlin-A or Berlin-B factor set
- Brandenburg
- Bremen
- Hamburg
- Mecklenburg-Vorpommern
- Niedersachsen
- Saarland
- Sachsen
- Sachsen-Anhalt
- Thueringen

General equation:

1. Select the state-specific factor vector for positions 1-12.
2. `sum = Σ(d[i] * factor[i])`
3. If `sum mod 11 == 0`, check digit is `0`.
4. Otherwise, check digit is `11 - (sum mod 11)`.
5. If the result is `10`, the candidate is structurally invalid because valid Steuernummern have a one-digit check digit.
6. Valid iff `p == d[13]`.

Equivalent compact formula:

```text
p = (11 - (sum mod 11)) mod 11
valid_check_digit_exists = p <= 9
```

### 11er Factors

| Bundesland / variant | Factors for positions 1-12 |
|---|---|
| Bayern | `0,5,4,3,0,2,7,6,5,4,3,2` |
| Berlin-A | `0,0,0,0,0,7,6,5,8,4,3,2` |
| Berlin-B | `0,0,2,9,0,8,7,6,5,4,3,2` |
| Brandenburg | `0,5,4,3,0,2,7,6,5,4,3,2` |
| Bremen | `0,0,4,3,0,2,7,6,5,4,3,2` |
| Hamburg | `0,0,4,3,0,2,7,6,5,4,3,2` |
| Mecklenburg-Vorpommern | `0,5,4,3,0,2,7,6,5,4,3,2` |
| Niedersachsen | `0,0,2,9,0,8,7,6,5,4,3,2` |
| Saarland | `0,5,4,3,0,2,7,6,5,4,3,2` |
| Sachsen | `0,5,4,3,0,2,7,6,5,4,3,2` |
| Sachsen-Anhalt | `0,5,4,3,0,2,7,6,5,4,3,2` |
| Thueringen | `0,5,4,3,0,2,7,6,5,4,3,2` |

## 11er-Verfahren, NRW Remainder Variant

Applicable Bundesland:

- Nordrhein-Westfalen

Official NRW factors by positions 1-12:

```text
0, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1
```

Equation:

1. `sum = Σ(d[i] * factor[i])`
2. `p = sum mod 11`
3. If `p == 10`, the candidate is invalid because valid Steuernummern have a one-digit check digit.
4. Valid iff `p == d[13]`.

Important difference: NRW uses the remainder itself as the check digit. It does not use the complement to the next multiple of 11.

## Berlin-A / Berlin-B Variant Selection

The checksum method is selected by BUFA and sometimes by Bezirk.

Implementation flow:

1. Confirm `d[1..4]` is a Berlin BUFA from the official Finanzamt list.
2. Extract `BBB = d[6..8]`.
3. Use the routing table in `docs/steuernummer-region-matrix.md`.
4. Apply the selected factor vector.

Do not attempt to choose Berlin-A or Berlin-B by trying both and accepting either in strict mode. That can hide data-entry errors. A permissive diagnostic mode may report that the other variant would have matched, but public-facing validation should not offer replacement numbers.

## Bayern Legacy Handling

Official current rule: Bayern uses only the new 11er-Verfahren. The former Bayern 2er-Verfahren has been fully replaced; Steuernummern calculated under Bayern 2er are no longer valid.

Implementation:

- Default and strict mode: reject Bayern 2er.
- `allow_legacy_formats` must not re-enable Bayern 2er checksum acceptance unless a future official source explicitly restores a legacy acceptance rule.

## Steuer-ID / IdNr Equation

This belongs in a separate `steuerId` module, not in Steuernummer code.

For an 11-digit Steuer-ID:

- First 10 digits are payload.
- 11th digit is check digit.
- Use ISO 7064 MOD 11,10 as published in the official ELSTER PDF.

Equation over the first 10 digits:

```text
product = 10
for each digit x:
  sum = (x + product) mod 10
  if sum == 0: sum = 10
  product = (2 * sum) mod 11
check = 11 - product
if check == 10: check = 0
```

Additional official structure:

- No leading zero, except official test identification numbers.
- In the first 10 positions, exactly one digit appears two or three times.
- If a digit appears three times, those equal digits must not be adjacent.
- Public-facing checksum failure must not disclose the correct check digit.
