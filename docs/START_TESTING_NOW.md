# 🚀 Start Testing Your ID Generator Now!

## ✅ You're Ready to Test!

Your app is fully connected to Supabase. You can start testing the ID Generator **right now** without any additional setup.

## Quick Start (2 minutes)

### Step 1: Start the Dev Server
```bash
npm run dev
```

### Step 2: Open in Browser
```
http://localhost:5173
```

### Step 3: Navigate to ID Generator
```
Custom Tools → ID Generator
```

### Step 4: Fill Out the Form

**Company Information:**
- Company Name: Acme Corporation
- Issuer Code: NLD
- Department: Engineering

**Employee Information:**
- First Name: Mila
- Last Name: De Vries
- Document Number: AB12C34D5
- Personal Number: 123456789

**Validity Period:**
- Valid From: 2020-06-14
- Expires: 2030-06-14

**Personal Information:**
- Birth Date: 1990-06-14
- Gender: Female
- Height: 1,72 m
- Country of Birth: Nederlandse
- City of Birth: Zoetermeer
- Company Location: Burg. van Zoetermeer

**Upload:**
- Employee Photo: (any JPG/PNG test image)

**Export:**
- Format: PNG

### Step 5: Generate Badge
Click "Generate Badge" button

### Step 6: What Happens Next

✅ **Photo uploads to Supabase** - You'll see upload progress
✅ **Job created in database** - Status changes to "queued"
✅ **UI shows job status** - Polls every 3 seconds
⏳ **Job stays queued** - No worker deployed yet (expected)

## What You'll See

### ✅ Working Features
- Form loads with all 19 fields
- Real-time validation
- Photo preview
- File upload to Supabase
- Job creation
- Status polling
- Worker status indicator (shows "offline")

### ⏳ Waiting Features (Need Worker)
- Job processing
- Badge generation
- Download buttons

**This is normal!** The worker needs to be deployed on Windows with Photoshop.

## Verify in Supabase Dashboard

### Check Your Job
1. Go to: https://app.supabase.com/project/hadssmwwclzxfujrpatd/editor
2. Click `badge_jobs` table
3. See your job with status "queued"
4. View the complete `input_json` payload

### Check Your Upload
1. Go to: https://app.supabase.com/project/hadssmwwclzxfujrpatd/storage/buckets/badge-inputs
2. See your uploaded photo
3. Click to view/download

## Test Different Scenarios

### Test 1: Multiple Jobs
Create 3-4 jobs with different data. They should all queue up.

### Test 2: Optional Fields
Leave some fields blank (height, city of birth, etc.). Should work fine.

### Test 3: File Upload
Try different image formats: JPG, PNG, WebP. Should all work.

### Test 4: Validation
Try to submit without required fields. Should show validation errors.

### Test 5: Mock Mode
```bash
# Edit .env
VITE_MOCK_ID_GENERATOR=true

# Restart server
npm run dev

# Create a job
# Mock worker simulates processing: queued → processing → complete (5 sec)
```

## What's Connected vs. What's Not

| Component | Status | Can Test? |
|-----------|--------|-----------|
| **Frontend UI** | ✅ Connected | YES |
| **Supabase Database** | ✅ Connected | YES |
| **Photo Upload** | ✅ Connected | YES |
| **Job Creation** | ✅ Connected | YES |
| **Job Polling** | ✅ Connected | YES |
| **Worker Status** | ✅ Connected | YES (shows offline) |
| **Job Processing** | ❌ No worker | NO (stays queued) |
| **Badge Generation** | ❌ No worker | NO (need Photoshop) |
| **Download Results** | ❌ No worker | NO (no results yet) |

## What Happens When Jobs Stay Queued

**This is expected!** Jobs will remain in "queued" status because:
1. No Windows worker deployed yet
2. No Photoshop automation configured
3. This is normal at this stage

**Jobs will process automatically when:**
1. You deploy the Windows worker
2. You create the PSD template
3. You generate the Photoshop scripts
4. You start the worker with `node worker.js`

## Check Recent Jobs

The ID Generator page shows:
- Current job status
- Recent jobs table (last 10)
- Job details (employee name, timestamp, status)
- Worker online/offline indicator

## Browser Console Check

Open browser console (F12) and look for:

**✅ Good:**
```
No Supabase errors
No "Not Configured" warnings
Upload progress logs
Job creation success
```

**❌ Problems:**
```
"Supabase Not Configured" → Check .env file
Upload errors → Check file size/type
Insert errors → Check RLS policies
```

## Test Suite

Run the full test suite:

```bash
# Test 1: Environment check
node check-env.cjs

# Test 2: Supabase connection
node test-supabase-connection.cjs

# Test 3: Data model verification
node tests/mapping-verification.test.cjs

# All should pass ✅
```

## Quick Fixes

### "Supabase Not Configured" Warning
```bash
# 1. Check .env exists
cat .env

# 2. Restart dev server
npm run dev

# 3. Hard refresh browser
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (Mac)
```

### Photo Upload Fails
```bash
# Check file:
# - Under 10MB
# - Type: PNG, JPG, or WebP
# - Not corrupted
```

### Job Creation Fails
```bash
# 1. Run connection test
node test-supabase-connection.cjs

# 2. Check browser console
# 3. Check Supabase dashboard for errors
```

## What to Do After Testing

### Option 1: Continue with Mock Mode
```env
# .env
VITE_MOCK_ID_GENERATOR=true
```
- Simulates complete workflow
- No worker needed
- Tests UI/UX flow
- Perfect for frontend development

### Option 2: Deploy the Worker
```bash
# Follow these guides in order:
1. Card_Generator/README.md        # Create PSD
2. HOW_TO_USE_CODEX_PROMPT.md      # Generate scripts
3. worker/README_WORKER_SETUP.md   # Deploy worker
```
- Gets you to 100% complete
- Real badge generation
- Full end-to-end testing
- Production ready

## Success Criteria

After testing, you should have:
- ✅ Created at least 1 test job
- ✅ Seen job appear in Supabase dashboard
- ✅ Verified photo uploaded to storage
- ✅ Confirmed status polling works
- ✅ No errors in browser console
- ✅ Worker status shows correctly (offline)

## Next Steps

**Choose your path:**

### Path A: Frontend Development (No Worker)
```bash
# Enable mock mode
echo "VITE_MOCK_ID_GENERATOR=true" >> .env
npm run dev

# Test complete workflow
# Jobs simulate: queued → processing → complete
```

### Path B: Full Production Setup (With Worker)
```bash
# 1. Create PSD template (30-60 min)
cat Card_Generator/README.md

# 2. Generate Photoshop scripts (10 min)
cat HOW_TO_USE_CODEX_PROMPT.md

# 3. Deploy Windows worker (45 min)
cat worker/README_WORKER_SETUP.md
```

## Documentation Quick Links

| Document | Purpose | When to Read |
|----------|---------|-------------|
| `START_TESTING_NOW.md` | This file | Right now ✅ |
| `SUPABASE_CONNECTION_COMPLETE.md` | Connection details | After testing |
| `HOW_TO_USE_CODEX_PROMPT.md` | Generate PSD scripts | When ready for worker |
| `NEXT_STEPS.md` | Complete workflow | Planning ahead |
| `FIELD_MAPPING_REFERENCE.md` | Field reference | During development |

## Support

**Test not working?**
1. Run: `node test-supabase-connection.cjs`
2. Check: `.env` file has correct values
3. Verify: Supabase dashboard shows tables/buckets
4. Review: Browser console for errors

**Ready for production?**
1. Create PSD template
2. Generate automation scripts
3. Deploy Windows worker
4. Test end-to-end

---

## 🎉 You're All Set!

Your Supabase connection is complete and tested. Start the dev server and create your first badge job!

```bash
npm run dev
```

Then navigate to: **Custom Tools → ID Generator**
