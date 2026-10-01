# Photoshop Automation Code Generation Request

## Project Context

I need you to create a complete Photoshop JSX (ExtendScript) automation script for an Internal Employee Badge Generator system. This system generates internal company ID badges by automatically editing a Photoshop template (EmployeeID.psd) with employee data.

**CRITICAL SAFETY BOUNDARY**: This is for INTERNAL COMPANY BADGES ONLY. Not for official government IDs, passports, or any documents with legal validity.

## Project Overview

The system works as follows:
1. Web frontend collects employee data (Internal Employee Badge Studio fields)
2. Data is stored in Supabase database
3. Windows worker polls for new badge generation jobs
4. Worker downloads the job data and employee photos
5. **Photoshop JSX script automatically edits EmployeeID.psd template** ← THIS IS WHAT I NEED
6. Script exports the final badge as PNG/PDF/PSD
7. Worker uploads results back to cloud storage

## Current Project Files to Reference

Please access and analyze these files from my project:

### 1. Data Model & Mapping (CRITICAL - Read These First)

- **`/src/lib/badgeMapping.ts`** - Single source of truth for all field definitions, PSD layer mappings, and validation rules
- **`/reference/EMPLOYEEID_BACKBONE.md`** - Complete PSD layer structure specification
- **`/worker/EMPLOYEEID_LAYER_MAP.json`** - Machine-readable layer definitions
- **`/worker/job-adapter.js`** - Shows the exact input.json structure the script will receive
- **`/FIELD_MAPPING_REFERENCE.md`** - Quick reference for field → PSD layer mapping

### 2. Existing Implementation (Use as Reference)

- **`/worker/scripts/run_employeeid_job.jsx`** - Current Photoshop script (needs updating based on actual PSD file)
- **`/worker/scripts/inspect_employeeid_layers.jsx`** - Layer inspection utility
- **`/worker/scripts/font_preflight.jsx`** - Font validation script
- **`/DATA_MODEL_ALIGNMENT_SUMMARY.md`** - Complete system documentation

### 3. My PSD Template Files

I will provide you with:
- **`EmployeeID.psd`** - The actual Photoshop template file
- Screenshots of the PSD layer structure
- Font list from the template

## Required Data Model

The script must process this EXACT data structure from `input.json`:

### Input Structure

```json
{
  "job_id": "unique-job-id",
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
    "photo_path": "C:/EmployeeBadgeAutomation/current-job/photo.jpg",
    "signature_path": "C:/EmployeeBadgeAutomation/current-job/signature.png"
  },
  
  "export_format": "png"
}
```

## Required PSD Layer Structure

The EmployeeID.psd template should have these layers (verify against actual file):

### Text Layers (13 total)

| PSD Layer Name | Path | Field Source |
|----------------|------|--------------|
| FIRST | BADGE_CONTENT/EMPLOYEE_INFO/FIRST | employee.first_name |
| LAST | BADGE_CONTENT/EMPLOYEE_INFO/LAST | employee.last_name |
| DOCNMBR | BADGE_CONTENT/DOCUMENT_INFO/DOCNMBR | employee.doc_number |
| CODE | BADGE_CONTENT/EMPLOYEE_INFO/CODE | employee.personal_number |
| ENDVALID | BADGE_CONTENT/VALIDITY/ENDVALID | employee.expires |
| VALID | BADGE_CONTENT/VALIDITY/VALID | employee.valid_from |
| BIRTHDATE | BADGE_CONTENT/PERSONAL_INFO/BIRTHDATE | employee.birth_date |
| YEAR | BADGE_CONTENT/PERSONAL_INFO/YEAR | employee.birth_year |
| GENDER | BADGE_CONTENT/PERSONAL_INFO/GENDER | employee.gender |
| HEIGHT | BADGE_CONTENT/PERSONAL_INFO/HEIGHT | employee.height |
| COUNTRY | BADGE_CONTENT/PERSONAL_INFO/COUNTRY | employee.country_of_birth |
| CITYBIRTH | BADGE_CONTENT/PERSONAL_INFO/CITYBIRTH | employee.city_of_birth |
| LOCATION | BADGE_CONTENT/COMPANY_INFO/LOCATION | employee.company_location |

### Smart Object Layers (2 total)

| Smart Object | Path | Purpose |
|--------------|------|---------|
| MAIN_PHOTO | BADGE_CONTENT/PHOTOS/MAIN_PHOTO | Employee photo |
| SIGNATURE_AREA | BADGE_CONTENT/PHOTOS/SIGNATURE_AREA | Employee signature |

## Script Requirements

### CRITICAL: What the Script MUST DO

1. **Read input.json**
   - Load from: `C:/EmployeeBadgeAutomation/current-job/input.json`
   - Parse JSON structure

2. **Open EmployeeID.psd template**
   - Path: `C:/EmployeeBadgeAutomation/templates/EmployeeID.psd`
   - NEVER save over the original template
   - Work on the opened document in memory

3. **Update Text Layers**
   - Iterate through `psdTextTargets` object
   - For each PSD layer name, find the layer by the path shown in the table above
   - Update ONLY `textItem.contents` with the corresponding value
   - **PRESERVE**: font family, font size, font color, position, tracking, leading, alignment, effects, blend modes, opacity
   - Skip empty optional values gracefully

4. **Update Smart Objects**
   - **Employee Photo** (MAIN_PHOTO):
     - Find layer at path: BADGE_CONTENT/PHOTOS/MAIN_PHOTO
     - Open Smart Object using `placedLayerEditContents` action
     - Clear internal contents
     - Place image from `images.photo_path`
     - Save and close Smart Object
     - Preserve mask, position, effects
   
   - **Signature** (SIGNATURE_AREA) - Optional:
     - Only if `images.signature_path` is provided
     - Same process as photo
     - Skip if path is empty

5. **Export Results**
   - Based on `export_format` field
   - Output folder: `C:/EmployeeBadgeAutomation/output/{job_id}/`
   - Formats:
     - `png`: Export as PNG-24, 300 DPI, no transparency → `result.png`
     - `pdf`: Export as Photoshop PDF, High Quality Print preset → `result.pdf`
     - `psd`: Save as PSD with layers, maximize compatibility → `result.psd`

6. **Close Without Saving**
   - Use `SaveOptions.DONOTSAVECHANGES`
   - NEVER modify the original template file

7. **Error Handling**
   - Wrap in try/catch
   - Log errors to `C:/EmployeeBadgeAutomation/logs/`
   - Save error report JSON if processing fails
   - Save success report JSON when complete

### CRITICAL: What the Script MUST NOT DO

❌ **FORBIDDEN OPERATIONS:**
- Change font family, font size, or font color
- Move, resize, or transform layers
- Rasterize text or Smart Objects
- Modify layer effects, blend modes, or opacity
- Edit company branding or decorative elements
- Add, delete, or rename layers
- Save over the original EmployeeID.psd template
- Flatten the document

✅ **ALLOWED OPERATIONS:**
- Update `textItem.contents` ONLY
- Replace Smart Object contents with uploaded images
- Save and close Smart Objects
- Export to PNG/PDF/PSD in output folder

## Expected Script Structure

```javascript
#target photoshop

// Configuration
var BASE_PATH = "C:/EmployeeBadgeAutomation";
var TEMPLATE_PATH = BASE_PATH + "/templates/EmployeeID.psd";
var INPUT_JSON_PATH = BASE_PATH + "/current-job/input.json";
var OUTPUT_BASE = BASE_PATH + "/output";

// Layer path mapping (verify against actual PSD)
var LAYER_PATHS = {
  FIRST: "BADGE_CONTENT/EMPLOYEE_INFO/FIRST",
  LAST: "BADGE_CONTENT/EMPLOYEE_INFO/LAST",
  // ... etc (13 total)
};

function main() {
  try {
    // 1. Load input.json
    // 2. Open template
    // 3. Update text layers using psdTextTargets
    // 4. Update Smart Objects (photo, signature)
    // 5. Export based on format
    // 6. Close without saving
    // 7. Save success report
  } catch (error) {
    // Save error report
  }
}

// Helper functions
function loadInput() { /* ... */ }
function findLayerByPath(doc, path) { /* ... */ }
function updateTextLayersFromTargets(doc, psdTextTargets) { /* ... */ }
function updateSmartObjectByPath(doc, layerPath, imagePath) { /* ... */ }
function exportPNG(doc, path) { /* ... */ }
function exportPDF(doc, path) { /* ... */ }
function exportPSD(doc, path) { /* ... */ }

main();
```

## What I Need You To Do

### Step 1: Analyze My PSD File

I will provide you with:
- The actual `EmployeeID.psd` file
- Or screenshots of the layer panel showing all layer names and structure
- Or the output from running `inspect_employeeid_layers.jsx`

Please:
1. Examine the actual layer structure
2. Verify which layers exist
3. Confirm the exact layer paths
4. Identify any discrepancies from the expected structure

### Step 2: Inspect Smart Objects

For each Smart Object (MAIN_PHOTO, SIGNATURE_AREA):
1. Check if they exist
2. Verify they are embedded Smart Objects (not linked)
3. Identify the internal layer structure when opened
4. Determine which internal layer should be replaced with the uploaded image

### Step 3: Check Fonts

1. List all fonts used in the template
2. Verify they match the expected fonts (Helvetica, Helvetica-Bold)
3. Note any font substitutions needed

### Step 4: Generate Complete JSX Script

Create a production-ready Photoshop JSX script that:

1. **Matches the ACTUAL layer structure** from my PSD file (not the documented structure if different)
2. **Updates all 13 text layers** correctly
3. **Handles Smart Objects** properly
4. **Preserves all formatting** (font, size, color, position, effects)
5. **Exports** in PNG/PDF/PSD format
6. **Handles errors** gracefully
7. **Logs** all operations
8. **Never modifies** the original template

### Step 5: Create Supporting Scripts

Generate these additional scripts:

1. **`verify_template.jsx`** - Validates the PSD structure matches requirements
2. **`test_job.jsx`** - Dry-run test with sample data
3. **`debug_layers.jsx`** - Outputs complete layer hierarchy to JSON

### Step 6: Provide Setup Instructions

Create specific instructions for:
1. Installing required fonts
2. Setting up the folder structure
3. Testing the scripts
4. Troubleshooting common issues

## Expected Deliverables

Please provide:

1. ✅ **`run_employeeid_job.jsx`** - Main production script (complete, tested logic)
2. ✅ **`verify_template.jsx`** - Template validation script
3. ✅ **`test_job.jsx`** - Dry-run test script with sample data
4. ✅ **`debug_layers.jsx`** - Layer hierarchy inspector
5. ✅ **`PHOTOSHOP_SETUP.md`** - Complete setup and testing guide
6. ✅ **`LAYER_PATH_CORRECTIONS.md`** - Any discrepancies found between expected and actual layer structure

## Example Test Scenario

The script should be able to process this test job:

**input.json:**
```json
{
  "job_id": "test-001",
  "template": "EmployeeID.psd",
  "company": {
    "company_name": "Test Corp",
    "issuer_code": "USA",
    "department": "IT"
  },
  "employee": {
    "first_name": "John",
    "last_name": "Smith",
    "doc_number": "TEST123",
    "personal_number": "999888777",
    "expires": "12/31/2025",
    "valid_from": "01/01/2024",
    "birth_date": "03/15/1985",
    "birth_year": "1985",
    "gender": "Male",
    "height": "1,80 m",
    "country_of_birth": "United States",
    "city_of_birth": "New York",
    "company_location": "San Francisco"
  },
  "psdTextTargets": {
    "FIRST": "John",
    "LAST": "Smith",
    "DOCNMBR": "TEST123",
    "CODE": "999888777",
    "ENDVALID": "12/31/2025",
    "VALID": "01/01/2024",
    "BIRTHDATE": "03/15/1985",
    "YEAR": "1985",
    "GENDER": "Male",
    "HEIGHT": "1,80 m",
    "COUNTRY": "United States",
    "CITYBIRTH": "New York",
    "LOCATION": "San Francisco"
  },
  "images": {
    "photo_path": "C:/EmployeeBadgeAutomation/current-job/test_photo.jpg",
    "signature_path": "C:/EmployeeBadgeAutomation/current-job/test_signature.png"
  },
  "export_format": "png"
}
```

**Expected output:**
- `C:/EmployeeBadgeAutomation/output/test-001/result.png` - Badge with all fields filled
- All text shows exactly as in psdTextTargets
- Photo and signature placed correctly
- All original formatting preserved

## Questions to Answer

While generating the script, please address:

1. **Layer Path Verification**: Do the actual layer paths in my PSD match the expected structure?
2. **Smart Object Structure**: What is the internal layer structure of MAIN_PHOTO and SIGNATURE_AREA when opened?
3. **Font Compatibility**: Are all required fonts available? Any substitutions needed?
4. **Missing Layers**: Are all 13 expected text layers present?
5. **Layer Type Verification**: Are all expected text layers actually text layers (not rasterized)?
6. **Smart Object Type**: Are MAIN_PHOTO and SIGNATURE_AREA embedded Smart Objects (not linked)?
7. **Export Settings**: What are the optimal export settings for each format?

## Reference Files Location

All documentation is in this project:
- `/src/lib/badgeMapping.ts` - Field definitions
- `/reference/EMPLOYEEID_BACKBONE.md` - PSD structure spec
- `/worker/EMPLOYEEID_LAYER_MAP.json` - Layer map
- `/FIELD_MAPPING_REFERENCE.md` - Quick reference
- `/DATA_MODEL_ALIGNMENT_SUMMARY.md` - Complete docs

## Safety Reminder

⚠️ **CRITICAL**: This script is for internal company badge generation ONLY.

DO NOT include features for:
- Official government ID documents
- Security features (MRZ, holograms, etc.)
- Official document numbering systems
- Biometric indicators
- Features that could be mistaken for official credentials

The script should ONLY edit the specified text fields and place images. No additional automation beyond what's documented.

---

## How to Use This Prompt

1. Attach your `EmployeeID.psd` file to the conversation
2. Or provide screenshots of your PSD layer panel
3. Or provide the output from running the `inspect_employeeid_layers.jsx` script
4. Paste this entire prompt
5. Ask: "Please analyze my PSD file and generate all the required Photoshop automation scripts based on the specifications above"

The AI will analyze your actual PSD structure and generate production-ready JSX scripts that match your exact layer configuration.
