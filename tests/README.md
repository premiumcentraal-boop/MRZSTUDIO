# ID Generator Tests

## Mapping Verification Test

Validates that the Internal Employee Badge Studio data model is consistent across frontend, worker, and Photoshop layers.

### Run the Test

```bash
node tests/mapping-verification.test.cjs
```

### What It Tests

1. ✅ BadgeJobPayload contains all required Internal Employee Badge Studio fields
2. ✅ Worker input.json preserves all fields from BadgeJobPayload  
3. ✅ psdTextTargets contains the exact PSD layer names (13 layers)
4. ✅ Example values map correctly to expected PSD layers
5. ✅ No duplicate or conflicting mappings exist
6. ✅ Dates format correctly (ISO YYYY-MM-DD → MM/DD/YYYY)
7. ✅ Birth year auto-calculates from birth_date
8. ✅ Company section (company_name, issuer_code, department)
9. ✅ Employee section (13 fields total)
10. ✅ Photoshop input structure validation

### Expected Output

```
===========================================
Mapping Verification Test
===========================================

Test 1: Converting badge job to Photoshop input...
Test 2: Validating Photoshop input structure...
✅ PASS: Photoshop input is valid

Test 3: Checking all required fields are present...
✅ PASS: All required top-level fields present

Test 4: Checking psdTextTargets contains expected PSD layer names...
✅ PASS: All expected PSD layers present

Test 5: Verifying example values map correctly...
✅ PASS: All values map correctly

Test 6: Checking company section...
✅ PASS: Company section correct

Test 7: Checking employee section...
✅ PASS: Employee section correct

Test 8: Checking for duplicate mappings...
✅ PASS: No duplicate mappings

Test 9: Checking date formatting (ISO → MM/DD/YYYY)...
✅ PASS: Dates formatted correctly

Test 10: Checking birth year calculation...
✅ PASS: Birth year calculated correctly

===========================================
✅ All mapping verification tests passed!
===========================================

Summary:
- Frontend BadgeJobPayload: ✅ Contains all required fields
- Worker input.json: ✅ Preserves all fields
- psdTextTargets: ✅ Contains exact PSD layer names
- Value mapping: ✅ Example values map correctly
- No duplicates: ✅ No conflicting mappings
- Date formatting: ✅ ISO dates converted to MM/DD/YYYY
- Birth year: ✅ Auto-calculated from birth_date

✅ Data model is consistent across all layers!
```

### What It Validates

#### PSD Layer Names

The test confirms these 13 PSD layers are correctly mapped:

- `FIRST` ← first_name
- `LAST` ← last_name
- `DOCNMBR` ← doc_number
- `CODE` ← personal_number
- `ENDVALID` ← expires
- `VALID` ← valid_from
- `BIRTHDATE` ← birth_date
- `YEAR` ← birth_year (calculated)
- `GENDER` ← gender
- `HEIGHT` ← height
- `COUNTRY` ← country_of_birth
- `CITYBIRTH` ← city_of_birth
- `LOCATION` ← company_location

#### Example Values

Confirms these example values map correctly:

```javascript
{
  FIRST: "Mila",
  LAST: "De Vries",
  DOCNMBR: "AB12C34D5",
  CODE: "123456789",
  ENDVALID: "06/14/2030",
  VALID: "06/14/2020",
  BIRTHDATE: "06/14/1990",
  YEAR: "1990",
  GENDER: "Female",
  HEIGHT: "1,72 m",
  COUNTRY: "Nederlandse",
  CITYBIRTH: "Zoetermeer",
  LOCATION: "Burg. van Zoetermeer"
}
```

### When to Run

Run this test:
- ✅ After updating badgeMapping.ts
- ✅ After modifying job-adapter.js
- ✅ After changing BadgeJobPayload structure
- ✅ After updating EMPLOYEEID_LAYER_MAP.json
- ✅ Before deploying to production
- ✅ As part of CI/CD pipeline

### Troubleshooting

**Test fails with "Missing PSD layers"**
- Check `worker/EMPLOYEEID_LAYER_MAP.json`
- Verify `worker/job-adapter.js` psdTextTargets mapping
- Review `reference/EMPLOYEEID_BACKBONE.md` layer structure

**Test fails with "Value mapping error"**
- Check `worker/job-adapter.js` conversion logic
- Verify date formatting functions
- Confirm birth_year calculation

**Test fails with "Invalid Photoshop input"**
- Check required fields in `job-adapter.js` validatePhotoshopInput()
- Verify all required employee fields are present
- Confirm company section has all required fields

### Related Documentation

- **Single Source of Truth**: `src/lib/badgeMapping.ts`
- **Worker Adapter**: `worker/job-adapter.js`
- **PSD Structure**: `reference/EMPLOYEEID_BACKBONE.md`
- **Data Model Summary**: `DATA_MODEL_ALIGNMENT_SUMMARY.md`
- **Implementation Checklist**: `IMPLEMENTATION_CHECKLIST.md`
