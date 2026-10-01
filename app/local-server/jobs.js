/**
 * Filesystem job store. job.json lives in queue\<stage>\<id>\.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  PATHS,
  QUEUE_STAGES,
  ensureLayout,
  jobDir,
  jobJsonPath,
  findJobStage,
  readJson,
  writeJson,
} = require("./paths");

function nowIso() {
  return new Date().toISOString();
}

function newJobId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
}

function emptyOutputs() {
  return {
    output_png_path: null,
    output_front_png_path: null,
    output_back_png_path: null,
    output_full_png_path: null,
    output_pdf_path: null,
    output_psd_path: null,
    output_video_path: null,
    output_mockup_1_path: null,
    output_mockup_2_path: null,
    output_mockup_3_path: null,
    output_mockup_1_back_path: null,
    output_mockup_1_front_path: null,
    output_mockup_2_back_path: null,
    output_mockup_2_front_path: null,
    output_mockup_3_back_path: null,
    output_mockup_3_front_path: null,
  };
}

function createJobRecord({ payload, photoName, signatureName }) {
  const id = newJobId();
  const created = nowIso();
  return {
    id,
    status: "queued",
    template: payload.template || "EmployeeID.psd",
    input_json: payload,
    employee_photo_path: photoName,
    signature_image_path: signatureName || null,
    ...emptyOutputs(),
    error_message: null,
    worker_id: null,
    created_at: created,
    updated_at: created,
    started_at: null,
    completed_at: null,
  };
}

function saveJob(stage, job) {
  ensureLayout();
  const dir = jobDir(stage, job.id);
  fs.mkdirSync(dir, { recursive: true });
  writeJson(path.join(dir, "job.json"), job);
}

function loadJob(jobId) {
  const stage = findJobStage(jobId);
  if (!stage) return null;
  const job = readJson(jobJsonPath(stage, jobId), null);
  if (!job) return null;
  return { stage, job, dir: jobDir(stage, job.id) };
}

function listJobs(limit = 25) {
  ensureLayout();
  const rows = [];
  for (const stage of QUEUE_STAGES) {
    const stageDir = PATHS[stage];
    if (!fs.existsSync(stageDir)) continue;
    for (const name of fs.readdirSync(stageDir)) {
      const jsonPath = jobJsonPath(stage, name);
      if (!fs.existsSync(jsonPath)) continue;
      const job = readJson(jsonPath, null);
      if (job) rows.push(job);
    }
  }
  rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  return rows.slice(0, limit);
}

function listIncomingJobIds() {
  ensureLayout();
  if (!fs.existsSync(PATHS.incoming)) return [];
  return fs
    .readdirSync(PATHS.incoming)
    .filter((name) => fs.existsSync(jobJsonPath("incoming", name)));
}

function moveJobFolder(jobId, fromStage, toStage) {
  const from = jobDir(fromStage, jobId);
  const to = jobDir(toStage, jobId);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) {
    fs.rmSync(to, { recursive: true, force: true });
  }
  fs.renameSync(from, to);
  return to;
}

function safeFileName(original, fallback) {
  const base = path.basename(String(original || fallback || "file.bin"));
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || fallback || "file.bin";
}

function extFromName(name, mime) {
  const ext = path.extname(String(name || "")).toLowerCase();
  if (ext) return ext;
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/png") return ".png";
  return ".bin";
}

function publicFileUrl(jobId, fileName) {
  return `/api/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileName)}`;
}

/**
 * Map stored filenames / relative output names to API URLs the UI can fetch.
 */
function toPublicJob(job) {
  if (!job) return null;
  const id = job.id;
  const mapped = { ...job };
  const keys = Object.keys(emptyOutputs());
  for (const key of keys) {
    const value = job[key];
    if (!value) {
      mapped[key] = null;
      continue;
    }
    if (String(value).startsWith("/api/") || String(value).startsWith("http")) {
      mapped[key] = value;
      continue;
    }
    mapped[key] = publicFileUrl(id, path.basename(String(value)));
  }
  return mapped;
}

function resolveOutputFile(jobId, fileName) {
  const safe = path.basename(fileName);
  if (!safe || safe !== fileName.replace(/\\/g, "/").split("/").pop()) {
    return null;
  }
  const candidates = [
    path.join(PATHS.output, jobId, safe),
    path.join(PATHS.done, jobId, safe),
    path.join(PATHS.processing, jobId, safe),
    path.join(PATHS.failed, jobId, safe),
    path.join(PATHS.incoming, jobId, safe),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".psd") return "application/octet-stream";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".json") return "application/json";
  if (ext === ".txt") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

module.exports = {
  nowIso,
  newJobId,
  emptyOutputs,
  createJobRecord,
  saveJob,
  loadJob,
  listJobs,
  listIncomingJobIds,
  moveJobFolder,
  safeFileName,
  extFromName,
  publicFileUrl,
  toPublicJob,
  resolveOutputFile,
  mimeFor,
};
