You are Opus 4.7 acting as a senior full-stack engineer, API architect, and product designer.

Project context:
We are building a Europe-first “Validate & Generate” tools website. The site already contains tools for synthetic test data generation and validation, such as IBAN, VAT, SEPA references, company numbers, and country-specific business identifiers.

Now add a real Dutch KVK lookup and validator tool to the website.

Important clarification:
This tool is NOT a fake company generator. It is a real KVK number lookup/validator that checks whether a Dutch KVK number exists in public/company data sources and displays as much available company information as possible.

The tool should be added under:
- Validate & Generate
- Country tools
- Netherlands
- Company identifiers

Tool name:
KVK Number Validator & Company Lookup

Primary use case:
A user enters a Dutch KVK number. The site validates the format, searches an API source, and returns available public company information.

Main API source:
Use OpenKvK via Overheid.io V3 as the primary practical lookup source.

Base endpoint:
https://api.overheid.io/v3/openkvk

Search example:
GET https://api.overheid.io/v3/openkvk?query=58488340&queryfields[]=kvknummer

Then fetch the detail record from the returned self.href or slug if available.

Optional fallback sources:
1. Official KVK Basisprofiel API, if API credentials are available.
2. KVK Open Dataset Basis Bedrijfsgegevens API, if available and useful.
3. If no external API key is configured, the UI should still perform local KVK format validation and show a clear “lookup unavailable” message.

Important:
Do not scrape KVK.nl.
Do not expose API keys in frontend code.
All external API requests must go through a backend API route or serverless function.
Cache results where allowed to reduce API usage.
Show source and confidence labels clearly.
Do not claim the result is a legally certified KVK extract.
Add a disclaimer that for legally binding information users should request an official extract from KVK.nl.

Build the following functionality:

1. Local KVK format validation

Create:
src/countries/nl/kvk.ts

Functions:
- normalizeKvkNumber(value)
- validateKvkFormat(value)
- formatKvkNumber(value)
- explainKvkNumber(value)
- getKvkMetadata()

Rules:
- Remove spaces, dots, and dashes.
- KVK number should be exactly 8 digits.
- Reject letters and special characters.
- Return a structured validation result.
- There is no reliable checksum that proves a KVK number exists, so format validation alone must not be presented as “registered company found.”

Return example:
{
  "valid": true,
  "normalized": "58488340",
  "formatted": "58488340",
  "type": "nl_kvk_number",
  "checks": [
    {
      "name": "length",
      "passed": true,
      "details": "KVK number has 8 digits."
    },
    {
      "name": "digits_only",
      "passed": true,
      "details": "KVK number contains only digits."
    }
  ],
  "confidence": "format-valid-only"
}

2. Backend lookup API

Create an internal backend route:

GET /api/nl/kvk/lookup?kvk=58488340

This route should:
- Normalize the KVK number.
- Validate the local format first.
- If invalid, return a 400 response with validation details.
- If valid, call the configured external provider.
- Start with OpenKvK / Overheid.io.
- Use an environment variable for the API key.

Environment variables:
OPENKVK_API_KEY=
OPENKVK_BASE_URL=https://api.overheid.io/v3/openkvk

Do not put the API key in client-side code.

Provider architecture:
Create:
src/providers/openkvk.ts

Functions:
- searchOpenKvkByKvkNumber(kvkNumber)
- fetchOpenKvkDetail(detailUrlOrSlug)
- mapOpenKvkCompany(raw)
- getOpenKvkProviderMetadata()

If the search returns multiple results:
- Prefer exact kvknummer match.
- Prefer hoofdvestiging if available.
- Otherwise return the best match and include all matches in a secondary list.

If the detail URL is available:
- Fetch details.
- Merge search result and detail result.

3. Data model

Create a normalized company profile model:

type KvkCompanyProfile = {
  kvkNumber: string;
  branchNumber?: string | null;
  name?: string | null;
  statutoryName?: string | null;
  tradeNames?: string[];
  currentTradeNames?: string[];
  legalForm?: string | null;
  legalFormCode?: string | null;
  active?: boolean | null;
  registrationType?: string | null;
  registrationDate?: string | null;
  website?: string | null;
  activities?: Array<{
    sbiCode?: string | null;
    sbiDescription?: string | null;
    isMainActivity?: boolean | null;
  }>;
  address?: {
    street?: string | null;
    houseNumber?: string | null;
    houseNumberAddition?: string | null;
    postalCode?: string | null;
    city?: string | null;
    municipality?: string | null;
    province?: string | null;
    country?: string | null;
    fullAddress?: string | null;
    coordinates?: {
      lat?: number | null;
      lon?: number | null;
    } | null;
  } | null;
  mailingRestricted?: boolean | null;
  source: {
    provider: "openkvk" | "kvk_official" | "kvk_open_dataset" | "local_format_only";
    sourceUrl?: string | null;
    retrievedAt: string;
    updatedAt?: string | null;
    confidence: "official" | "public-data-match" | "format-valid-only" | "not-found" | "error";
  };
  raw?: unknown;
};

4. API response shape

The backend route should return:

Success:
{
  "ok": true,
  "input": "58488340",
  "normalized": "58488340",
  "formatValidation": {
    "valid": true,
    "checks": [...]
  },
  "found": true,
  "company": {
    ...
  },
  "matches": [],
  "disclaimer": "This lookup uses public/open company data and is not a legally certified KVK extract. For legally binding information, use KVK.nl."
}

Not found:
{
  "ok": true,
  "input": "12345678",
  "normalized": "12345678",
  "formatValidation": {
    "valid": true,
    "checks": [...]
  },
  "found": false,
  "company": null,
  "matches": [],
  "source": {
    "provider": "openkvk",
    "confidence": "not-found"
  },
  "message": "The KVK number format is valid, but no company was found in the configured lookup source."
}

Invalid:
{
  "ok": false,
  "input": "ABC",
  "normalized": null,
  "formatValidation": {
    "valid": false,
    "checks": [...]
  },
  "error": "Invalid KVK number format."
}

5. Frontend UI page

Create page:
 /countries/netherlands/kvk-validator
or:
 /tools/nl-kvk-validator

The page should include:
- Title: KVK Number Validator & Company Lookup
- Subtitle: Validate a Dutch KVK number and search public company data.
- Input field with placeholder: “Enter KVK number, e.g. 58488340”
- Validate button
- Loading state
- Error state
- Not found state
- Result card
- Copy JSON button
- Copy company name button
- Source/confidence panel
- Disclaimer panel

Result card should show:
- Company name
- KVK number
- Branch number / vestigingsnummer
- Active status
- Legal form
- Trade names
- Website
- SBI activities
- Address or partial address if available
- Last updated
- Source provider
- Confidence level

Use badges:
- Format valid
- Company found
- Public data match
- Official source, only if official KVK API is used
- Not a certified extract

6. Add the tool to the website navigation

Add it to:
- Validate & Generate
- Netherlands
- Company identifiers
- Business lookup tools

Tool card:
Title:
KVK Number Validator

Description:
Validate a Dutch KVK number and search available public company data.

Tags:
- Netherlands
- Company
- KVK
- Validator
- Lookup
- Public data

7. Add API documentation page

Create:
docs/tools/nl-kvk-validator.md

Include:
- What the tool does
- Local format validation rules
- Lookup provider
- API endpoint
- Example request
- Example response
- Environment variables
- Data fields returned
- Source confidence explanation
- Limitations
- Disclaimer

Also update:
docs/research/research-matrix.md

Add row:
Tool: Netherlands KVK Number Validator & Company Lookup
Scope: Netherlands
Type: Company identifier lookup
Calculation: 8-digit format validation plus external lookup
Primary source: OpenKvK / Overheid.io
Optional source: official KVK API
Confidence: public-data-match or official if official API enabled
Safety note: not a certified extract, no scraping, API keys server-side only

8. Add tests

Create tests:
tests/countries/nl/kvk.test.ts
tests/providers/openkvk.test.ts
tests/api/nlKvkLookup.test.ts

Test cases:
- valid 8-digit input
- input with spaces
- input with dots or dashes
- too short
- too long
- letters
- empty input
- OpenKvK found response
- OpenKvK not found response
- OpenKvK API error
- missing API key
- detail fetch merge
- exact match selection
- frontend renders found result
- frontend renders not found result
- frontend renders lookup unavailable state

9. Caching and rate limits

Add simple server-side caching:
- Cache successful lookups for a reasonable period, for example 24 hours, if allowed by provider terms.
- Cache not-found responses for a shorter period, for example 1 hour.
- Do not cache API errors as final results.
- Add basic rate limiting on the public endpoint to prevent abuse.

If the project already has a cache layer, use it.
If not, create a small abstraction:
src/core/cache.ts

10. Error handling

Handle:
- invalid KVK format
- missing API key
- external API timeout
- external API 401/403
- external API 404
- external API 429
- malformed provider response
- provider unavailable

User-facing error messages should be clear and calm:
- “The KVK number format is invalid.”
- “The KVK number format is valid, but no company was found.”
- “The lookup provider is temporarily unavailable.”
- “API credentials are not configured. Local validation is still available.”

11. Security requirements

- Never expose OPENKVK_API_KEY to the browser.
- Do not log full raw API responses in production.
- Sanitize and normalize user input.
- Apply timeout to provider requests.
- Add rate limiting to prevent automated abuse.
- Do not scrape websites.
- Do not bypass provider restrictions.
- Respect API terms and attribution requirements.

12. Acceptance criteria

The work is complete when:
- The local KVK format validator works.
- The backend lookup route works.
- OpenKvK provider integration exists.
- The frontend page exists and is linked in the tool directory.
- The result page displays rich company information when available.
- The system clearly distinguishes:
  - format-valid only
  - company found
  - public-data match
  - official source, only if official API is configured
  - not found
- API keys are only server-side.
- Docs are added.
- Tests are added.
- Error states are handled.
- The disclaimer is visible.
- No scraping is used.
- The tool fits the existing Validate & Generate website design.

Now implement the KVK Number Validator & Company Lookup tool end-to-end.