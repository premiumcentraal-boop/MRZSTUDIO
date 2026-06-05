# Supabase Setup for ID Generator

This guide explains how to set up Supabase for the ID Generator feature.

## Prerequisites

1. Create a Supabase account at https://supabase.com
2. Create a new project

## Environment Variables

### Frontend Environment Variables

Create a `.env` file in the root directory with:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_MOCK_ID_GENERATOR=false
```

**Important Security Notes:**
- ✅ **VITE_SUPABASE_ANON_KEY** - Safe to use in frontend. This is the anonymous/public key.
- ❌ **Never use the service role key in frontend code** - It bypasses all security rules.
- 🔒 The anon key respects Row Level Security (RLS) policies you define.

You can find these values in your Supabase project settings under Settings > API.

### Local Worker Environment Variables

The local worker runs on your Windows machine and needs different credentials:

```env
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_KEY=your-service-role-key
WORKER_ID=photoshop-worker-01
```

**Important Security Notes:**
- ⚠️ **SUPABASE_SERVICE_KEY** - ONLY for the local worker. Never commit to git. Never use in frontend.
- 🔐 This key bypasses RLS and has full database access.
- 📁 Store in worker/.env and add worker/.env to .gitignore
- 🚫 Never expose this key to the web application or client-side code.

## Database Setup

### 1. Create the badge_jobs table

Run this SQL in the Supabase SQL Editor:

```sql
create table if not exists badge_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued',
  template text not null default 'EmployeeID.psd',
  input_json jsonb not null,
  employee_photo_path text,
  signature_image_path text,
  output_png_path text,
  output_pdf_path text,
  output_psd_path text,
  error_message text,
  worker_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
```

### 2. Create the worker_heartbeat table

```sql
create table if not exists worker_heartbeat (
  worker_id text primary key,
  status text not null,
  last_seen_at timestamptz not null default now(),
  current_job_id uuid
);
```

### 3. Enable Row Level Security (RLS)

Enable RLS on both tables to ensure security:

```sql
-- Enable RLS on badge_jobs
alter table badge_jobs enable row level security;

-- Enable RLS on worker_heartbeat
alter table worker_heartbeat enable row level security;
```

### 4. Create RLS Policies for badge_jobs

```sql
-- Policy 1: Anyone can create jobs
-- This allows the frontend (using anon key) to submit new badge jobs
create policy "Allow job creation"
on badge_jobs for insert
to anon, authenticated
with check (true);

-- Policy 2: Anyone can read all jobs
-- In production, you may want to restrict this to authenticated users only
-- or add user_id filtering if you implement authentication
create policy "Allow read all jobs"
on badge_jobs for select
to anon, authenticated
using (true);

-- Policy 3: Only service role can update jobs
-- This ensures only the worker (using service key) can update job status
-- The frontend cannot modify jobs after creation
create policy "Service role can update jobs"
on badge_jobs for update
to service_role
using (true);

-- Alternative: If you want to allow users to delete their own pending jobs
-- create policy "Users can delete queued jobs"
-- on badge_jobs for delete
-- to anon, authenticated
-- using (status = 'queued');
```

### 5. Create RLS Policies for worker_heartbeat

```sql
-- Policy 1: Anyone can read worker status
-- This allows the frontend to display worker online/offline status
create policy "Allow read worker heartbeat"
on worker_heartbeat for select
to anon, authenticated
using (true);

-- Policy 2: Only service role can update heartbeat
-- This ensures only the worker can update its own heartbeat
create policy "Service role can manage heartbeat"
on worker_heartbeat for all
to service_role
using (true);
```

## Storage Setup

### Create Storage Buckets

1. Go to Storage in your Supabase dashboard
2. Create three buckets:
   - `badge-inputs` - For uploaded photos and signatures
   - `badge-outputs` - For final generated badges
   - `badge-templates` - Optional, for template backups

### Configure Bucket Policies

**Important**: In Supabase Storage, create each bucket as **private** (not public) for better security.

For `badge-inputs`:
```sql
-- Allow anyone to upload (anon users can submit badge jobs)
create policy "Allow uploads to badge-inputs"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'badge-inputs');

-- Allow anyone to read from badge-inputs
-- The worker needs to download these files
create policy "Allow read from badge-inputs"
on storage.objects for select
to anon, authenticated, service_role
using (bucket_id = 'badge-inputs');

-- Only service role (worker) can delete old files
create policy "Service role can delete badge-inputs"
on storage.objects for delete
to service_role
using (bucket_id = 'badge-inputs');
```

For `badge-outputs`:
```sql
-- Only service role (worker) can upload results
create policy "Service role can upload badge-outputs"
on storage.objects for insert
to service_role
with check (bucket_id = 'badge-outputs');

-- Anyone can read outputs (to download completed badges)
create policy "Allow read from badge-outputs"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'badge-outputs');
```

For `badge-templates` (optional):
```sql
-- Only service role can manage templates
create policy "Service role can manage badge-templates"
on storage.objects for all
to service_role
using (bucket_id = 'badge-templates');
```

**Note on Signed URLs**: Even though we allow read access via policies, it's still a best practice to use signed URLs with short expiration times (60 seconds) when downloading results. This prevents direct URL sharing and gives you control over access duration.

## Local Worker Setup

The local worker is a separate Node.js application that runs on your Windows machine with Photoshop installed.

### Worker Responsibilities

The worker must perform these exact steps in order:

1. **Poll for jobs** - Query `badge_jobs` table for rows where `status = 'queued'`, ordered by `created_at ASC`
2. **Claim job** - Update the first queued job to `status = 'processing'` and set `worker_id`, `started_at`
3. **Download inputs** - Download files from `badge-inputs` bucket:
   - Employee photo from `employee_photo_path`
   - Signature image from `signature_image_path` (if present)
4. **Prepare local files** - Create job folder structure:
   ```
   C:/EmployeeBadgeAutomation/jobs/{job_id}/
   ├── input.json          # Job payload
   ├── photo.jpg           # Downloaded employee photo
   └── signature.png       # Downloaded signature (if provided)
   ```
5. **Run Photoshop JSX** - Execute `run_employeeid_job.jsx` with job_id parameter
6. **Upload results** - Upload generated files to `badge-outputs` bucket:
   - PNG: `{job_id}/result.png`
   - PDF: `{job_id}/result.pdf` (if requested)
   - PSD: `{job_id}/result.psd` (if requested)
7. **Update job status** - Set `status = 'complete'`, `completed_at = now()`, and populate output paths:
   - `output_png_path`
   - `output_pdf_path`
   - `output_psd_path`
8. **Update heartbeat** - Every 10 seconds, upsert to `worker_heartbeat`:
   - `worker_id`
   - `status = 'online'`
   - `last_seen_at = now()`
   - `current_job_id` (if processing)

### Error Handling

If any step fails:
- Set `status = 'failed'`
- Set `error_message` with clear error description
- Set `completed_at = now()`
- Log error details locally
- Continue polling for next job

### Worker Folder Structure

```
C:/EmployeeBadgeAutomation/
├── worker.js                    # Main worker loop
├── run_employeeid_job.jsx       # Photoshop automation script
├── .env                         # Worker environment variables (NEVER commit)
├── templates/
│   └── EmployeeID.psd           # Master template file
├── fonts/
│   ├── RequiredFont-Regular.otf
│   └── RequiredFont-Bold.otf
├── jobs/
│   └── {job_id}/                # Created per job, cleaned after
│       ├── input.json
│       ├── photo.jpg
│       └── signature.png
└── output/
    └── {job_id}/                # Created per job, cleaned after upload
        ├── result.png
        ├── result.pdf
        └── result.psd
```

### Expected File Naming

When downloading from Supabase Storage:
- Photo: Save as `jobs/{job_id}/photo.{original_extension}`
- Signature: Save as `jobs/{job_id}/signature.{original_extension}`

When uploading to Supabase Storage:
- PNG: Upload to `{job_id}/result.png` → Store path in `output_png_path`
- PDF: Upload to `{job_id}/result.pdf` → Store path in `output_pdf_path`
- PSD: Upload to `{job_id}/result.psd` → Store path in `output_psd_path`

### Worker Environment Variables

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
WORKER_ID=photoshop-worker-01
POLL_INTERVAL_MS=3000
HEARTBEAT_INTERVAL_MS=10000
```

⚠️ **Security Warning**: 
- The service role key has FULL database access and bypasses all RLS policies
- NEVER commit this key to git
- NEVER use this key in the frontend
- Add `.env` to `.gitignore`
- Only use this key in the local worker on your secure Windows machine

## Testing

1. Start the frontend: `pnpm build` (or use the dev server)
2. Navigate to Custom Tools → ID Generator
3. Fill in the form and upload a photo
4. Click "Generate Badge"
5. Check the job status

The job will remain in "queued" status until the local worker picks it up.

## Local Worker Implementation

The local worker needs to be built separately. Reference implementation:

```javascript
// worker.js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function processJob(job) {
  // 1. Download assets from badge-inputs
  // 2. Run Photoshop JSX script
  // 3. Upload results to badge-outputs
  // 4. Update job status to 'complete' or 'failed'
}

async function pollJobs() {
  while (true) {
    const { data } = await supabase
      .from('badge_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (data && data.length > 0) {
      const job = data[0];
      await supabase
        .from('badge_jobs')
        .update({ status: 'processing' })
        .eq('id', job.id);

      try {
        await processJob(job);
      } catch (error) {
        await supabase
          .from('badge_jobs')
          .update({ 
            status: 'failed', 
            error_message: error.message 
          })
          .eq('id', job.id);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

pollJobs();
```

## Security Best Practices

1. **Row Level Security (RLS)**: Enable RLS on all tables
2. **Service Role Key**: Keep it secure, never commit to git
3. **Signed URLs**: Use signed URLs for storage access
4. **Input Validation**: Validate all user inputs on the worker
5. **Rate Limiting**: Implement rate limits for job creation

## Troubleshooting

- **Worker shows offline**: Check if the worker_heartbeat table is being updated
- **Jobs stuck in queued**: Ensure the local worker is running
- **Upload fails**: Check storage bucket policies
- **Can't download results**: Verify signed URL generation works

## Architecture Diagram

```
Frontend (React)
    ↓
Supabase (Database + Storage)
    ↓
Local Worker (Node.js)
    ↓
Photoshop (JSX Automation)
    ↓
Upload Results → Supabase
    ↓
Frontend displays result
```
