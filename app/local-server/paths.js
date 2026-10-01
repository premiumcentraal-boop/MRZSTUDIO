/**
 * Shared filesystem layout for the local (no-Supabase) product tree.
 * STUDIO_ROOT defaults to C:\Users\Agent\MRZ-Studio-Local
 */
const fs = require("fs");
const path = require("path");
const { write: atomicWriteJson } = require("../../scripts/atomic-json.cjs");

const STUDIO_ROOT = path.resolve(
  process.env.MRZ_STUDIO_ROOT || path.join(__dirname, "..", ".."),
);

const PATHS = {
  root: STUDIO_ROOT,
  app: path.join(STUDIO_ROOT, "app"),
  queue: path.join(STUDIO_ROOT, "queue"),
  incoming: path.join(STUDIO_ROOT, "queue", "incoming"),
  processing: path.join(STUDIO_ROOT, "queue", "processing"),
  done: path.join(STUDIO_ROOT, "queue", "done"),
  failed: path.join(STUDIO_ROOT, "queue", "failed"),
  output: path.join(STUDIO_ROOT, "output"),
  logs: path.join(STUDIO_ROOT, "logs"),
  control: path.join(STUDIO_ROOT, "control"),
  heartbeat: path.join(STUDIO_ROOT, "control", "heartbeat.json"),
  state: path.join(STUDIO_ROOT, "control", "state.json"),
  photoshopPathFile: path.join(STUDIO_ROOT, "control", "photoshop-path.txt"),
  workerBase: path.join(STUDIO_ROOT, "app", "worker", "local-worker"),
  workerScriptsSrc: path.join(STUDIO_ROOT, "app", "worker", "scripts"),
  workerJobAdapter: path.join(STUDIO_ROOT, "app", "worker", "job-adapter.js"),
};

PATHS.workerCurrentJob = path.join(PATHS.workerBase, "current-job");
PATHS.workerTemplates = path.join(PATHS.workerBase, "templates");
PATHS.workerScripts = path.join(PATHS.workerBase, "scripts");
PATHS.workerOutput = path.join(PATHS.workerBase, "output");
PATHS.workerLogs = path.join(PATHS.workerBase, "logs");

const QUEUE_STAGES = ["incoming", "processing", "done", "failed"];

function ensureLayout() {
  const dirs = [
    PATHS.incoming,
    PATHS.processing,
    PATHS.done,
    PATHS.failed,
    PATHS.output,
    PATHS.logs,
    PATHS.control,
    PATHS.workerCurrentJob,
    PATHS.workerTemplates,
    PATHS.workerScripts,
    PATHS.workerOutput,
    PATHS.workerLogs,
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function jobDir(stage, jobId) {
  return path.join(PATHS[stage], jobId);
}

function jobJsonPath(stage, jobId) {
  return path.join(jobDir(stage, jobId), "job.json");
}

function findJobStage(jobId) {
  for (const stage of QUEUE_STAGES) {
    const jsonPath = jobJsonPath(stage, jobId);
    if (fs.existsSync(jsonPath)) return stage;
  }
  return null;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  atomicWriteJson(filePath, value);
}

function appendLog(name, line) {
  ensureLayout();
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}\n`;
  fs.appendFileSync(path.join(PATHS.logs, name), text, "utf8");
}

function isDryRun() {
  const v = String(process.env.LOCAL_DRY_RUN || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function apiPort() {
  const n = parseInt(process.env.LOCAL_API_PORT || "8787", 10);
  return Number.isFinite(n) && n > 0 ? n : 8787;
}

module.exports = {
  PATHS,
  QUEUE_STAGES,
  ensureLayout,
  jobDir,
  jobJsonPath,
  findJobStage,
  readJson,
  writeJson,
  appendLog,
  isDryRun,
  apiPort,
};
