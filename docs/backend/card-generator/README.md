# Card Generator - PSD Template Directory

## Purpose

This directory contains the Photoshop template files for the Internal Employee Badge Generator system.

## Required Files

Place your Photoshop template file here:

```
Card_Generator/
├── EmployeeID.psd          ← Your main badge template
├── TEMPLATE_SPECS.md       ← Template specifications (create this)
└── README.md               ← This file
```

## EmployeeID.psd Requirements

Your template must have the following structure:

### Required Text Layers (13 total)

| Layer Name | Path | Purpose |
|------------|------|---------|
| FIRST | BADGE_CONTENT/EMPLOYEE_INFO/FIRST | First name |
| LAST | BADGE_CONTENT/EMPLOYEE_INFO/LAST | Last name |
| DOCNMBR | BADGE_CONTENT/DOCUMENT_INFO/DOCNMBR | Document number |
| CODE | BADGE_CONTENT/EMPLOYEE_INFO/CODE | Personal number |
| ENDVALID | BADGE_CONTENT/VALIDITY/ENDVALID | Expiration date |
| VALID | BADGE_CONTENT/VALIDITY/VALID | Valid from date |
| BIRTHDATE | BADGE_CONTENT/PERSONAL_INFO/BIRTHDATE | Birth date |
| YEAR | BADGE_CONTENT/PERSONAL_INFO/YEAR | Birth year |
| GENDER | BADGE_CONTENT/PERSONAL_INFO/GENDER | Gender |
| HEIGHT | BADGE_CONTENT/PERSONAL_INFO/HEIGHT | Height |
| COUNTRY | BADGE_CONTENT/PERSONAL_INFO/COUNTRY | Country of birth |
| CITYBIRTH | BADGE_CONTENT/PERSONAL_INFO/CITYBIRTH | City of birth |
| LOCATION | BADGE_CONTENT/COMPANY_INFO/LOCATION | Company location |

### Required Smart Objects (2 total)

| Layer Name | Path | Purpose |
|------------|------|---------|
| MAIN_PHOTO | BADGE_CONTENT/PHOTOS/MAIN_PHOTO | Employee photo |
| SIGNATURE_AREA | BADGE_CONTENT/PHOTOS/SIGNATURE_AREA | Employee signature |

## Template Specifications

### Document Properties
- **Dimensions**: 1050 × 660 px (standard badge aspect ratio)
- **Resolution**: 300 DPI
- **Color Mode**: RGB
- **File Format**: PSD with layers

### Font Requirements
- Helvetica Regular (for body text, codes, dates)
- Helvetica Bold (for employee name)
- All fonts must be installed on the Windows worker machine

### Smart Object Requirements
- MAIN_PHOTO: Embedded Smart Object containing PHOTO_LAYER
- SIGNATURE_AREA: Embedded Smart Object containing SIGNATURE_LAYER
- Both should preserve masks and effects

## How to Use This Template

### Step 1: Create Your Template

Design your badge in Photoshop following the layer structure above.

**Critical Design Rules:**
- ✅ Use exact layer names (FIRST, LAST, DOCNMBR, etc.)
- ✅ Organize layers in groups as specified
- ✅ Use embedded Smart Objects for photo areas
- ✅ Use only Helvetica fonts (or specify alternatives)
- ❌ Don't add official document features (MRZ, security elements)
- ❌ Don't use linked Smart Objects
- ❌ Don't rasterize text layers

### Step 2: Validate Your Template

Run the inspector script:
1. Open your template in Photoshop
2. Run: File → Scripts → Browse
3. Select: `/worker/scripts/inspect_employeeid_layers.jsx`
4. Check: `C:/EmployeeBadgeAutomation/logs/employeeid_layer_report.json`
5. Verify: `all_required_present: true`

### Step 3: Generate Automation Scripts

Use the Codex prompt to generate exact editing scripts:
1. Read: `/workspaces/default/code/HOW_TO_USE_CODEX_PROMPT.md`
2. Attach your EmployeeID.psd file
3. Paste: `/workspaces/default/code/CODEX_PROMPT.md`
4. Get production-ready JSX scripts

### Step 4: Test the Template

1. Run the test script:
   ```
   "C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" 
   "C:\EmployeeBadgeAutomation\scripts\test_job.jsx"
   ```

2. Check output:
   ```
   C:\EmployeeBadgeAutomation\output\test-job\result.png
   ```

3. Verify all fields filled correctly

## Example Template Structure

```
EmployeeID.psd
├── BACKGROUND
│   └── Background Fill
├── BADGE_CONTENT
│   ├── COMPANY_BRANDING
│   │   └── Logo
│   ├── COMPANY_INFO
│   │   └── LOCATION
│   ├── EMPLOYEE_INFO
│   │   ├── FIRST
│   │   ├── LAST
│   │   └── CODE
│   ├── DOCUMENT_INFO
│   │   └── DOCNMBR
│   ├── VALIDITY
│   │   ├── VALID
│   │   └── ENDVALID
│   ├── PERSONAL_INFO
│   │   ├── BIRTHDATE
│   │   ├── YEAR
│   │   ├── GENDER
│   │   ├── HEIGHT
│   │   ├── COUNTRY
│   │   └── CITYBIRTH
│   └── PHOTOS
│       ├── MAIN_PHOTO (Smart Object)
│       └── SIGNATURE_AREA (Smart Object)
└── OVERLAY
```

## Reference Documentation

- **Layer Structure**: `/reference/EMPLOYEEID_BACKBONE.md`
- **Field Mapping**: `/FIELD_MAPPING_REFERENCE.md`
- **Data Model**: `/DATA_MODEL_ALIGNMENT_SUMMARY.md`
- **Generation Prompt**: `/CODEX_PROMPT.md`
- **Usage Instructions**: `/HOW_TO_USE_CODEX_PROMPT.md`

## Deployment

Once your template is ready:

1. Copy to Windows worker:
   ```
   C:\EmployeeBadgeAutomation\templates\EmployeeID.psd
   ```

2. Install required fonts on Windows machine

3. Run validation:
   ```
   node tests/mapping-verification.test.cjs
   ```

4. Test end-to-end badge generation

## Safety Notice

⚠️ **This template is for INTERNAL COMPANY BADGES ONLY**

Do NOT create templates that:
- Mimic official government IDs
- Include MRZ (Machine Readable Zones)
- Use official security features
- Claim legal identity verification
- Could be mistaken for official credentials

This is strictly for internal employee identification within your organization.

## Support

For template creation questions:
1. Review: `/reference/EMPLOYEEID_BACKBONE.md`
2. Check: `/FIELD_MAPPING_REFERENCE.md`
3. Use: `/CODEX_PROMPT.md` to generate exact scripts
4. Test: `/worker/scripts/test_job.jsx`

---

**Quick Start**: Place your `EmployeeID.psd` here, then follow the instructions in `/HOW_TO_USE_CODEX_PROMPT.md` to generate automation scripts.
