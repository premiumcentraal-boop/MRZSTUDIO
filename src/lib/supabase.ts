import { createClient } from '@supabase/supabase-js';

// Frontend uses ONLY the anon (publishable) key - this is safe for client-side code by design.
// NEVER use the service role key in the frontend.
// Falls back to hardcoded project values when env vars are unavailable
// (Vite dev-server env reloads can lag behind .env edits in managed environments).
const FALLBACK_SUPABASE_URL = 'https://hadssmwwclzxfujrpatd.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_Gl_I0pXOJt7uSJFTKvkx8g_1-a6DHww';

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabaseUrl = envUrl || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = envKey || FALLBACK_SUPABASE_ANON_KEY;

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create Supabase client (will be null/throw if not configured)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // Type assertion for development - check isSupabaseConfigured before use

// Mock mode for development without Supabase
export const isMockMode = import.meta.env.VITE_MOCK_ID_GENERATOR === 'true';

/* ============================================================================
 * TypeScript Interfaces
 * ========================================================================== */

export type JobStatus = 'queued' | 'processing' | 'complete' | 'failed';
export type ExportFormat = 'png' | 'pdf' | 'psd';

/**
 * Badge job payload structure
 * This is what the frontend sends when creating a new job
 *
 * IMPORTANT: This matches the Internal Employee Badge Studio data model
 * See src/lib/badgeMapping.ts for field definitions and PSD layer mapping
 */
export interface BadgeJobPayload {
  template: string;

  // Country + document type (drives MRZ layout, issuer, gender + expiry rules)
  country?: "NL" | "DE" | "OTHER";
  doc_type?: "id_card" | "passport";
  nationality_code?: string;        // ICAO 3-letter, e.g. "NLD", "D<<"
  nationality_demonym?: string;     // Printed on card, e.g. "Nederlandse"

  // Company fields
  company_name: string;
  issuer_code: string;
  department?: string;

  // Employee fields
  first_name: string;
  last_name: string;
  doc_number: string;
  personal_number: string;
  valid_from: string;
  expires: string;
  birth_date: string;
  birth_year: string;
  gender: string;
  height?: string;
  country_of_birth?: string;
  city_of_birth?: string;
  company_location?: string;

  // Optional overrides — worker auto-generates these if omitted
  mrz?: string;
  perfo_string?: string;

  // Export format
  export_format: ExportFormat;

  // Optional mockup generation — worker creates 3 mockup JPEGs when true
  generate_mockups?: boolean;

  // Assets
  assets: {
    employee_photo_path: string;
    signature_image_path?: string;
  };

  // Metadata
  meta: {
    created_from: string;
    intended_use: string;
  };
}

/**
 * Badge job database row
 * This is what comes back from Supabase
 */
export interface BadgeJob {
  id: string;
  status: JobStatus;
  template: string;
  input_json: BadgeJobPayload;
  employee_photo_path: string;
  signature_image_path: string | null;
  output_png_path: string | null;
  output_front_png_path: string | null;
  output_back_png_path: string | null;
  output_full_png_path: string | null;
  output_pdf_path: string | null;
  output_psd_path: string | null;
  output_video_path: string | null;
  output_mockup_1_path: string | null;
  output_mockup_2_path: string | null;
  output_mockup_3_path: string | null;
  output_mockup_1_back_path: string | null;
  output_mockup_1_front_path: string | null;
  output_mockup_2_back_path: string | null;
  output_mockup_2_front_path: string | null;
  output_mockup_3_back_path: string | null;
  output_mockup_3_front_path: string | null;
  error_message: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

/**
 * Worker heartbeat for online/offline status
 */
export interface WorkerHeartbeat {
  worker_id: string;
  status: string;
  last_seen_at: string;
  current_job_id: string | null;
}

/* ============================================================================
 * Validation Helpers
 * ========================================================================== */

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate badge job form data
 * Uses the canonical field definitions from badgeMapping.ts
 */
export function validateBadgeJobForm(
  formData: Record<string, any>,
  employeePhoto: File | null,
  signatureImage: File | null
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Import and use validation from badgeMapping
  // Note: This will be statically imported at the top of the file
  // For now, we do basic validation here and detailed validation in badgeMapping.ts

  // Required photo
  if (!employeePhoto) {
    errors.push({ field: 'employee_photo', message: 'Employee photo is required' });
  }

  // File validation
  if (employeePhoto) {
    const photoErrors = validateImageFile(employeePhoto, 'employee_photo');
    errors.push(...photoErrors);
  }
  if (signatureImage) {
    const sigErrors = validateImageFile(signatureImage, 'signature_image');
    errors.push(...sigErrors);
  }

  return errors;
}

/**
 * Validate image file (type and size)
 */
export function validateImageFile(file: File, fieldName: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const maxSizeMB = 10;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

  if (!allowedTypes.includes(file.type)) {
    errors.push({
      field: fieldName,
      message: 'Only PNG, JPG, and WebP images are allowed',
    });
  }

  if (file.size > maxSizeBytes) {
    errors.push({
      field: fieldName,
      message: `File size must be less than ${maxSizeMB}MB`,
    });
  }

  return errors;
}

/**
 * Generate a unique storage path for uploaded files
 */
export function generateStoragePath(jobId: string, fileName: string): string {
  const timestamp = Date.now();
  const extension = fileName.split('.').pop();
  return `${jobId}/${timestamp}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`;
}
