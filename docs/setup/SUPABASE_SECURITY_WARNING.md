# ⚠️ CRITICAL SECURITY WARNING

## Issue Detected: Using Same Key for Anon and Service Role

Your current configuration appears to be using the same key (`<SUPABASE_SERVICE_ROLE_KEY>`) for both:
- Frontend ANON key
- Worker SERVICE key

**This is a major security vulnerability.**

## Why This is Dangerous

### The Service Role Key:
- ✅ Should ONLY be used by the worker (server-side)
- ✅ Has FULL database access (bypasses RLS policies)
- ✅ Can read, write, delete ANY data
- ❌ Should NEVER be exposed to the frontend
- ❌ Should NEVER be committed to git
- ❌ Should NEVER be shared publicly

### The Anon Key:
- ✅ Should be used by the frontend (client-side)
- ✅ Is restricted by RLS (Row Level Security) policies
- ✅ Can be safely exposed in browser code
- ✅ Can be committed to git (.env should still be gitignored)
- ✅ Has limited permissions

## How to Get the Correct Keys

### Step 1: Go to Supabase Dashboard

1. Open: https://app.supabase.com/project/hadssmwwclzxfujrpatd
2. Click "Settings" in the sidebar
3. Click "API" under Project Settings

### Step 2: Find the Correct Keys

You should see **two different keys**:

```
Project URL
https://hadssmwwclzxfujrpatd.supabase.co

anon public
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
^ This is the ANON key - use in frontend .env

service_role secret  
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...
^ This is the SERVICE ROLE key - use in worker .env
```

### Step 3: Update Your Environment Files

**Frontend (/.env):**
```env
VITE_SUPABASE_URL=https://hadssmwwclzxfujrpatd.supabase.co
VITE_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY> (anon public key)
VITE_MOCK_ID_GENERATOR=false
```

**Worker (/worker/.env):**
```env
SUPABASE_URL=https://hadssmwwclzxfujrpatd.supabase.co
SUPABASE_SERVICE_KEY=<SUPABASE_SERVICE_ROLE_KEY> (service_role secret key)
WORKER_ID=photoshop-worker-01
POLL_INTERVAL_MS=3000
HEARTBEAT_INTERVAL_MS=10000
```

## What the Keys Look Like

Both keys are JWT tokens that look like:

```
<SUPABASE_JWT_KEY>...
```

They start with `eyJ` and contain dots (`.`) separating three parts.

**They do NOT look like:** `sb_secret_...`

## Current Status of Your Configuration

I've created both `.env` files with the credentials you provided, but you should:

1. ✅ Go to Supabase Dashboard
2. ✅ Get the correct `anon public` key
3. ✅ Get the correct `service_role secret` key
4. ✅ Update `/.env` with the anon key
5. ✅ Update `/worker/.env` with the service role key
6. ✅ Delete this warning file after fixing

## Security Best Practices

### ✅ DO:
- Use different keys for frontend and worker
- Keep service role key secret
- Add `.env` to `.gitignore` (already done)
- Use environment variables, not hardcoded keys
- Rotate keys if they're ever exposed

### ❌ DON'T:
- Use service role key in frontend
- Commit `.env` files to git
- Share service role key publicly
- Use the same key for both anon and service role
- Hardcode keys in source code

## How to Verify You Have the Right Keys

### Test 1: Check Key Format
Both keys should:
- Start with `eyJ`
- Be very long (200+ characters)
- Contain exactly 2 dots (`.`)
- Look like JWT tokens

### Test 2: Decode the Keys
You can decode JWT tokens at https://jwt.io

**Anon key should show:**
```json
{
  "role": "anon"
}
```

**Service role key should show:**
```json
{
  "role": "service_role"
}
```

### Test 3: Frontend Should Work
If you're using the anon key correctly:
- ✅ Frontend can read data (with RLS policies)
- ❌ Frontend cannot bypass RLS policies
- ❌ Frontend cannot access service_role functions

### Test 4: Worker Should Work  
If you're using the service role key correctly:
- ✅ Worker can read/write all data
- ✅ Worker bypasses RLS policies
- ✅ Worker can update badge_jobs table

## What to Do Right Now

1. **Stop** if you're about to commit or deploy
2. **Go to** Supabase Dashboard → Settings → API
3. **Copy** the correct keys (they look different from `sb_secret_...`)
4. **Update** both `.env` files
5. **Test** the frontend in development
6. **Verify** the worker can connect
7. **Delete** this warning file

## Need Help?

If you can't find the keys:
1. Screenshot your Supabase Dashboard → Settings → API page
2. Look for two keys labeled "anon public" and "service_role secret"
3. They should both start with `eyJ`

The keys you provided (`sb_secret_...`) don't match the standard Supabase key format.
