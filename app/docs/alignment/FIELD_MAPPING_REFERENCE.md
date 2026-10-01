# ID Generator Field Mapping Reference

Quick reference for Internal Employee Badge Studio data model mapping.

## Field → PSD Layer Mapping

| Field Name | PSD Layer | Path | Required | Example Value |
|------------|-----------|------|----------|---------------|
| `first_name` | `FIRST` | BADGE_CONTENT/EMPLOYEE_INFO/FIRST | ✅ | Mila |
| `last_name` | `LAST` | BADGE_CONTENT/EMPLOYEE_INFO/LAST | ✅ | De Vries |
| `doc_number` | `DOCNMBR` | BADGE_CONTENT/DOCUMENT_INFO/DOCNMBR | ✅ | AB12C34D5 |
| `personal_number` | `CODE` | BADGE_CONTENT/EMPLOYEE_INFO/CODE | ✅ | 123456789 |
| `expires` | `ENDVALID` | BADGE_CONTENT/VALIDITY/ENDVALID | ✅ | 06/14/2030 |
| `valid_from` | `VALID` | BADGE_CONTENT/VALIDITY/VALID | ✅ | 06/14/2020 |
| `birth_date` | `BIRTHDATE` | BADGE_CONTENT/PERSONAL_INFO/BIRTHDATE | ✅ | 06/14/1990 |
| `birth_year` | `YEAR` | BADGE_CONTENT/PERSONAL_INFO/YEAR | ✅ | 1990 |
| `gender` | `GENDER` | BADGE_CONTENT/PERSONAL_INFO/GENDER | ✅ | Female |
| `height` | `HEIGHT` | BADGE_CONTENT/PERSONAL_INFO/HEIGHT | ❌ | 1,72 m |
| `country_of_birth` | `COUNTRY` | BADGE_CONTENT/PERSONAL_INFO/COUNTRY | ❌ | Nederlandse |
| `city_of_birth` | `CITYBIRTH` | BADGE_CONTENT/PERSONAL_INFO/CITYBIRTH | ❌ | Zoetermeer |
| `company_location` | `LOCATION` | BADGE_CONTENT/COMPANY_INFO/LOCATION | ❌ | Burg. van Zoetermeer |

## Company Fields (No PSD Layers)

| Field Name | Required | Example Value | Usage |
|------------|----------|---------------|-------|
| `company_name` | ✅ | Acme Corporation | Metadata only |
| `issuer_code` | ✅ | NLD | Metadata only |
| `department` | ❌ | Engineering | Metadata only |

## Upload Fields (Smart Objects)

| Field Name | Smart Object Layer | Path | Required |
|------------|-------------------|------|----------|
| `employee_photo` | `MAIN_PHOTO` | BADGE_CONTENT/PHOTOS/MAIN_PHOTO | ✅ |
| `signature_image` | `SIGNATURE_AREA` | BADGE_CONTENT/PHOTOS/SIGNATURE_AREA | ❌ |

## Value Transformations

| Transformation | Input Format | Output Format | Function |
|----------------|--------------|---------------|----------|
| Date Formatting | `2020-06-14` (ISO) | `06/14/2020` (MM/DD/YYYY) | `formatDateMMDDYYYY()` |
| Birth Year Calculation | `birth_date: "1990-06-14"` | `birth_year: "1990"` | `calculateBirthYear()` |

## Data Structure at Each Layer

### Frontend (IdGeneratorStep.tsx)

```typescript
{
  company_name: "Acme Corporation",
  issuer_code: "NLD",
  department: "Engineering",
  first_name: "Mila",
  last_name: "De Vries",
  doc_number: "AB12C34D5",
  personal_number: "123456789",
  valid_from: "2020-06-14",  // ISO
  expires: "2030-06-14",      // ISO
  birth_date: "1990-06-14",   // ISO
  gender: "Female",
  height: "1,72 m",
  country_of_birth: "Nederlandse",
  city_of_birth: "Zoetermeer",
  company_location: "Burg. van Zoetermeer",
  export_format: "png"
}
```

### Supabase (badge_jobs.input_json)

```json
{
  "template": "EmployeeID.psd",
  "company_name": "Acme Corporation",
  "issuer_code": "NLD",
  "department": "Engineering",
  "first_name": "Mila",
  "last_name": "De Vries",
  "doc_number": "AB12C34D5",
  "personal_number": "123456789",
  "valid_from": "2020-06-14",
  "expires": "2030-06-14",
  "birth_date": "1990-06-14",
  "birth_year": "1990",
  "gender": "Female",
  "height": "1,72 m",
  "country_of_birth": "Nederlandse",
  "city_of_birth": "Zoetermeer",
  "company_location": "Burg. van Zoetermeer",
  "export_format": "png",
  "assets": { ... },
  "meta": { ... }
}
```

### Worker (input.json)

```json
{
  "job_id": "abc123",
  "template": "EmployeeID.psd",
  "company": {
    "company_name": "Acme Corporation",
    "issuer_code": "NLD",
    "department": "Engineering"
  },
  "employee": {
    "first_name": "Mila",
    "last_name": "De Vries",
    "doc_number": "AB12C34D5",
    "personal_number": "123456789",
    "expires": "06/14/2030",
    "valid_from": "06/14/2020",
    "birth_date": "06/14/1990",
    "birth_year": "1990",
    "gender": "Female",
    "height": "1,72 m",
    "country_of_birth": "Nederlandse",
    "city_of_birth": "Zoetermeer",
    "company_location": "Burg. van Zoetermeer"
  },
  "psdTextTargets": {
    "FIRST": "Mila",
    "LAST": "De Vries",
    "DOCNMBR": "AB12C34D5",
    "CODE": "123456789",
    "ENDVALID": "06/14/2030",
    "VALID": "06/14/2020",
    "BIRTHDATE": "06/14/1990",
    "YEAR": "1990",
    "GENDER": "Female",
    "HEIGHT": "1,72 m",
    "COUNTRY": "Nederlandse",
    "CITYBIRTH": "Zoetermeer",
    "LOCATION": "Burg. van Zoetermeer"
  },
  "images": {
    "photo_path": "...",
    "signature_path": "..."
  },
  "export_format": "png"
}
```

### Photoshop (run_employeeid_job.jsx)

```javascript
// Reads psdTextTargets and updates layers:
layer = findLayerByPath(doc, "BADGE_CONTENT/EMPLOYEE_INFO/FIRST");
layer.textItem.contents = "Mila";  // ONLY updates content

layer = findLayerByPath(doc, "BADGE_CONTENT/EMPLOYEE_INFO/LAST");
layer.textItem.contents = "De Vries";

// ... (13 layers total)
```

## Quick Checks

### Is the mapping correct?

Run: `node tests/mapping-verification.test.cjs`

Expected: ✅ All 10 tests pass

### Does the frontend collect all fields?

Navigate to: Custom Tools → ID Generator

Expected:
- ✅ Company Information section (3 fields)
- ✅ Employee Information section (4 fields)
- ✅ Validity Period section (2 fields)
- ✅ Personal Information section (6 fields)
- ✅ Uploads section (2 fields)
- ✅ Export Settings (1 field)

Total: 18 input fields (birth_year is auto-calculated)

### Does psdTextTargets have 13 layers?

```bash
node -e "console.log(Object.keys(require('./worker/job-adapter').convertJobToPhotoshopInput({input_json:{first_name:'Test',last_name:'User',doc_number:'ABC',personal_number:'123',valid_from:'2020-01-01',expires:'2030-01-01',birth_date:'1990-01-01',gender:'Male'}}, '', '').psdTextTargets).length)"
```

Expected: `13`

## Source Files

- **Single Source of Truth**: `src/lib/badgeMapping.ts`
- **Frontend Form**: `src/app/IdGeneratorStep.tsx`
- **Worker Adapter**: `worker/job-adapter.js`
- **Photoshop Script**: `worker/scripts/run_employeeid_job.jsx`
- **PSD Structure**: `reference/EMPLOYEEID_BACKBONE.md`
- **Layer Map**: `worker/EMPLOYEEID_LAYER_MAP.json`

## Last Updated

2024-05-24 - Aligned with Internal Employee Badge Studio
