# EmployeeID.psd Structure Documentation
## Internal Employee Badge Studio

## Overview

This document defines the exact layer structure for `EmployeeID.psd`, which is used to generate internal company employee badges following the Internal Employee Badge Studio data model.

**Purpose**: Internal employee badge generation only  
**Safety**: No MRZ zones, no security features, no official document elements  
**Editing Mode**: Preserve all existing fonts, sizes, colors, positions, and effects  
**Data Model**: Matches Internal Employee Badge Studio exactly

## Document Properties

- **File Name**: EmployeeID.psd
- **Color Mode**: RGB
- **Dimensions**: 1050 × 660 px (standard badge aspect ratio)
- **Resolution**: 300 DPI
- **Template Type**: Internal Company Badge

## Main Layer Structure

```
EmployeeID.psd
├── BACKGROUND
│   └── Background Fill (solid color or gradient)
├── BADGE_CONTENT
│   ├── COMPANY_BRANDING
│   │   ├── Company Logo (Smart Object or vector)
│   │   └── Company Name (text layer)
│   ├── COMPANY_INFO
│   │   └── LOCATION (company location text)
│   ├── EMPLOYEE_INFO
│   │   ├── FIRST (first name)
│   │   ├── LAST (last name)
│   │   └── CODE (personal number)
│   ├── DOCUMENT_INFO
│   │   └── DOCNMBR (document number)
│   ├── VALIDITY
│   │   ├── VALID (valid from date)
│   │   └── ENDVALID (expires date)
│   ├── PERSONAL_INFO
│   │   ├── BIRTHDATE (birth date)
│   │   ├── YEAR (birth year)
│   │   ├── GENDER (gender)
│   │   ├── HEIGHT (height)
│   │   ├── COUNTRY (country of birth)
│   │   └── CITYBIRTH (city of birth)
│   ├── PHOTOS
│   │   ├── MAIN_PHOTO (Smart Object → editable)
│   │   └── SIGNATURE_AREA (Smart Object → editable)
│   └── DECORATIVE
│       ├── Border Elements
│       └── Background Patterns
└── OVERLAY
    └── Optional overlay effects
```

## Editable Text Layers

### Employee Information Group
**Group Path**: `BADGE_CONTENT/EMPLOYEE_INFO`

| Layer Name | Field Binding | Font | Size | Alignment | Sample Content |
|------------|---------------|------|------|-----------|----------------|
| FIRST | first_name | Helvetica-Bold | 36pt | Left | Mila |
| LAST | last_name | Helvetica-Bold | 36pt | Left | De Vries |
| CODE | personal_number | Helvetica | 20pt | Left | 123456789 |

### Document Information Group
**Group Path**: `BADGE_CONTENT/DOCUMENT_INFO`

| Layer Name | Field Binding | Font | Size | Alignment | Sample Content |
|------------|---------------|------|------|-----------|----------------|
| DOCNMBR | doc_number | Helvetica | 24pt | Left | AB12C34D5 |

### Validity Period Group
**Group Path**: `BADGE_CONTENT/VALIDITY`

| Layer Name | Field Binding | Font | Size | Alignment | Sample Content |
|------------|---------------|------|------|-----------|----------------|
| VALID | valid_from | Helvetica | 14pt | Left | 06/14/2020 |
| ENDVALID | expires | Helvetica | 14pt | Left | 06/14/2030 |

### Personal Information Group
**Group Path**: `BADGE_CONTENT/PERSONAL_INFO`

| Layer Name | Field Binding | Font | Size | Alignment | Sample Content |
|------------|---------------|------|------|-----------|----------------|
| BIRTHDATE | birth_date | Helvetica | 14pt | Left | 06/14/1990 |
| YEAR | birth_year | Helvetica | 18pt | Left | 1990 |
| GENDER | gender | Helvetica | 14pt | Left | Female |
| HEIGHT | height | Helvetica | 14pt | Left | 1,72 m |
| COUNTRY | country_of_birth | Helvetica | 14pt | Left | Nederlandse |
| CITYBIRTH | city_of_birth | Helvetica | 14pt | Left | Zoetermeer |

### Company Information Group
**Group Path**: `BADGE_CONTENT/COMPANY_INFO`

| Layer Name | Field Binding | Font | Size | Alignment | Sample Content |
|------------|---------------|------|------|-----------|----------------|
| LOCATION | company_location | Helvetica | 14pt | Left | Burg. van Zoetermeer |

## Smart Object Layers

### Main Photo Smart Object
**Layer Name**: `MAIN_PHOTO`  
**Group Path**: `BADGE_CONTENT/PHOTOS`  
**Type**: Smart Object (embedded PSB)  
**Purpose**: Employee photo placeholder

**Internal Structure** (when opened):
```
MAIN_PHOTO.psb
├── PHOTO_LAYER (editable raster layer)
├── MASK (vector or layer mask)
└── BACKGROUND (optional)
```

**Edit Target**: Replace `PHOTO_LAYER` contents with uploaded employee photo  
**Preserve**: Mask, position, clipping, effects

### Signature Smart Object
**Layer Name**: `SIGNATURE_AREA`  
**Group Path**: `BADGE_CONTENT/PHOTOS`  
**Type**: Smart Object (embedded PSB)  
**Purpose**: Employee signature placeholder

**Internal Structure** (when opened):
```
SIGNATURE_AREA.psb
├── SIGNATURE_LAYER (editable raster layer)
├── MASK (optional)
└── BACKGROUND (white or transparent)
```

**Edit Target**: Replace `SIGNATURE_LAYER` contents with uploaded signature image  
**Preserve**: Mask, position, background

## Font Requirements

| Font Family | PostScript Name | Weights | Usage |
|-------------|-----------------|---------|-------|
| Helvetica | Helvetica | Regular | Body text, codes, dates |
| Helvetica | Helvetica-Bold | Bold | Employee name |
| Arial (fallback) | ArialMT | Regular | Fallback if Helvetica missing |

## Layer Edit Rules

### ✅ ALLOWED Operations
1. **Text Content Replacement**: Update `textItem.contents` for listed editable layers
2. **Image Placement**: Replace Smart Object contents with uploaded images
3. **Smart Object Save**: Save and close Smart Objects after editing
4. **Export**: Export final PNG/PDF/PSD to output folder

### ❌ FORBIDDEN Operations
1. **DO NOT** change font family, font size, font color, or paragraph styles
2. **DO NOT** move, resize, or transform layers
3. **DO NOT** rasterize text or Smart Objects
4. **DO NOT** modify layer effects, blend modes, or opacity
5. **DO NOT** edit company branding, logos, or decorative elements
6. **DO NOT** add, delete, or rename layers
7. **DO NOT** save over the original EmployeeID.psd template
8. **DO NOT** flatten the document before export

## PSD Text Targets Reference

For automation scripts, use these exact layer names in `psdTextTargets`:

```json
{
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
}
```

## Field Validation

Before processing, validate input data:

| Field | Required | Type | Max Length | Validation |
|-------|----------|------|------------|------------|
| first_name | Yes | String | 50 chars | Non-empty |
| last_name | Yes | String | 50 chars | Non-empty |
| doc_number | Yes | String | 20 chars | Non-empty |
| personal_number | Yes | String | 20 chars | Non-empty |
| valid_from | Yes | Date | - | MM/DD/YYYY format |
| expires | Yes | Date | - | MM/DD/YYYY format |
| birth_date | Yes | Date | - | MM/DD/YYYY format |
| birth_year | Yes | String | 4 chars | Auto-calculated from birth_date |
| gender | Yes | String | 20 chars | Male/Female/Other |
| height | No | String | 20 chars | - |
| country_of_birth | No | String | 50 chars | - |
| city_of_birth | No | String | 50 chars | - |
| company_location | No | String | 50 chars | - |
| employee_photo_path | Yes | String | - | Valid file path |
| signature_image_path | No | String | - | Valid file path |
| export_format | Yes | Enum | - | png, pdf, or psd |

## Safety Boundaries

**THIS IS AN INTERNAL COMPANY BADGE TEMPLATE**

✅ Allowed Content:
- Employee name, personal number, document number
- Company branding and location
- Validity dates for internal access
- Employee photo and signature
- Decorative design elements
- Personal information (birth date, gender, height, city/country of birth)

❌ NOT ALLOWED (Official Document Features):
- MRZ (Machine Readable Zone)
- Security features (holograms, UV, microprint)
- Official government seals or emblems
- Passport/ID numbers in official formats
- Biometric indicators
- Official document numbering systems
- Claims of legal identity verification

## Version History

- **v2.0** (2024-05-24): Updated to match Internal Employee Badge Studio data model
  - Changed from single `employee_name` to `first_name` + `last_name`
  - Added `doc_number`, `personal_number`, `birth_date`, `birth_year`, `gender`, `height`, `country_of_birth`, `city_of_birth`, `company_location`
  - Updated PSD layer names to match Internal Employee Badge Studio: FIRST, LAST, DOCNMBR, CODE, VALID, ENDVALID, BIRTHDATE, YEAR, GENDER, HEIGHT, COUNTRY, CITYBIRTH, LOCATION
  - Purpose remains: Employee badge generation for internal company use only
