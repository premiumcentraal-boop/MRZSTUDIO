# ID Generator Build Instructions - Figma + Supabase + Local Photoshop Worker

This document describes how to build a new third page under **Custom Tools** called **ID Generator**. The page is intended for a legitimate internal company badge workflow. It connects a Figma-designed web interface to Supabase, a local Windows worker, and Photoshop automation.

## System Architecture

Frontend (Figma-designed web page) → Supabase (job queue + storage) → Local Windows worker → Photoshop JSX script → Upload results → Display to user

## Key Requirements

### Page Structure
- Route: `/custom-tools/id-generator`
- Title: "ID Generator"
- Subtitle: "Create internal employee badge outputs from the EmployeeID.psd Photoshop template."
- Notice: "For internal company badge use only. This tool does not create official identity documents."

### Form Fields
- Template (select, default: EmployeeID.psd)
- Employee Name (text, required)
- Employee ID (text, required)
- Department (text, optional)
- Role (text, optional)
- Valid From (date, optional)
- Valid Until (date, optional)
- Employee Photo (image upload, required)
- Signature Image (image upload, optional)
- Export Format (select, default: PNG)

### Layout
- Left Panel: Input Form
- Right Panel: Preview + Job Status
- Bottom Panel: Job History

### Job Flow
1. User fills form
2. Frontend uploads images to Supabase Storage (badge-inputs bucket)
3. Frontend creates job in badge_jobs table with status 'queued'
4. Frontend polls job status every 3 seconds
5. Local worker claims job (status → 'processing')
6. Worker downloads assets, runs Photoshop JSX, uploads result
7. Worker updates job status to 'complete' or 'failed'
8. Frontend displays result or error

### Supabase Schema

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

### Storage Buckets
- badge-inputs (uploaded photos and signatures)
- badge-outputs (final PNG/PDF/PSD results)
- badge-templates (optional)

### Job Statuses
- queued: Waiting for worker
- processing: Photoshop is generating
- complete: Output ready
- failed: Error occurred

See the full HTML specification file for complete implementation details.
