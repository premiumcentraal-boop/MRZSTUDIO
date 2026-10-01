# ID Generator Implementation Checklist

## ✅ Completed - Data Model Alignment

- [x] **badgeMapping.ts created** - Single source of truth for field definitions, PSD layer mapping, and validation
- [x] **BadgeJobPayload updated** - Matches Internal Employee Badge Studio exactly
- [x] **Frontend form updated** - Collects all Internal Employee Badge Studio fields
- [x] **Worker job-adapter.js created** - Transforms Supabase rows to Photoshop input.json
- [x] **Photoshop script updated** - Uses psdTextTargets for layer mapping
- [x] **EMPLOYEEID_LAYER_MAP.json updated** - Reflects Internal Employee Badge Studio structure
- [x] **EMPLOYEEID_BACKBONE.md updated** - Documents PSD layer structure matching data model
- [x] **Mapping verification test created** - Validates consistency across all layers

## ✅ Completed - Frontend

- [x] New "ID Generator" page added to Custom Tools navigation
- [x] Route `/custom-tools/id-generator` configured
- [x] Complete form with all Internal Employee Badge Studio fields:
  - **Company Section:**
    - [x] Company Name (required)
    - [x] Issuer Code (required)
    - [x] Department (optional)
  - **Employee Section:**
    - [x] First Name (required)
    - [x] Last Name (required)
    - [x] Document Number (required)
    - [x] Personal Number (required)
  - **Validity Section:**
    - [x] Valid From date picker (required)
    - [x] Expires date picker (required)
  - **Personal Information Section:**
    - [x] Birth Date date picker (required)
    - [x] Birth Year (auto-calculated from birth date)
    - [x] Gender selector (required)
    - [x] Height (optional)
    - [x] Country of Birth (optional)
    - [x] City of Birth (optional)
    - [x] Company Location (optional)
  - **Uploads:**
    - [x] Employee Photo upload (required)
    - [x] Signature Image upload (optional)
  - **Export Settings:**
    - [x] Export Format selector (PNG/PDF/PSD)
- [x] Image upload preview for photo and signature
- [x] Job creation and submission flow
- [x] Job status polling (every 3 seconds)
- [x] Recent jobs table display
- [x] Worker online/offline status indicator
- [x] Download buttons for completed jobs
- [x] Safety notice: "For internal company badge use only"
- [x] TypeScript interfaces for BadgeJob and WorkerHeartbeat
- [x] Supabase client integration
- [x] Mock worker mode for development
- [x] Comprehensive validation using badgeMapping.ts

## ✅ Completed - Package Dependencies

- [x] @supabase/supabase-js installed
- [x] Lucide React icons (Badge, User, Calendar, Clock, Loader2, Info, etc.)

## ⚠️ Partially Complete - Needs Configuration

- [ ] Environment variables (`.env` file not created, needs user input):
  - [ ] `VITE_SUPABASE_URL` - Supabase project URL
  - [ ] `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
  - [ ] `VITE_MOCK_ID_GENERATOR` - Optional, for mock worker mode
- [ ] Supabase project setup:
  - [ ] Create `badge_jobs` table with updated schema (SQL script in SUPABASE_SETUP.md)
  - [ ] Create `worker_heartbeat` table (SQL script in SUPABASE_SETUP.md)
  - [ ] Create `badge-inputs` storage bucket
  - [ ] Create `badge-outputs` storage bucket
  - [ ] Create `badge-templates` storage bucket (optional)
  - [ ] Enable Row Level Security (RLS) policies
  - [ ] Configure storage bucket access policies

## ✅ Complete - Local Worker (Scripts & Documentation)

- [x] Local Windows worker application (`worker/worker.js`)
- [x] Worker job adapter (`worker/job-adapter.js`) - Converts badge_jobs to Photoshop input
- [x] Worker environment variables template (`.env.example`):
  - [x] `SUPABASE_URL` - Same as frontend
  - [x] `SUPABASE_SERVICE_KEY` - Service role key (NOT anon key)
  - [x] `WORKER_ID` - Unique worker identifier
  - [x] `POLL_INTERVAL_MS` - Job polling frequency
  - [x] `HEARTBEAT_INTERVAL_MS` - Heartbeat update frequency
- [x] Worker folder structure defined:
  - [x] `C:/EmployeeBadgeAutomation/worker.js`
  - [x] `C:/EmployeeBadgeAutomation/job-adapter.js`
  - [x] `C:/EmployeeBadgeAutomation/scripts/run_employeeid_job.jsx`
  - [x] `C:/EmployeeBadgeAutomation/scripts/inspect_employeeid_layers.jsx`
  - [x] `C:/EmployeeBadgeAutomation/scripts/font_preflight.jsx`
  - [x] `C:/EmployeeBadgeAutomation/scripts/test_employeeid_job.jsx`
  - [x] `C:/EmployeeBadgeAutomation/templates/` (for EmployeeID.psd)
  - [x] `C:/EmployeeBadgeAutomation/fonts/` (for required fonts)
  - [x] `C:/EmployeeBadgeAutomation/current-job/`
  - [x] `C:/EmployeeBadgeAutomation/output/{job_id}/`
  - [x] `C:/EmployeeBadgeAutomation/logs/`
- [x] Worker job polling logic
- [x] Photoshop JSX scripts:
  - [x] Main job processor (`run_employeeid_job.jsx`) - Uses psdTextTargets mapping
  - [x] Layer inspector (`inspect_employeeid_layers.jsx`)
  - [x] Font preflight (`font_preflight.jsx`)
  - [x] Test/dry-run script (`test_employeeid_job.jsx`)
- [x] Worker heartbeat updater (every 10 seconds)
- [x] Asset download from Supabase Storage
- [x] Result upload to Supabase Storage
- [x] Job status updates (processing → complete/failed)
- [x] Layer map JSON (`EMPLOYEEID_LAYER_MAP.json`) - Updated with Internal Employee Badge Studio structure
- [x] Worker setup documentation (`README_WORKER_SETUP.md`)

## ✅ Completed - Mapping & Validation

- [x] Single source of truth: `src/lib/badgeMapping.ts`
  - [x] Company field definitions (company_name, issuer_code, department)
  - [x] Employee field definitions (13 fields total)
  - [x] PSD layer mapping (field → PSD layer name)
  - [x] Value calculation functions (calculateBirthYear, formatDateMMDDYYYY)
  - [x] Payload to Photoshop input converter
  - [x] Validation functions
- [x] Worker adapter: `worker/job-adapter.js`
  - [x] Converts badge_jobs rows to Photoshop input.json
  - [x] Uses canonical mapping from badgeMapping logic
  - [x] Validates input structure before processing
- [x] Mapping verification test: `tests/mapping-verification.test.cjs`
  - [x] Verifies BadgeJobPayload contains all required fields
  - [x] Confirms worker input.json preserves all fields
  - [x] Validates psdTextTargets contains exact PSD layer names
  - [x] Tests example values map correctly
  - [x] Checks for duplicate or conflicting mappings
  - [x] Verifies date formatting (ISO → MM/DD/YYYY)
  - [x] Confirms birth year auto-calculation

## ⚠️ Needs Manual Setup - Windows Environment

- [ ] Install Node.js 16+ on Windows
- [ ] Install Adobe Photoshop CC 2020+
- [ ] Create `C:/EmployeeBadgeAutomation` folder structure
- [ ] Copy worker files to Windows machine (including job-adapter.js)
- [ ] Run `npm install` in worker directory
- [ ] Create `.env` file with real Supabase credentials
- [ ] Install required fonts (Helvetica, Helvetica-Bold)
- [ ] Create EmployeeID.psd template following Internal Employee Badge Studio structure
- [ ] Run font preflight script
- [ ] Run layer inspector script
- [ ] Run dry-run test script
- [ ] Run mapping verification test
- [ ] Start worker with `node worker.js`

## ❌ Not Started - Photoshop Template

- [ ] EmployeeID.psd template file matching Internal Employee Badge Studio structure
- [ ] Required fonts installed on Windows machine
- [ ] Layer naming convention following PSD layer mapping
- [ ] Smart object structure for photo and signature
- [ ] JSX automation script validates against:
  - [ ] Text layer updates (13 PSD layers: FIRST, LAST, DOCNMBR, CODE, VALID, ENDVALID, BIRTHDATE, YEAR, GENDER, HEIGHT, COUNTRY, CITYBIRTH, LOCATION)
  - [ ] Photo placement in MAIN_PHOTO smart object
  - [ ] Signature placement in SIGNATURE_AREA smart object
  - [ ] PNG/PDF/PSD export

## 🎯 What You Can Test Now

1. **Mapping Verification**: Run `node tests/mapping-verification.test.cjs` to verify data model consistency
2. **UI Navigation**: Navigate to Custom Tools → ID Generator
3. **Form Validation**: Fill out all Internal Employee Badge Studio fields and see validation messages
4. **File Upload Preview**: Upload photos and see previews
5. **Mock Mode** (after adding `VITE_MOCK_ID_GENERATOR=true`): Test the full UI flow without real backend

## 🚧 What Requires Setup

1. **Job Creation**: Needs Supabase project + environment variables
2. **Job Polling**: Needs database tables created with updated schema
3. **Worker Status**: Needs worker_heartbeat table and running worker
4. **Job Processing**: Needs local Windows worker + Photoshop + template
5. **Download Results**: Needs completed jobs in badge-outputs bucket

## 📋 Setup Priority Order

1. **Phase 1 - Frontend Testing** (No external dependencies)
   - Run mapping verification test
   - Add mock worker mode
   - Test UI, forms, validation, navigation

2. **Phase 2 - Supabase Integration** (Cloud setup)
   - Create Supabase project
   - Add environment variables
   - Run SQL migrations with updated schema
   - Create storage buckets
   - Test job creation and status display

3. **Phase 3 - Local Worker** (Windows machine setup)
   - Set up worker environment
   - Create EmployeeID.psd template following Internal Employee Badge Studio structure
   - Install required fonts
   - Test Photoshop JSX scripts
   - Run mapping verification test
   - Test end-to-end job processing

## 🔐 Security Checklist

- [x] Frontend uses only VITE_SUPABASE_ANON_KEY (not service role key)
- [ ] RLS policies enabled on badge_jobs table
- [ ] RLS policies enabled on worker_heartbeat table
- [ ] Storage bucket policies configured
- [ ] Service role key only used by local worker (never committed to git)
- [x] Input validation on file uploads (type, size)
- [x] Field validation using badgeMapping.ts
- [ ] Signed URLs for storage access
- [ ] No sensitive data in frontend error messages

## 📝 Documentation Status

- [x] SUPABASE_SETUP.md created
- [x] reference/EMPLOYEEID_BACKBONE.md updated with Internal Employee Badge Studio structure
- [x] IMPLEMENTATION_CHECKLIST.md (this file)
- [x] src/lib/badgeMapping.ts - Single source of truth documentation
- [x] worker/job-adapter.js - Worker payload conversion logic
- [x] worker/README_WORKER_SETUP.md
- [x] tests/mapping-verification.test.cjs - Mapping consistency test
- [x] Photoshop JSX script documentation

## ⚡ Data Model Documentation

**Source of Truth Files:**
1. **src/lib/badgeMapping.ts** - Field definitions, PSD layer mapping, validation rules
2. **reference/EMPLOYEEID_BACKBONE.md** - EmployeeID.psd layer structure specification
3. **worker/EMPLOYEEID_LAYER_MAP.json** - Machine-readable PSD layer definitions

**Data Flow:**
```
Frontend Form
  ↓ (collects Internal Employee Badge Studio fields)
BadgeJobPayload
  ↓ (stored in Supabase badge_jobs.input_json)
Worker job-adapter.js
  ↓ (uses badgeMapping logic)
Photoshop input.json
  ↓ (psdTextTargets mapping)
run_employeeid_job.jsx
  ↓ (updates PSD layers)
EmployeeID.psd → result.png/pdf/psd
```

**Key Principle:**
The Internal Employee Badge Studio form is the source of truth for input values. The badgeMapping.ts file is the source of truth for calculations and PSD layer mapping. The local Photoshop worker is only the rendering engine.

## ⚡ Next Steps

1. Update Supabase schema to accommodate new fields
2. Create comprehensive documentation for PSD template creation
3. Add integration tests for worker → Photoshop flow
4. Document example badge generation workflow
5. Add error recovery and retry logic
6. Create Windows worker installer/setup script
