# Data Model Alignment Summary
## Internal Employee Badge Studio Integration

## Overview

The ID Generator has been fully aligned with the **Internal Employee Badge Studio** data model. The frontend, worker, and Photoshop layers now share the exact same field structure, field names, value mappings, and PSD layer targets.

## Key Changes

### 1. Single Source of Truth Created

**File: `src/lib/badgeMapping.ts`**

This file is now the canonical reference for:
- All field definitions (company, employee, personal info)
- Example values for each field
- Validation rules
- PSD layer target names
- Value calculation functions (birth_year from birth_date, date formatting)
- Payload-to-Photoshop conversion logic

### 2. BadgeJobPayload Updated

**Old Structure** (Generic):
```typescript
{
  employee_name: string;
  employee_id: string;
  department?: string;
  role?: string;
  valid_from?: string;
  valid_until?: string;
}
```

**New Structure** (Internal Employee Badge Studio):
```typescript
{
  // Company
  company_name: string;
  issuer_code: string;
  department?: string;

  // Employee
  first_name: string;
  last_name: string;
  doc_number: string;
  personal_number: string;

  // Validity
  valid_from: string;
  expires: string;

  // Personal Info
  birth_date: string;
  birth_year: string; // auto-calculated
  gender: string;
  height?: string;
  country_of_birth?: string;
  city_of_birth?: string;
  company_location?: string;
}
```

### 3. Frontend Form Updated

**File: `src/app/IdGeneratorStep.tsx`**

The form now collects all Internal Employee Badge Studio fields organized into logical sections:
1. **Company Information**: company_name, issuer_code, department
2. **Employee Information**: first_name, last_name, doc_number, personal_number
3. **Validity Period**: valid_from, expires
4. **Personal Information**: birth_date, gender, height, country_of_birth, city_of_birth, company_location
5. **Uploads**: employee_photo, signature_image
6. **Export Settings**: export_format

### 4. Worker Adapter Created

**File: `worker/job-adapter.js`**

This new module:
- Takes Supabase `badge_jobs` rows
- Transforms them into Photoshop `input.json` using canonical mapping
- Calculates derived values (birth_year)
- Formats dates (ISO → MM/DD/YYYY)
- Generates `psdTextTargets` object with exact PSD layer names
- Validates output structure before processing

### 5. Photoshop Script Updated

**File: `worker/scripts/run_employeeid_job.jsx`**

The script now:
- Reads `psdTextTargets` from input.json
- Maps each target to exact PSD layer paths
- Updates text content ONLY (preserves font, size, color, position, effects)
- Fails safely if required fonts or layers are missing

### 6. PSD Layer Structure Updated

**File: `reference/EMPLOYEEID_BACKBONE.md`**

Documents the exact layer structure:

| Field | PSD Layer Name | Path |
|-------|----------------|------|
| first_name | FIRST | BADGE_CONTENT/EMPLOYEE_INFO/FIRST |
| last_name | LAST | BADGE_CONTENT/EMPLOYEE_INFO/LAST |
| doc_number | DOCNMBR | BADGE_CONTENT/DOCUMENT_INFO/DOCNMBR |
| personal_number | CODE | BADGE_CONTENT/EMPLOYEE_INFO/CODE |
| expires | ENDVALID | BADGE_CONTENT/VALIDITY/ENDVALID |
| valid_from | VALID | BADGE_CONTENT/VALIDITY/VALID |
| birth_date | BIRTHDATE | BADGE_CONTENT/PERSONAL_INFO/BIRTHDATE |
| birth_year | YEAR | BADGE_CONTENT/PERSONAL_INFO/YEAR |
| gender | GENDER | BADGE_CONTENT/PERSONAL_INFO/GENDER |
| height | HEIGHT | BADGE_CONTENT/PERSONAL_INFO/HEIGHT |
| country_of_birth | COUNTRY | BADGE_CONTENT/PERSONAL_INFO/COUNTRY |
| city_of_birth | CITYBIRTH | BADGE_CONTENT/PERSONAL_INFO/CITYBIRTH |
| company_location | LOCATION | BADGE_CONTENT/COMPANY_INFO/LOCATION |

## Data Flow

```
User fills Internal Employee Badge Studio form
  ↓
Frontend validates using badgeMapping.validateEmployeeFields()
  ↓
Creates BadgeJobPayload with all Internal Employee Badge Studio fields
  ↓
Stores in Supabase badge_jobs.input_json
  ↓
Worker polls and receives job
  ↓
job-adapter.js converts to Photoshop input.json
  ├── Calculates birth_year from birth_date
  ├── Formats dates: ISO (YYYY-MM-DD) → MM/DD/YYYY
  └── Generates psdTextTargets mapping
  ↓
Photoshop worker.js prepares input.json file
  ↓
run_employeeid_job.jsx reads input.json
  ├── Opens EmployeeID.psd template
  ├── Updates text layers using psdTextTargets
  ├── Updates Smart Objects (photo, signature)
  └── Exports PNG/PDF/PSD
  ↓
Worker uploads results to badge-outputs bucket
  ↓
Frontend displays download links
```

## Example Data Mapping

**Frontend Form Input:**
```javascript
{
  company_name: "Acme Corporation",
  issuer_code: "NLD",
  department: "Engineering",
  first_name: "Mila",
  last_name: "De Vries",
  doc_number: "AB12C34D5",
  personal_number: "123456789",
  valid_from: "2020-06-14",  // ISO format
  expires: "2030-06-14",      // ISO format
  birth_date: "1990-06-14",   // ISO format
  gender: "Female",
  height: "1,72 m",
  country_of_birth: "Nederlandse",
  city_of_birth: "Zoetermeer",
  company_location: "Burg. van Zoetermeer"
}
```

**Photoshop input.json Generated:**
```javascript
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
    "expires": "06/14/2030",     // Formatted
    "valid_from": "06/14/2020",  // Formatted
    "birth_date": "06/14/1990",  // Formatted
    "birth_year": "1990",        // Calculated
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
    "photo_path": "C:/EmployeeBadgeAutomation/current-job/photo.jpg",
    "signature_path": "C:/EmployeeBadgeAutomation/current-job/signature.png"
  },
  "export_format": "png"
}
```

## Mapping Verification

**File: `tests/mapping-verification.test.cjs`**

A comprehensive test suite verifies:

1. ✅ BadgeJobPayload contains all required Internal Employee Badge Studio fields
2. ✅ Worker input.json preserves all fields from BadgeJobPayload
3. ✅ psdTextTargets contains the exact PSD layer names
4. ✅ Example values map correctly to expected PSD layers
5. ✅ No duplicate or conflicting mappings exist
6. ✅ Dates are formatted correctly (ISO → MM/DD/YYYY)
7. ✅ Birth year is auto-calculated from birth_date
8. ✅ Company section maps correctly
9. ✅ Employee section maps correctly
10. ✅ All validation passes

**Run the test:**
```bash
node tests/mapping-verification.test.cjs
```

## Critical Design Principles

### 1. No Separate Input Models

There is **one and only one** data model: Internal Employee Badge Studio.

- ❌ **Don't** create separate Photoshop-only forms
- ❌ **Don't** create worker-only field structures
- ✅ **Do** use badgeMapping.ts as single source of truth
- ✅ **Do** transform using job-adapter.js

### 2. Worker Does Not Invent Values

The worker consumes the existing BadgeJobPayload and converts it using `job-adapter.js`.

- ❌ **Don't** add default values in the worker
- ❌ **Don't** create fields not in BadgeJobPayload
- ✅ **Do** use values exactly as provided by frontend
- ✅ **Do** calculate derived values using badgeMapping functions

### 3. PSD Design Preservation

Photoshop scripts update **text content only**.

- ❌ **Don't** change font family, size, or color
- ❌ **Don't** move, resize, or transform layers
- ❌ **Don't** modify tracking, leading, alignment
- ✅ **Do** update `textItem.contents` only
- ✅ **Do** preserve all formatting and effects

### 4. Calculation Consistency

Derived values use shared calculation functions.

- **Birth Year**: `calculateBirthYear(birth_date)` in badgeMapping.ts
- **Date Formatting**: `formatDateMMDDYYYY(isoDate)` converts ISO → MM/DD/YYYY
- Both frontend and worker use the same functions

## Updated Documentation

### Modified Files

1. **src/lib/badgeMapping.ts** - New file, single source of truth
2. **src/lib/supabase.ts** - BadgeJobPayload updated
3. **src/app/IdGeneratorStep.tsx** - Form updated with all fields
4. **worker/job-adapter.js** - New file, payload converter
5. **worker/worker.js** - Updated to use job-adapter
6. **worker/scripts/run_employeeid_job.jsx** - Updated to use psdTextTargets
7. **worker/EMPLOYEEID_LAYER_MAP.json** - Updated with Internal Employee Badge Studio structure
8. **reference/EMPLOYEEID_BACKBONE.md** - Updated PSD layer documentation
9. **IMPLEMENTATION_CHECKLIST.md** - Updated progress tracking
10. **tests/mapping-verification.test.cjs** - New file, mapping validation

### New Files Created

- `src/lib/badgeMapping.ts` - Field definitions, mappings, validation
- `worker/job-adapter.js` - BadgeJobPayload → Photoshop input converter
- `tests/mapping-verification.test.cjs` - Mapping consistency tests
- `DATA_MODEL_ALIGNMENT_SUMMARY.md` - This document

## Expected Behavior

When a user fills out the ID Generator form:

1. ✅ They see all Internal Employee Badge Studio fields
2. ✅ Validation uses `badgeMapping.validateEmployeeFields()`
3. ✅ Birth year is auto-calculated from birth date
4. ✅ Form creates BadgeJobPayload with all fields
5. ✅ Supabase stores the complete payload in `input_json`
6. ✅ Worker receives job and uses `job-adapter.js`
7. ✅ Photoshop receives `input.json` with `psdTextTargets`
8. ✅ JSX script updates PSD layers using exact layer names
9. ✅ Only text content is changed, all formatting preserved
10. ✅ Result matches Internal Employee Badge Studio exactly

## Testing Checklist

### 1. Frontend Testing (No Backend Required)

- [ ] Navigate to Custom Tools → ID Generator
- [ ] Verify all Internal Employee Badge Studio fields are present
- [ ] Fill out form with example data
- [ ] Verify birth year auto-calculates
- [ ] Verify validation errors show correctly
- [ ] Test with `VITE_MOCK_ID_GENERATOR=true`
- [ ] Verify mock job completes successfully

### 2. Mapping Verification (No Backend Required)

- [ ] Run `node tests/mapping-verification.test.cjs`
- [ ] Verify all 10 tests pass
- [ ] Confirm psdTextTargets contains 13 layer names
- [ ] Confirm dates format correctly
- [ ] Confirm birth year calculates correctly

### 3. Worker Testing (Requires Supabase + Windows)

- [ ] Set up Supabase with updated schema
- [ ] Create `.env` with real credentials
- [ ] Start worker with `node worker.js`
- [ ] Create job from frontend
- [ ] Verify worker claims job
- [ ] Verify `current-job/input.json` has correct structure
- [ ] Verify Photoshop processes job
- [ ] Verify output matches expected values

### 4. End-to-End Testing (Full Stack)

- [ ] Create badge with all fields filled
- [ ] Verify PNG output shows all text correctly
- [ ] Verify no font, size, or position changes
- [ ] Verify dates show in MM/DD/YYYY format
- [ ] Verify birth year shows correctly
- [ ] Verify photo and signature placed correctly
- [ ] Download result and inspect quality

## Migration Notes

### For Existing Installations

If you have an existing ID Generator setup:

1. **Update Supabase Schema**: Add new columns to `badge_jobs` table
2. **Update Frontend**: Pull latest `IdGeneratorStep.tsx` changes
3. **Update Worker**: Replace `worker.js` and add `job-adapter.js`
4. **Update Scripts**: Replace `run_employeeid_job.jsx`
5. **Update Template**: Recreate `EmployeeID.psd` with new layer structure
6. **Run Tests**: Execute mapping verification test

### Breaking Changes

- ⚠️ **BadgeJobPayload structure changed** - Old jobs will fail
- ⚠️ **PSD layer names changed** - Old templates incompatible
- ⚠️ **Worker input.json structure changed** - Worker must be updated

### Migration Path

1. Complete all pending jobs with old system
2. Update all components simultaneously
3. Test with mapping verification test
4. Create new template matching new structure
5. Process test job end-to-end
6. Go live with new system

## Support

For issues or questions about the data model alignment:

1. Check `src/lib/badgeMapping.ts` for field definitions
2. Run `tests/mapping-verification.test.cjs` to verify consistency
3. Review `reference/EMPLOYEEID_BACKBONE.md` for PSD structure
4. Check `worker/job-adapter.js` for transformation logic
5. Review this document for data flow and examples

## Conclusion

The ID Generator is now fully aligned with the Internal Employee Badge Studio data model. All layers share the same field names, value mappings, and PSD layer targets. The mapping verification test ensures consistency is maintained across updates.

**Key Takeaway**: badgeMapping.ts is the single source of truth. The worker is just a rendering engine that transforms the canonical data into Photoshop format.
