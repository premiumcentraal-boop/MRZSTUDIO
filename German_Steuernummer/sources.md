# German Steuernummer Source Register

Access date: 2026-05-28

This project is limited to structural validation and SYNTHETIC TEST DATA generation for software tests. It does not verify identity, assignment, tax status, or ELSTER acceptance of any real taxpayer number.

## Official Sources Used

1. ELSTER / Bayerisches Landesamt fuer Steuern, `Pruefung der Steuer- und Steueridentifikationsnummer sowie der Ordnungskriterien bei der Grundsteuer`, Stand: 2026-04-15.
   URL: https://download.elster.de/download/schnittstellen/Pruefung_der_Steuer_und_Steueridentifikatsnummer.pdf
   Used for:
   - Steuer-ID / IdNr formal structure and ISO 7064 MOD 11,10 algorithm.
   - Rule that failed-checksum output must not disclose the correct replacement check digit in public-facing messages.
   - ELSTER 13-digit Steuernummer structure.
   - Local display examples for every Bundesland.
   - Formal Steuernummer checks.
   - Checksum method matrix by Bundesland.
   - 2er-Verfahren equation.
   - 11er-Verfahren equation and state factors.
   - Rheinland-Pfalz modified 11 method.
   - Berlin-A / Berlin-B routing.
   - NRW-specific checksum handling.
   - Current statement that Bayern 2er legacy numbers are no longer valid.

2. BZSt Online Portal, `Steueridentifikationsnummer erhalten`.
   URL: https://online.portal.bzst.de/SharedDocs/Leistungsbeschreibung/DE/erneute_mitteilung_der_ID-Nr.html
   Used for:
   - BZSt statement that citizens receive a Steueridentifikationsnummer automatically.
   - BZSt statement that the IdNr is a non-speaking number: no personal data and no responsible Finanzamt can be read from the number.
   - BZSt statement that it remains valid for life and does not change after moving or marriage.

3. ELSTER `Finanzamtsdaten.xml` / `Finanzamtsdaten.xlsx` documentation reference.
   Source statement is in official ELSTER PDF source 1, sections 4, 6.2, and 9.
   Used for:
   - Requirement that Bundesfinanzamtsnummer must be checked against the current ELSTER-supported Finanzamt/Testfinanzamt list.
   - Implementation note: do not hard-code the whole list from historical examples. Download or ship a versioned copy of the official `Finanzamtsdaten.xml`/`Finanzamtsdaten.xlsx`.

## Sources Explicitly Not Used As Authority

- Random GitHub implementations.
- Forum snippets.
- StackOverflow posts.
- Blog articles.
- Wikipedia.
- Commercial tax-software help pages.

These may be useful only as regression comparisons after the official equations are implemented.

## Compliance Notes

- Official ELSTER examples in the PDF are examples/test references and must not be presented as production-valid numbers.
- Generated values in this project must always include `synthetic_test_data: true`.
- A structurally valid Steuernummer is not proof that the number is assigned, active, or accepted by a Finanzamt.
- Public-facing validation must not reveal the correct replacement check digit after checksum failure.
