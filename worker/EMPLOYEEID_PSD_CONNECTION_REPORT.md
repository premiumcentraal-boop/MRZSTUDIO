# EmployeeID.psd Connection Report

This report connects the `EMPLOYEEID_BACKBONE.md` internal-badge target model to the actual PSD currently installed at:

```text
C:\Users\Agent\Documents\New project\Figma PSD Editor\local-worker\templates\EmployeeID.psd
```

## Key Finding

The actual PSD does not have the clean parent structure from the backbone:

```text
BADGE_CONTENT/EMPLOYEE_INFO/FIRST
BADGE_CONTENT/PHOTOS/MAIN_PHOTO
```

Instead, the actual PSD is an embedded-smart-object template with these parent groups:

```text
Background BACK
Background FRONT
Text
PERFO
Photo
DublePhoto
Signature
```

The production Photoshop script now supports both:

1. A future clean backbone PSD with `BADGE_CONTENT/...` paths.
2. The actual embedded `EmployeeID.psd` currently in `local-worker/templates`.

## Actual PSD Properties

Parsed with `ag-psd`:

```text
Width: 4108 px
Height: 1276 px
Embedded/linked files: 9
```

This differs from the backbone's documented 1050 x 660 px. The worker will still process this PSD, but the backbone document is not a literal description of the current file.

## Actual Text Connection

The employee text fields from the backbone are inside this parent smart object:

```text
Text/Text Edit
```

That smart object opens an embedded PSD named `MRZ.psd`, which contains the actual editable text layers:

```text
FIRST
LAST
DOCNMBR
CODE
ENDVALID
VALID
BIRTHDATE
YEAR
GENDER
HEIGHT
COUNTRY
CITYBIRTH
LOCATION
```

The script edits those 13 backbone layers plus the internal-card `MRZ` text layer.
If the incoming job includes `mrz`, `MRZ`, `mrz_text`, or `mrzText`, that value is
used as-is. Otherwise the worker derives a deterministic three-line internal-card
MRZ string from issuer code, document number, birth date, expiry date, gender,
personal number, and name.

## Text Field Mapping

| Backbone Target | Incoming Field | Actual PSD Edit Location |
| --- | --- | --- |
| `FIRST` | `first_name` | `Text/Text Edit/FIRST` |
| `LAST` | `last_name` | `Text/Text Edit/LAST` |
| `DOCNMBR` | `doc_number` | `Text/Text Edit/DOCNMBR` |
| `CODE` | `personal_number` | `Text/Text Edit/CODE` |
| `ENDVALID` | `expires` | `Text/Text Edit/ENDVALID` |
| `VALID` | `valid_from` | `Text/Text Edit/VALID` |
| `BIRTHDATE` | `birth_date` | `Text/Text Edit/BIRTHDATE` |
| `YEAR` | `birth_year` | `Text/Text Edit/YEAR` |
| `GENDER` | `gender` | `Text/Text Edit/GENDER` |
| `HEIGHT` | `height` | `Text/Text Edit/HEIGHT` |
| `COUNTRY` | `country_of_birth` | `Text/Text Edit/COUNTRY` |
| `CITYBIRTH` | `city_of_birth` | `Text/Text Edit/CITYBIRTH` |
| `LOCATION` | `company_location` | `Text/Text Edit/LOCATION` |
| `MRZ` | incoming `mrz` or generated internal MRZ | `Text/Text Edit/MRZ` |

The script preserves the existing text layer font, size, color, position, alignment, effects, opacity, and blend mode by changing only `textItem.contents`.

## Supporting Date Layers In Actual PSD

The actual PSD also has supporting birth-year/date layers that are not in the clean backbone:

```text
Photo/BIG_DATE_1
Photo/BIG_DATE_2
DublePhoto/SMALLDATE/FIRST_2_DIGITS
DublePhoto/SMALLDATE/LAST_2_DIGITS
```

The script derives these from `YEAR`.

Example:

```text
YEAR = 1990
BIG_DATE_1 = 1990
BIG_DATE_2 = 1990
FIRST_2_DIGITS = 19
LAST_2_DIGITS = 90
```

## PERFO Connection

The actual PSD contains three PERFO hosts:

```text
PERFO/PERFO1
PERFO/PERFO2
PERFO/PERFO3
```

The worker derives:

```text
PERFO_STRING = birth month + birth year
```

Example:

```text
birth_date = 06/14/1990
PERFO_STRING = 061990
```

The script opens each PERFO smart object and writes the six digits vertically.
If the inner `PERFO.psd` contains one text layer, it writes:

```text
0
6
1
9
9
0
```

If it contains six text layers, it writes one digit per layer from top to bottom.

## Actual Image Connection

The backbone has one `MAIN_PHOTO` and one `SIGNATURE_AREA`. The current actual PSD uses `SMALL_PHOTO` as the single photo source, so the worker only updates that smart object.

| Incoming Asset | Actual Parent Smart Object | Internal Target |
| --- | --- | --- |
| `images.photo_path` | `DublePhoto/SMALL_PHOTO` | `SMALL_IMAGE_1` |
| `images.signature_path` | `Signature/Signature` | `SIGNATURE_1` |

`SMALL_PHOTO` is resized to `2421 x 3292 px` at `300 DPI` before being pasted. `BIG_PHOTO` is no longer processed.

## Included Internal-Card Security Artwork

The current internal company card workflow includes:

```text
PERFO/PERFO1
PERFO/PERFO2
PERFO/PERFO3
Text/Text Edit/MRZ
```

These are now connected and edited by the worker for internal company badge use.

## Worker Connection

Supabase job flow:

```text
badge_jobs row
  -> local-worker/job-adapter.js
  -> local-worker/current-job/input.json
  -> local-worker/scripts/run_employeeid_job.jsx
  -> local-worker/output/{job_id}/result.*
  -> badge-outputs/{job_id}/result.*
```

Main runnable worker:

```text
C:\Users\Agent\Documents\New project\Figma PSD Editor\local-worker\worker.js
```

Main Photoshop automation script:

```text
C:\Users\Agent\Documents\New project\Figma PSD Editor\local-worker\scripts\run_employeeid_job.jsx
```

Verification script:

```text
C:\Users\Agent\Documents\New project\Figma PSD Editor\local-worker\scripts\verify_template.jsx
```

The verification script now detects both `backbone` mode and `actual_employeeid_embedded` mode.
