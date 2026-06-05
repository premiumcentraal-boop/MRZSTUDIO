# Global IBAN Validator

## Purpose

Validate IBAN syntax and checksum for test-data workflows.

## Country/scope

Global countries configured from the SWIFT ISO 13616 IBAN Registry.

## Format

Electronic format uses uppercase letters and digits with no spaces. Print format may group every 4 characters with spaces.

## Validation rules

- Normalize lowercase and spaces.
- Check country code.
- Check country length.
- Check allowed characters.
- Check BBAN structure.
- Validate ISO/IEC 7064 MOD97-10 remainder equals `1`.

## Generation rules

This tool validates only. Use the IBAN generator for synthetic values.

## Examples

Valid example: `NL91 ABNA 0417 1643 00`

Invalid example: `NL00 ABNA 0417 1643 00`

## Source links

- https://www.swift.com/sites/default/files/files/IBAN_Registry.pdf

## Safety notes

Synthetic test data only. Not for real-world use.

Passing validation does not prove that an account exists or can receive payments.

## Confidence level

Confirmed for configured countries.

## API usage

```http
GET /api/validate/iban?value=NL91ABNA0417164300
```

## UI usage

Show input, normalized value, print formatted value, per-check breakdown, and a warning that no bank-directory lookup is performed.
