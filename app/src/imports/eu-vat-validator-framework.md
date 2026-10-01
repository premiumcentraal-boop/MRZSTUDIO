# EU VAT Validator Framework

## Purpose

Validate EU VAT number prefixes and country-specific format patterns for test-data workflows.

## Country/scope

EU VAT prefixes plus `XI` for Northern Ireland VIES-style test scenarios.

## Format

Generally, a VAT identification number begins with a country code followed by a block of digits or characters. Each country uses its own format.

## Validation rules

- Normalize spaces, punctuation, and lowercase input.
- Detect or require a VAT country prefix.
- Check the configured country body format.
- Return `format-only` confidence.
- Do not call VIES by default.
- Do not claim that a VAT number exists or belongs to a business.

## Generation rules

No generation in this validator page. Use the EU VAT generator framework.

## Examples

Valid format-only example: `DE123456789`

Invalid example: `DE123`

## Source links

- https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-identification-numbers_en
- https://europa.eu/youreurope/business/taxation/vat/check-vat-number-vies/index_en.htm

## Safety notes

Synthetic test data only. Not for real-world use.

VIES is a search engine over national VAT databases, not a local format checker. Live VIES validation must be separate, explicit, and never run for generated values by default.

## Confidence level

Format-only. Country checksum algorithms are blocked until official national sources are documented.

## API usage

```http
GET /api/validate/eu/vat?value=DE123456789
```

## UI usage

Show `Format-only`, `Synthetic only`, and `No live lookup` badges. The explanation panel must say that passing the validator does not prove VAT registration.
