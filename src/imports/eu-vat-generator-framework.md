# EU VAT Generator Framework

## Purpose

Generate country-prefixed, format-valid synthetic VAT numbers for software tests.

## Country/scope

EU VAT prefixes plus `XI` for Northern Ireland VIES-style test scenarios.

## Format

Country prefix plus a configured body pattern. Examples:

- `DE` plus 9 digits.
- `NL` plus 9 digits, `B`, and 2 digits.
- `AT` plus `U` and 8 digits.

## Validation rules

Generated output is passed through the EU VAT validator framework before it is returned.

## Generation rules

- Generate only format-valid synthetic values.
- Do not perform VIES lookups.
- Do not claim assignment to a real business.
- Attach the synthetic-only warning.

## Examples

Valid synthetic example: `DE111111111`

Invalid example: `DE123`

## Source links

- https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-identification-numbers_en
- https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm

## Safety notes

Synthetic test data only. Not for real-world use.

Never connect generated VAT numbers to real businesses, real invoices, KYC flows, or tax filings.

## Confidence level

Format-only. Country-specific checksum generation remains blocked until official national rules are confirmed.

## API usage

```http
GET /api/generate/eu/vat?country=DE
```

Example response shape:

```json
{
  "value": "DE111111111",
  "formatted": "DE 111111111",
  "country": "DE",
  "type": "eu-vat",
  "synthetic": true,
  "warning": "Synthetic test data only. Not for real-world use. Format-valid only; no VIES existence check is performed."
}
```

## UI usage

Show country selection, generate button, result card, copy button, JSON output, source panel, and badges for `Format-only`, `Synthetic only`, and `No live lookup`.
