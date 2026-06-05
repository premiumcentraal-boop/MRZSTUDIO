# Global IBAN Generator

## Purpose

Generate synthetic IBAN values for software tests using country-specific BBAN structures and ISO/IEC 7064 MOD97-10 check digits.

## Country/scope

Global countries configured from the SWIFT ISO 13616 IBAN Registry. This first pass includes major European IBAN countries and several nearby registry countries.

## Format

`CCKKBBBB...`

- `CC`: two-letter ISO 3166-1 country code.
- `KK`: two IBAN check digits.
- `BBBB...`: country-specific BBAN.

## Validation rules

- Normalize by removing spaces and uppercasing.
- Check supported country code.
- Check country-specific IBAN length.
- Check country-specific BBAN pattern.
- Move first 4 characters to the end.
- Convert letters `A=10` through `Z=35`.
- MOD97 remainder must equal `1`.

## Generation rules

- Generate a random BBAN from the configured registry pattern.
- Calculate check digits with MOD97.
- Validate the generated IBAN before returning.
- Do not claim that the bank code or account exists.

## Examples

Valid synthetic example: `NL91CCCC1111111111`

Invalid example: `NL00TEST0000000001`

## Source links

- https://www.swift.com/sites/default/files/files/IBAN_Registry.pdf

## Safety notes

Synthetic test data only. Not for real-world use.

Generated IBANs are syntactically valid only. They must never be connected to real people, real companies, real bank accounts, real invoices, or payment attempts.

## Confidence level

Confirmed for IBAN structure and MOD97 check digits. Domestic BBAN sub-checks are not claimed unless separately implemented later.

## API usage

```http
GET /api/generate/iban?country=NL
```

Example response shape:

```json
{
  "value": "NL91CCCC1111111111",
  "formatted": "NL91 CCCC 1111 1111 11",
  "country": "NL",
  "type": "iban",
  "synthetic": true,
  "warning": "Synthetic test data only. Not for real-world use."
}
```

## UI usage

Show a country selector, generate button, copy button, JSON output, and badges for `Checksum validated`, `Synthetic only`, and `Official source confirmed`.
