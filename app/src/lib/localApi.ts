import type { BadgeJob, BadgeJobPayload, WorkerHeartbeat } from "./supabase";

export const API_BASE = ((import.meta.env.VITE_LOCAL_API_BASE as string | undefined) || "").replace(/\/$/, "");

export const isLocalMode = import.meta.env.VITE_LOCAL_MODE !== "false";

export interface LocalHealth {
  ok: boolean;
  mode: string;
  dryRun: boolean;
  port: number;
  photoshop: {
    found: boolean;
    path: string | null;
    source: string;
    invoke: string | null;
    guidance: string | null;
  };
  worker: {
    online: boolean;
    last_seen_at: string | null;
    current_job_id: string | null;
    worker_id: string | null;
    status?: string;
  };
  template: {
    expected: string;
    present: boolean;
  };
  root: string;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    throw new Error(data?.error || text || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function localHealth(): Promise<LocalHealth> {
  const res = await fetch(`${API_BASE}/api/health`);
  return parseJson<LocalHealth>(res);
}

export async function localCreateJob(
  payload: BadgeJobPayload,
  employeePhoto: File,
  signatureImage: File | null,
): Promise<BadgeJob> {
  const fd = new FormData();
  fd.append("payload", JSON.stringify(payload));
  fd.append("employee_photo", employeePhoto, employeePhoto.name);
  if (signatureImage) {
    fd.append("signature_image", signatureImage, signatureImage.name);
  }
  const res = await fetch(`${API_BASE}/api/jobs`, { method: "POST", body: fd });
  return parseJson<BadgeJob>(res);
}

export async function localGetJob(id: string): Promise<BadgeJob> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(id)}`);
  return parseJson<BadgeJob>(res);
}

export async function localListJobs(): Promise<BadgeJob[]> {
  const res = await fetch(`${API_BASE}/api/jobs`);
  const data = await parseJson<{ jobs: BadgeJob[] }>(res);
  return data.jobs || [];
}

export async function localRetryJob(id: string): Promise<BadgeJob> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });
  return parseJson<BadgeJob>(res);
}

export function localFileUrl(jobId: string, fileName: string): string {
  return `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileName)}`;
}

export function heartbeatFromHealth(health: LocalHealth): WorkerHeartbeat | null {
  const w = health.worker;
  if (!w || !w.last_seen_at) return null;
  return {
    worker_id: w.worker_id || "photoshop-worker-local",
    status: w.online ? "online" : "offline",
    last_seen_at: w.last_seen_at,
    current_job_id: w.current_job_id,
  };
}
