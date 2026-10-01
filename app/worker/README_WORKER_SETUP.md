# Badge Generation Worker Setup Guide

## Overview

This worker runs on a Windows machine with Photoshop installed. It polls Supabase for badge generation jobs, processes them with Photoshop automation, and uploads results back to Supabase.

**Purpose**: Internal company badge generation only  
**Data Model**: Matches Internal Employee Badge Studio exactly  
**Safety**: Never modifies the original template, works on copies  
**Requirements**: Windows 10/11, Node.js 16+, Photoshop CC 2020+

## Important: Data Model Alignment

This worker uses the **Internal Employee Badge Studio** data model. All field names, PSD layer mappings, and value transformations are defined in:

- **Frontend**: `src/lib/badgeMapping.ts` (single source of truth)
- **Worker Adapter**: `worker/job-adapter.js` (transforms BadgeJobPayload → Photoshop input)
- **PSD Structure**: `reference/EMPLOYEEID_BACKBONE.md` (layer specifications)

The worker does NOT invent field values. It consumes the BadgeJobPayload from Supabase and transforms it using `job-adapter.js`.

## Prerequisites

### Software Requirements

1. **Windows 10 or 11** (64-bit)
2. **Node.js 16.x or higher** - [Download](https://nodejs.org/)
3. **Adobe Photoshop CC 2020 or later** - Must support JSX scripting
4. **Git** (optional) - For cloning the repository

### Supabase Requirements

1. Supabase project created (see `SUPABASE_SETUP.md` in root)
2. `badge_jobs` table created
3. `worker_heartbeat` table created
4. `badge-inputs` and `badge-outputs` storage buckets created
5. Service role key available (NOT the anonymous key)

## Installation

### Step 1: Create Worker Folder

Create the base folder structure on your Windows machine:

```powershell
# Open PowerShell as Administrator
mkdir C:\EmployeeBadgeAutomation
cd C:\EmployeeBadgeAutomation

# Create subfolders
mkdir templates, fonts, scripts, logs, current-job, output
```

### Step 2: Copy Worker Files

Copy all files from the `/worker` directory to `C:\EmployeeBadgeAutomation`:

```
C:\EmployeeBadgeAutomation\
├── worker.js
├── job-adapter.js (IMPORTANT: transforms BadgeJobPayload → Photoshop input)
├── package.json
├── .env (create from .env.example)
├── EMPLOYEEID_LAYER_MAP.json
├── scripts\
│   ├── inspect_employeeid_layers.jsx
│   ├── font_preflight.jsx
│   ├── run_employeeid_job.jsx
│   └── test_employeeid_job.jsx
├── templates\
│   └── EmployeeID.psd (you need to create this)
├── fonts\
│   └── (install required fonts here)
├── logs\
├── current-job\
└── output\
```

### Step 3: Install Node Dependencies

```powershell
cd C:\EmployeeBadgeAutomation
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- `dotenv` - Environment variable loader

### Step 4: Configure Environment Variables

Create `.env` file in `C:\EmployeeBadgeAutomation`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
WORKER_ID=photoshop-worker-01
POLL_INTERVAL_MS=3000
HEARTBEAT_INTERVAL_MS=10000
```

**⚠️ CRITICAL SECURITY WARNING:**
- The `SUPABASE_SERVICE_KEY` is **NOT** the anonymous key
- This key has FULL database access
- NEVER commit this file to git
- NEVER share this key publicly
- Keep this file on your local Windows machine only

### Step 5: Install Required Fonts

Install all fonts used by EmployeeID.psd:

1. Download required fonts (Helvetica, Helvetica-Bold, or substitutes)
2. Right-click font files → "Install for all users"
3. Restart Photoshop if it's running

**Verify fonts are installed:**

```powershell
cd C:\EmployeeBadgeAutomation
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" scripts\font_preflight.jsx
```

Check `logs\font_report.json` to verify all required fonts are present.

### Step 6: Create EmployeeID.psd Template

Create the Photoshop template following the structure in `/reference/EMPLOYEEID_BACKBONE.md`.

**Layer structure must match:**
- `BADGE_CONTENT/EMPLOYEE_INFO/EMPLOYEE_NAME_TEXT`
- `BADGE_CONTENT/EMPLOYEE_INFO/EMPLOYEE_ID_TEXT`
- `BADGE_CONTENT/EMPLOYEE_INFO/DEPARTMENT_TEXT`
- `BADGE_CONTENT/EMPLOYEE_INFO/ROLE_TEXT`
- `BADGE_CONTENT/VALIDITY/VALID_FROM_TEXT`
- `BADGE_CONTENT/VALIDITY/VALID_UNTIL_TEXT`
- `BADGE_CONTENT/PHOTOS/MAIN_PHOTO` (Smart Object)
- `BADGE_CONTENT/PHOTOS/SIGNATURE_AREA` (Smart Object)

Save as: `C:\EmployeeBadgeAutomation\templates\EmployeeID.psd`

### Step 7: Verify Template Structure

Run the layer inspector to verify all required layers exist:

```powershell
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" scripts\inspect_employeeid_layers.jsx
```

Check `logs\employeeid_layer_report.json`:
- `all_required_present` should be `true`
- If false, check `missing_layers` array

## Testing

### Test 1: Font Preflight

Verify all required fonts are installed:

```powershell
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" scripts\font_preflight.jsx
```

**Expected output:**
- `logs\font_report.json` with `"all_fonts_available": true`

### Test 2: Layer Inspection

Verify template structure is correct:

```powershell
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" scripts\inspect_employeeid_layers.jsx
```

**Expected output:**
- `logs\employeeid_layer_report.json` with `"all_required_present": true`

### Test 3: Dry Run Job

Process a test badge without Supabase:

```powershell
"C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe" scripts\test_employeeid_job.jsx
```

**Expected output:**
- `output\test-job\result.png` - Generated badge
- `output\test-job\test_report.json` - Test report

**Verify:**
1. PNG file opens correctly
2. Text fields show "JOHN DOE", "EMP001234", etc.
3. No errors in test report

### Test 4: Worker Connectivity

Test worker connection to Supabase:

```powershell
node worker.js
```

**Expected console output:**
```
========================================
Badge Generation Worker Starting
========================================
Worker ID: photoshop-worker-01
Supabase URL: https://your-project.supabase.co
Poll Interval: 3000ms
Heartbeat Interval: 10000ms
========================================
```

Press `Ctrl+C` to stop after verifying connection.

## Running the Worker

### Start Worker

```powershell
cd C:\EmployeeBadgeAutomation
node worker.js
```

### Run as Windows Service (Optional)

For production, run as a Windows service using `node-windows`:

```powershell
npm install -g node-windows
npm install node-windows

# Create service installer script
# (See below for service setup)
```

### Monitor Worker

Check Supabase `worker_heartbeat` table:
- `last_seen_at` should update every 10 seconds
- `status` should be "online"
- `current_job_id` shows active job (or NULL if idle)

## Troubleshooting

### Issue: "Template not found"

**Solution:**
- Verify `C:\EmployeeBadgeAutomation\templates\EmployeeID.psd` exists
- Check file permissions (worker must have read access)

### Issue: "Layer not found"

**Solution:**
1. Run `inspect_employeeid_layers.jsx`
2. Check `logs\employeeid_layer_report.json`
3. Compare `missing_layers` with `EMPLOYEEID_LAYER_MAP.json`
4. Fix layer names in Photoshop template

### Issue: "Font missing"

**Solution:**
1. Run `font_preflight.jsx`
2. Check `logs\font_report.json` for `missing_fonts`
3. Install missing fonts
4. Restart Photoshop
5. Re-run font preflight

### Issue: "Photoshop not responding"

**Solution:**
- Check Photoshop path in `worker.js` (line 19)
- Default: `C:\Program Files\Adobe\Adobe Photoshop 2024\Photoshop.exe`
- Update to your Photoshop version
- Verify Photoshop supports scripting (not Express/Web version)

### Issue: "Cannot download photo from Supabase"

**Solution:**
- Verify `badge-inputs` bucket exists
- Check storage policies allow service role to read
- Verify file was uploaded correctly from frontend

### Issue: "Cannot upload result to Supabase"

**Solution:**
- Verify `badge-outputs` bucket exists
- Check storage policies allow service role to insert
- Verify service role key has correct permissions

### Issue: "Smart Object edit failed"

**Solution:**
- Verify Smart Object layer exists and is named correctly
- Ensure Smart Object is embedded (not linked)
- Check internal target layer name matches `EMPLOYEEID_LAYER_MAP.json`

### Issue: "Worker heartbeat not updating"

**Solution:**
- Verify `worker_heartbeat` table exists
- Check service role key has INSERT/UPDATE permissions
- Check network connectivity to Supabase

## Workflow

### Normal Job Processing

1. **Frontend** creates job in Supabase (`status: queued`)
2. **Worker** polls and finds queued job
3. **Worker** claims job (`status: processing`)
4. **Worker** downloads photo/signature from `badge-inputs`
5. **Worker** creates `current-job/input.json`
6. **Worker** launches Photoshop with `run_employeeid_job.jsx`
7. **Photoshop** opens template (copy)
8. **Photoshop** updates text layers
9. **Photoshop** updates Smart Object images
10. **Photoshop** exports PNG/PDF/PSD to `output/{job_id}/`
11. **Worker** uploads results to `badge-outputs`
12. **Worker** marks job complete (`status: complete`)
13. **Frontend** displays download buttons

### Error Handling

If any step fails:
1. **Worker** catches error
2. **Worker** marks job failed (`status: failed`, `error_message`)
3. **Worker** cleans up `current-job/` folder
4. **Worker** continues polling for next job

## Maintenance

### Log Files

Logs are written to `C:\EmployeeBadgeAutomation\logs\`:
- `font_report.json` - Font preflight results
- `employeeid_layer_report.json` - Template structure verification
- Worker console output (capture with `> worker.log 2>&1`)

### Cleanup

Old output folders accumulate in `output/{job_id}/`. Clean up periodically:

```powershell
# Delete output folders older than 7 days
$limit = (Get-Date).AddDays(-7)
Get-ChildItem "C:\EmployeeBadgeAutomation\output" | 
  Where-Object { $_.PSIsContainer -and $_.CreationTime -lt $limit } | 
  Remove-Item -Recurse -Force
```

### Updating Scripts

When updating Photoshop scripts:
1. Stop the worker (`Ctrl+C`)
2. Replace script files in `scripts\`
3. Test with dry run: `test_employeeid_job.jsx`
4. Restart worker

### Updating Template

When updating `EmployeeID.psd`:
1. Edit template manually in Photoshop
2. Run `inspect_employeeid_layers.jsx` to verify structure
3. Update `EMPLOYEEID_LAYER_MAP.json` if layer names changed
4. Test with dry run
5. No worker restart needed (template is loaded per job)

## Security Best Practices

1. **Never commit `.env`** to git (add to `.gitignore`)
2. **Restrict access** to `C:\EmployeeBadgeAutomation` folder
3. **Use Windows Firewall** to limit network access
4. **Run worker as limited user** (not Administrator)
5. **Keep service key secure** (rotate if compromised)
6. **Monitor logs** for suspicious activity
7. **Update Node.js** and dependencies regularly

## Performance

### Typical Job Processing Time

- **Simple badge (PNG only)**: 5-15 seconds
- **With photo + signature**: 10-20 seconds
- **PDF export**: +5 seconds
- **PSD export**: +10 seconds

### Bottlenecks

- **Photoshop startup**: 2-5 seconds per job
- **Network upload**: Depends on file size and connection
- **Font rendering**: Slow if many fonts installed

### Optimization

- **Keep template small**: 1050×660 px at 300 DPI
- **Minimize layers**: Flatten decorative elements
- **Pre-install fonts**: Don't load fonts per job
- **Use SSD**: Store template on SSD for faster read

## Photoshop Version Compatibility

Tested with:
- ✅ Photoshop CC 2020 (21.x)
- ✅ Photoshop 2021 (22.x)
- ✅ Photoshop 2022 (23.x)
- ✅ Photoshop 2023 (24.x)
- ✅ Photoshop 2024 (25.x)

Not compatible:
- ❌ Photoshop Elements (no JSX scripting)
- ❌ Photoshop Express (web/mobile app)
- ❌ Photoshop CS6 or earlier (outdated APIs)

## Support

For issues:
1. Check troubleshooting section above
2. Review logs in `logs/` folder
3. Test with dry run scripts
4. Verify Supabase connection
5. Check template structure

## Safety Reminder

**This system is for internal company badge generation ONLY.**

Do NOT use for:
- Official government identity documents
- Passports or driver licenses
- Security credentials with legal validity
- Documents claiming official identity verification

The worker will ONLY process jobs with `"intended_use": "internal_company_badge"` in the job metadata.
