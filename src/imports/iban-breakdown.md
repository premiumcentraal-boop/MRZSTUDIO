# IBAN Breakdown Tool

## Purpose

Explain the components of an IBAN for debugging payment forms and QA datasets.

## Country/scope

Configured countries from the SWIFT ISO 13616 IBAN Registry.

## Format

Returns:

- Country code.
- Check digits.
- BBAN.
- Bank code where configured.
- Branch code where configured.
- Account number where configured.
- National check digits where configured.

## Validation rules

The breakdown tool runs the IBAN validator first and includes the same check list in its result.

## Generation rules

No generation. Use the IBAN generator.

## Examples

Input: `NL91ABNA0417164300`

Breakdown:

```json
{
  "country": "NL",
  "checkDigits": "91",
  "bban": "ABNA0417164300",
  "bankCode": "ABNA",
  "accountNumber": "0417164300"
}
```

Invalid example: `ZZ00TEST0000000000`

## Source links

- https://www.swift.com/sites/default/files/files/IBAN_Registry.pdf

## Safety notes

Synthetic test data only. Not for real-world use.

Breakdown fields are structural only and do not identify a real bank account holder.

## Confidence level

Partially confirmed: fields are configured from the IBAN registry positions where available. Unsupported fields are returned as unknown.

## API usage

```http
GET /api/breakdown/iban?value=NL91ABNA0417164300
```

## UI usage

Show component cards for country, check digits, BBAN, and known fields. Mark missing country-specific fields as `Unknown`, not as failed.
