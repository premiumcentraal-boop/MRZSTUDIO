# ✅ Environment Files Created

## Files Saved

### 1. Frontend Environment (`.env`)
**Location:** `/workspaces/default/code/.env`

```env
VITE_SUPABASE_URL=https://hadssmwwclzxfujrpatd.supabase.co
VITE_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
VITE_MOCK_ID_GENERATOR=false
```

### 2. Worker Environment (`worker/.env`)
**Location:** `/workspaces/default/code/worker/.env`

```env
SUPABASE_URL=https://hadssmwwclzxfujrpatd.supabase.co
SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY>
WORKER_ID=photoshop-worker-01
POLL_INTERVAL_MS=3000
HEARTBEAT_INTERVAL_MS=10000
```

### 3. Git Ignore (`.gitignore`)
**Location:** `/workspaces/default/code/.gitignore`
- Ensures `.env` files are never committed to git
- Protects sensitive credentials

---

## ⚠️ IMPORTANT: Security Warning

**Please read:** `SUPABASE_SECURITY_WARNING.md`

Your keys appear to use the format `sb_secret_...` which is **not** the standard Supabase key format.

**Standard Supabase keys look like:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZHNzbXd3Y2x6eGZ1anJwYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk5NTg4MDAsImV4cCI6MjAwNTUzNDgwMH0...
```

### How to Get Correct Keys:

1. Go to: https://app.supabase.com/project/hadssmwwclzxfujrpatd/settings/api
2. Look for two keys:
   - **`anon public`** - Use in `.env` (frontend)
   - **`service_role secret`** - Use in `worker/.env` (worker only)
3. Both should start with `eyJ` and be very long JWT tokens
4. Update both `.env` files with the correct keys

---

## ✅ Next Steps

### Step 1: Verify Supabase Keys (5 minutes)

```bash
# 1. Go to Supabase Dashboard
https://app.supabase.com/project/hadssmwwclzxfujrpatd/settings/api

# 2. Copy the correct keys
# - anon public → .env
# - service_role secret → worker/.env

# 3. Verify key format
# Both should start with: eyJ
```

### Step 2: Setup Supabase Database (20 minutes)

```bash
# Follow the complete setup guide
cat SUPABASE_SETUP.md

# You need to create:
# - badge_jobs table
# - worker_heartbeat table
# - badge-inputs storage bucket
# - badge-outputs storage bucket
# - RLS policies
```

### Step 3: Test Frontend (2 minutes)

```bash
# Start the development server
npm run dev

# Open browser to:
http://localhost:5173

# Navigate to:
Custom Tools → ID Generator

# You should see the form
```

### Step 4: Create Your PSD Template (30-60 minutes)

```bash
# Read the template requirements
cat Card_Generator/README.md
cat reference/EMPLOYEEID_BACKBONE.md

# Design your badge in Photoshop with:
# - 13 text layers (exact names required)
# - 2 Smart Objects (MAIN_PHOTO, SIGNATURE_AREA)
# - Save as: Card_Generator/EmployeeID.psd
```

### Step 5: Generate Photoshop Scripts (10 minutes)

```bash
# Read the instructions
cat HOW_TO_USE_CODEX_PROMPT.md

# Use the prompt
cat CODEX_PROMPT.md

# Then:
# 1. Open new AI conversation
# 2. Attach your EmployeeID.psd
# 3. Paste CODEX_PROMPT.md contents
# 4. Get production-ready scripts
# 5. Copy to worker/scripts/
```

### Step 6: Deploy Worker to Windows (45 minutes)

```bash
# Read the setup guide
cat worker/README_WORKER_SETUP.md

# On Windows machine:
# 1. Install Node.js 16+
# 2. Install Photoshop CC 2020+
# 3. Create C:\EmployeeBadgeAutomation folder
# 4. Copy all worker files
# 5. Copy .env file with correct keys
# 6. Install fonts
# 7. Run: npm install
# 8. Test scripts
# 9. Start: node worker.js
```

### Step 7: Test End-to-End (15 minutes)

```bash
# 1. Make sure worker is running on Windows
# 2. Frontend dev server running
# 3. Navigate to ID Generator
# 4. Fill form completely
# 5. Upload test photo
# 6. Generate badge
# 7. Wait for completion
# 8. Download result
# 9. Verify all fields correct
```

---

## 📊 Current Status

| Component | Status | Next Action |
|-----------|--------|-------------|
| **Environment Files** | ✅ Created | Verify correct keys |
| **Supabase Project** | ✅ Exists | Setup database tables |
| **Frontend Code** | ✅ Ready | Test with real Supabase |
| **Worker Code** | ✅ Ready | Deploy to Windows |
| **PSD Template** | ❌ Not created | Design in Photoshop |
| **PSD Scripts** | ⚠️ Generic | Generate custom scripts |
| **End-to-End** | ❌ Not tested | Complete setup first |

---

## 🔍 Quick Tests

### Test 1: Frontend Connects to Supabase

```bash
# Start dev server
npm run dev

# Open browser console (F12)
# Navigate to ID Generator
# Check console for errors
# Should NOT see "Supabase Not Configured" warning
```

**Expected:** Form loads without errors

### Test 2: Worker Connects to Supabase

```bash
# On Windows (after deploying worker)
cd C:\EmployeeBadgeAutomation
node worker.js

# Should see:
# ========================================
# Badge Generation Worker Starting
# ========================================
# Worker ID: photoshop-worker-01
# Supabase URL: https://hadssmwwclzxfujrpatd.supabase.co
# Poll Interval: 3000ms
# ========================================
```

**Expected:** Worker starts without errors

### Test 3: Create Test Job

```bash
# 1. Fill ID Generator form
# 2. Upload photo
# 3. Click Generate Badge
# 4. Check browser console
# 5. Check Supabase dashboard

# Job should appear in badge_jobs table
```

**Expected:** Job created in database

---

## 🆘 Troubleshooting

### "Supabase Not Configured" Warning

**Problem:** Frontend can't connect to Supabase

**Solution:**
1. Check `.env` file exists
2. Verify `VITE_SUPABASE_URL` is correct
3. Verify `VITE_SUPABASE_ANON_KEY` starts with `eyJ`
4. Restart dev server: `npm run dev`

### Worker Can't Connect

**Problem:** Worker fails to start or shows connection errors

**Solution:**
1. Check `worker/.env` file exists
2. Verify `SUPABASE_SERVICE_KEY` starts with `eyJ`
3. Verify you're using service_role key, not anon key
4. Test connection to Supabase in browser

### "Relation 'badge_jobs' does not exist"

**Problem:** Database tables not created

**Solution:**
1. Open `SUPABASE_SETUP.md`
2. Go to Supabase SQL Editor
3. Run all SQL migrations
4. Create storage buckets
5. Set up RLS policies

### Jobs Stay in "Queued" Status

**Problem:** Worker not picking up jobs

**Solutions:**
- Check worker is running: `node worker.js`
- Check worker heartbeat in `worker_heartbeat` table
- Check worker logs for errors
- Verify service role key has correct permissions

---

## 📚 Documentation Reference

| Document | Purpose |
|----------|---------|
| `SUPABASE_SECURITY_WARNING.md` | ⚠️ Read this about your keys |
| `SUPABASE_SETUP.md` | Database setup instructions |
| `HOW_TO_USE_CODEX_PROMPT.md` | Generate PSD scripts |
| `CODEX_PROMPT.md` | AI prompt for scripts |
| `NEXT_STEPS.md` | Complete workflow guide |
| `worker/README_WORKER_SETUP.md` | Windows worker deployment |
| `Card_Generator/README.md` | PSD template requirements |
| `FIELD_MAPPING_REFERENCE.md` | Field → PSD layer mapping |

---

## ✅ Checklist Before Going Live

Before testing the full system:

- [ ] Supabase keys verified (both start with `eyJ`)
- [ ] `.env` has anon key
- [ ] `worker/.env` has service_role key
- [ ] Database tables created
- [ ] Storage buckets created
- [ ] RLS policies configured
- [ ] EmployeeID.psd template created
- [ ] Custom PSD scripts generated
- [ ] Fonts installed on Windows
- [ ] Worker deployed to Windows
- [ ] Worker starts without errors
- [ ] Test job completes successfully

---

## 🎯 Priority Actions (Do These First)

### 1. ⚠️ Fix Supabase Keys (CRITICAL)

Go to: https://app.supabase.com/project/hadssmwwclzxfujrpatd/settings/api

Get the correct keys and update `.env` files.

### 2. Setup Database

Follow: `SUPABASE_SETUP.md`

This creates the tables needed for the system to work.

### 3. Create PSD Template

Follow: `Card_Generator/README.md`

Without this, the Photoshop automation can't work.

---

**Status:** Environment files created, but keys need verification. Continue with Supabase database setup next.
