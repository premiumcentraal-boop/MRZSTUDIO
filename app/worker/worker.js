/**
 * Local filesystem badge worker (no Supabase).
 *
 * Watches queue\incoming, claims into queue\processing, runs Photoshop
 * (or LOCAL_DRY_RUN placeholders), writes output\<jobId>\, then marks
 * queue\done or queue\failed.
 */
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { spawn } = require("child_process");
const { convertJobToPhotoshopInput, validatePhotoshopInput } = require("./job-adapter");
const {
  PATHS,
  ensureLayout,
  isDryRun,
  appendLog,
  writeJson,
  readJson,
} = require("../local-server/paths");
const { detectPhotoshop, photoshopGuidance, invokeCommand } = require("../local-server/photoshop");
const { dryRunBadgePng } = require("../local-server/png");
const {
  loadJob,
  listIncomingJobIds,
  moveJobFolder,
  saveJob,
  nowIso,
  emptyOutputs,
} = require("../local-server/jobs");

const WORKER_ID = process.env.WORKER_ID || "photoshop-worker-local";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 2000;
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 5000;
const PHOTOSHOP_TIMEOUT_MS = parseInt(process.env.PHOTOSHOP_TIMEOUT_MS, 10) || 180000;

let isProcessing = false;
let currentJobId = null;
let heartbeatTimer = null;
let stopRequested = false;

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  console.log(text);
  try {
    appendLog("worker.log", line);
  } catch {
    // ignore
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function writeHeartbeat(extra = {}) {
  ensureLayout();
  writeJson(PATHS.heartbeat, {
    worker_id: WORKER_ID,
    status: extra.status || (stopRequested ? "stopping" : "online"),
    pid: process.pid,
    instance: process.env.MRZ_INSTANCE_ID || null,
    last_seen_at: nowIso(),
    current_job_id: currentJobId,
    dry_run: isDryRun(),
    ...extra,
  });
}

function copyDirContents(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
      copyDirContents(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function syncWorkerWorkspace() {
  ensureLayout();
  copyDirContents(PATHS.workerScriptsSrc, PATHS.workerScripts);

  const extraTemplates = [
    path.join(PATHS.root, "templates"),
    path.join(PATHS.app, "worker", "templates"),
  ];
  for (const dir of extraTemplates) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!/\.psd$/i.test(name)) continue;
      const dest = path.join(PATHS.workerTemplates, name);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(path.join(dir, name), dest);
      }
    }
  }
}

async function cleanCurrentJob() {
  const dir = PATHS.workerCurrentJob;
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, name), { recursive: true, force: true });
  }
}

function updateJobFile(stage, job, patch) {
  const next = { ...job, ...patch, updated_at: nowIso() };
  saveJob(stage, next);
  return next;
}

async function claimNextJob() {
  const ids = listIncomingJobIds();
  if (!ids.length) return null;
  ids.sort();
  const jobId = ids[0];
  const found = loadJob(jobId);
  if (!found || found.stage !== "incoming") return null;

  moveJobFolder(jobId, "incoming", "processing");
  const claimed = loadJob(jobId);
  if (!claimed) return null;
  const job = updateJobFile("processing", claimed.job, {
    status: "processing",
    worker_id: WORKER_ID,
    started_at: nowIso(),
  });
  return { ...claimed, job, stage: "processing", dir: path.join(PATHS.processing, jobId) };
}

function expectedOutputNames(job) {
  const format = String(job.input_json?.export_format || "png").toLowerCase();
  if (format === "all") return ["result.png", "result.pdf", "result.psd"];
  if (format === "pdf") return ["result.pdf"];
  if (format === "psd") return ["result.psd"];
  return ["result.png"];
}

function collectOutputs(jobId) {
  const dirs = [
    path.join(PATHS.output, jobId),
    path.join(PATHS.workerOutput, jobId),
  ];
  const files = {};
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isFile()) files[name.toLowerCase()] = { name, full };
    }
  }
  return files;
}

function applyOutputPaths(job, files) {
  const outputs = emptyOutputs();
  const pick = (...names) => {
    for (const n of names) {
      const hit = files[n.toLowerCase()];
      if (hit) return hit.name;
    }
    return null;
  };

  outputs.output_png_path = pick("result.png", "result-full.png");
  outputs.output_full_png_path = pick("result.png", "result-full.png");
  outputs.output_front_png_path = pick("result-front.png");
  outputs.output_back_png_path = pick("result-back.png");
  outputs.output_pdf_path = pick("result.pdf");
  outputs.output_psd_path = pick("result.psd");
  outputs.output_video_path = pick("result.mp4", "mockup.mp4");

  for (const n of [1, 2, 3]) {
    outputs[`output_mockup_${n}_path`] = pick(`mockup-${n}.jpg`, `mockup-${n}.png`, `mockup-${n}-front.jpg`);
    outputs[`output_mockup_${n}_front_path`] = pick(`mockup-${n}-front.jpg`, `mockup-${n}-front.png`, `mockup-${n}.jpg`);
    outputs[`output_mockup_${n}_back_path`] = pick(`mockup-${n}-back.jpg`, `mockup-${n}-back.png`);
  }

  return { ...job, ...outputs };
}

async function copyTreeFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

async function publishOutputs(jobId) {
  const src = path.join(PATHS.workerOutput, jobId);
  const dest = path.join(PATHS.output, jobId);
  fs.mkdirSync(dest, { recursive: true });
  if (!fs.existsSync(src)) return;
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    if (!fs.statSync(from).isFile()) continue;
    await copyTreeFile(from, path.join(dest, name));
  }
}

async function writeDryRunOutputs(job) {
  const dest = path.join(PATHS.output, job.id);
  const workerDest = path.join(PATHS.workerOutput, job.id);
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(workerDest, { recursive: true });

  const format = String(job.input_json?.export_format || "png").toLowerCase();
  const label = `${job.input_json?.first_name || ""} ${job.input_json?.last_name || ""}`.trim();
  const subtitle = job.id;

  const front = dryRunBadgePng({ label, subtitle, side: "FRONT" });
  const back = dryRunBadgePng({ label, subtitle, side: "BACK" });

  if (format === "png" || format === "all") {
    fs.writeFileSync(path.join(dest, "result.png"), front);
    fs.writeFileSync(path.join(dest, "result-front.png"), front);
    fs.writeFileSync(path.join(dest, "result-back.png"), back);
    fs.writeFileSync(path.join(workerDest, "result.png"), front);
  }
  if (format === "pdf" || format === "all") {
    // Placeholder bytes so the UI can offer a download in dry-run.
    const note = Buffer.from(`%PDF-1.1\n% LOCAL_DRY_RUN placeholder for job ${job.id}\n`);
    fs.writeFileSync(path.join(dest, "result.pdf"), note);
  }
  if (format === "psd" || format === "all") {
    fs.writeFileSync(path.join(dest, "result.psd"), Buffer.from(`LOCAL_DRY_RUN PSD placeholder ${job.id}`));
  }
  if (job.input_json?.generate_mockups) {
    for (const n of [1, 2, 3]) {
      fs.writeFileSync(path.join(dest, `mockup-${n}-front.jpg`), front);
      fs.writeFileSync(path.join(dest, `mockup-${n}-back.jpg`), back);
    }
  }
}

async function prepareInputJson(job, jobFolder) {
  await cleanCurrentJob();

  const photoSrc = job.employee_photo_path
    ? path.join(jobFolder, path.basename(job.employee_photo_path))
    : "";
  const sigSrc = job.signature_image_path
    ? path.join(jobFolder, path.basename(job.signature_image_path))
    : "";

  let photoPath = "";
  let signaturePath = "";

  if (photoSrc && fs.existsSync(photoSrc)) {
    photoPath = path.join(PATHS.workerCurrentJob, path.basename(photoSrc));
    fs.copyFileSync(photoSrc, photoPath);
  }
  if (sigSrc && fs.existsSync(sigSrc)) {
    signaturePath = path.join(PATHS.workerCurrentJob, path.basename(sigSrc));
    fs.copyFileSync(sigSrc, signaturePath);
  }

  const input = convertJobToPhotoshopInput(job, photoPath, signaturePath);
  const errors = validatePhotoshopInput(input);
  if (errors.length > 0) {
    throw new Error(`Invalid Photoshop input: ${errors.join(", ")}`);
  }

  const inputJsonPath = path.join(PATHS.workerCurrentJob, "input.json");
  fs.writeFileSync(inputJsonPath, JSON.stringify(input, null, 2), "utf8");
  log(`wrote ${inputJsonPath}`);
  return input;
}

function reportErrorText(report) {
  if (!report) return "Photoshop job_report error";
  if (report.error_message) return String(report.error_message);
  const errs = report.errors;
  if (Array.isArray(errs) && errs.length) {
    return errs
      .map((e) => {
        if (typeof e === "string") return e;
        if (e && e.message) return String(e.message);
        try {
          return JSON.stringify(e);
        } catch {
          return String(e);
        }
      })
      .join("; ");
  }
  return "Photoshop job_report error";
}

function isReportSuccess(report) {
  if (!report || report.status == null) return false;
  const status = String(report.status).toLowerCase();
  return status === "success" || status === "ok" || status === "complete";
}

function isReportError(report) {
  if (!report || report.status == null) return false;
  const status = String(report.status).toLowerCase();
  return status === "error" || status === "failed";
}

function spawnPhotoshop(exe, scriptPath, opts) {
  const child = spawn(exe, [scriptPath], {
    cwd: opts.cwd,
    env: opts.env,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (d) => {
    stdout += d.toString();
    process.stdout.write(d);
  });
  child.stderr.on("data", (d) => {
    stderr += d.toString();
    process.stderr.write(d);
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill();
    } catch {
      // ignore
    }
  }, opts.timeout);

  const processPromise = new Promise((resolve, reject) => {
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Photoshop timed out after ${opts.timeout}ms`));
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });

  return {
    child,
    processPromise,
    disarmTimeout() {
      clearTimeout(timer);
    },
  };
}

function findOutputFile(jobId, ...names) {
  const files = collectOutputs(jobId);
  for (const n of names) {
    const hit = files[String(n).toLowerCase()];
    if (hit) return hit.full;
  }
  return null;
}

async function waitForOutputs(jobId, names, timeoutMs, requireAll) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const files = collectOutputs(jobId);
    const have = names.filter((n) => files[n.toLowerCase()]);
    if (have.length === names.length) return have;
    await sleep(1000);
  }
  const files = collectOutputs(jobId);
  const have = names.filter((n) => files[n.toLowerCase()]);
  if (have.length === names.length) return have;
  if (!requireAll && have.length) return have;
  throw new Error(`Timed out waiting for outputs: ${names.join(", ")}`);
}

async function waitForReportFile(reportPath, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        if (isReportSuccess(report)) {
          log(`${label} success for report ${path.basename(reportPath)} (Photoshop may still be open)`);
          return report;
        }
        if (isReportError(report)) {
          throw new Error(reportErrorText(report));
        }
      } catch (e) {
        if (e instanceof SyntaxError) {
          // JSON may be mid-write; keep polling
        } else {
          throw e;
        }
      }
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${path.basename(reportPath)} (${timeoutMs}ms)`);
}

function photoshopEnv(psPath) {
  return {
    ...process.env,
    BADGE_AUTOMATION_BASE_PATH: PATHS.workerBase,
    PHOTOSHOP_EXE: psPath,
    MRZ_STUDIO_ROOT: PATHS.root,
  };
}

async function runPhotoshopScript(ps, job, options) {
  const scriptPath = path.join(PATHS.workerScripts, options.scriptName);
  if (!(await fileExists(scriptPath))) {
    throw new Error(`Photoshop script missing: ${scriptPath}`);
  }

  const reportPath = path.join(PATHS.workerOutput, job.id, options.reportName);
  try {
    if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
  } catch {
    // ignore stale report cleanup failures
  }

  log(`Executing: ${invokeCommand(ps.path, scriptPath)}`);
  log(`BADGE_AUTOMATION_BASE_PATH=${PATHS.workerBase}`);

  const handle = spawnPhotoshop(ps.path, scriptPath, {
    cwd: PATHS.workerBase,
    env: photoshopEnv(ps.path),
    timeout: options.timeout || PHOTOSHOP_TIMEOUT_MS,
  });

  // A second Photoshop.exe often exits immediately because the JSX is handed
  // to an already-open GUI. Never treat process-exit as success; wait for the
  // report file. Still reject if the spawned process errors or is killed.
  handle.processPromise.catch((err) => {
    log(`${options.label} Photoshop process: ${err.message}`);
  });
  const processHint = handle.processPromise.then((result) => {
    if (result && result.code && result.code !== 0) {
      log(`${options.label} Photoshop process exited with code ${result.code}`);
    }
    return new Promise(() => {});
  });

  try {
    const report = await Promise.race([
      processHint,
      waitForReportFile(reportPath, options.timeout || PHOTOSHOP_TIMEOUT_MS, options.label),
    ]);
    handle.disarmTimeout();
    log(`${options.label} wait resolved via job_report`);
    return { via: "job_report", report };
  } catch (error) {
    handle.disarmTimeout();
    if (options.failLoud) throw error;
    log(`${options.label} spawn/report: ${error.message}`);
    return null;
  }
}

function writeIdcardprintInput(job, resultPngPath) {
  const outputFolder = path.join(PATHS.workerOutput, job.id);
  fs.mkdirSync(outputFolder, { recursive: true });

  const templatePath = path.join(PATHS.workerTemplates, "IDCARDPRINT.psd");
  if (!fs.existsSync(templatePath)) {
    throw new Error(
      `IDCARDPRINT template not found: ${templatePath}\nPlace IDCARDPRINT.psd in the templates folder (or set LOCAL_DRY_RUN=1).`,
    );
  }

  const workCopy = path.join(outputFolder, "IDCARDPRINT_work.psd");
  fs.copyFileSync(templatePath, workCopy);
  log(`copied IDCARDPRINT working copy to ${workCopy}`);

  const toPosix = (p) => String(p).replace(/\\/g, "/");
  const input = {
    job_id: job.id,
    result_png: toPosix(resultPngPath),
    template_path: toPosix(workCopy),
    template: "IDCARDPRINT.psd",
    output_folder: toPosix(outputFolder),
    output_front: toPosix(path.join(outputFolder, "result-front.png")),
    output_back: toPosix(path.join(outputFolder, "result-back.png")),
    keep_work_copy: false,
  };

  fs.mkdirSync(PATHS.workerCurrentJob, { recursive: true });
  const inputPath = path.join(PATHS.workerCurrentJob, "idcardprint_input.json");
  fs.writeFileSync(inputPath, JSON.stringify(input, null, 2), "utf8");
  log(`wrote ${inputPath}`);
  return input;
}

async function publishPartialFullBadge(job) {
  await publishOutputs(job.id);
  const files = collectOutputs(job.id);
  return updateJobFile("processing", applyOutputPaths(job, files), {
    status: "processing",
  });
}

function unlinkQuiet(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

async function runIdcardprintStage(ps, job, resultPngPath) {
  const names = ["result-front.png", "result-back.png", "idcardprint_report.json"];
  for (const name of names) {
    unlinkQuiet(path.join(PATHS.workerOutput, job.id, name));
    unlinkQuiet(path.join(PATHS.output, job.id, name));
  }

  writeIdcardprintInput(job, resultPngPath);
  const winner = await runPhotoshopScript(ps, job, {
    scriptName: "run_idcardprint_job.jsx",
    reportName: "idcardprint_report.json",
    label: "IDCARDPRINT",
    timeout: Math.max(PHOTOSHOP_TIMEOUT_MS, 240000),
    failLoud: true,
  });
  if (winner && winner.via === "job_report" && isReportError(winner.report)) {
    throw new Error(reportErrorText(winner.report));
  }
  await publishOutputs(job.id);
  await waitForOutputs(job.id, ["result-front.png", "result-back.png"], 45000, true);
}

async function runPhotoshop(job) {
  const ps = detectPhotoshop();
  if (!ps.found) {
    throw new Error(photoshopGuidance());
  }

  const templatePath = path.join(PATHS.workerTemplates, job.template || "EmployeeID.psd");
  if (!(await fileExists(templatePath))) {
    throw new Error(
      `Template not found: ${templatePath}\nPlace EmployeeID.psd in app\\worker\\local-worker\\templates\\ (or set LOCAL_DRY_RUN=1).`,
    );
  }

  const format = String(job.input_json?.export_format || "png").toLowerCase();
  const expected = expectedOutputNames(job);
  for (const name of expected.concat(["job_report.json"])) {
    unlinkQuiet(path.join(PATHS.workerOutput, job.id, name));
    unlinkQuiet(path.join(PATHS.output, job.id, name));
  }

  await runPhotoshopScript(ps, job, {
    scriptName: "run_employeeid_job.jsx",
    reportName: "job_report.json",
    label: "EmployeeID",
    timeout: PHOTOSHOP_TIMEOUT_MS,
    failLoud: false,
  });

  await publishOutputs(job.id);
  await waitForOutputs(job.id, expected, 45000);

  const wantsPng = format === "png" || format === "all";
  if (!wantsPng) return;

  const resultPng = findOutputFile(job.id, "result.png", "result-full.png");
  if (!resultPng) {
    throw new Error("EmployeeID stage produced no result.png; cannot run IDCARDPRINT.");
  }

  job = await publishPartialFullBadge(job);
  log(`EmployeeID result.png ready; running IDCARDPRINT stage-2 for ${job.id}`);
  await runIdcardprintStage(ps, job, resultPng);
}

async function finishJob(job, ok, errorMessage) {
  const jobId = job.id;
  if (ok) {
    await publishOutputs(jobId);
    const files = collectOutputs(jobId);
    const withPaths = applyOutputPaths(job, files);
    const completed = updateJobFile("processing", withPaths, {
      status: "complete",
      completed_at: nowIso(),
      error_message: null,
    });
    moveJobFolder(jobId, "processing", "done");
    saveJob("done", { ...completed, status: "complete" });
    log(`job ${jobId} complete`);
  } else {
    const failed = updateJobFile("processing", job, {
      status: "failed",
      completed_at: nowIso(),
      error_message: errorMessage || "Unknown error",
    });
    const dest = moveJobFolder(jobId, "processing", "failed");
    saveJob("failed", failed);
    fs.writeFileSync(path.join(dest, "error.txt"), String(errorMessage || "Unknown error"), "utf8");
    log(`job ${jobId} failed: ${errorMessage}`);
  }
}

async function processClaimed(claimed) {
  const job = claimed.job;
  const jobFolder = path.join(PATHS.processing, job.id);
  log(`Processing job ${job.id}`);
  log(`Employee: ${job.input_json?.first_name || "?"} ${job.input_json?.last_name || "?"}`);
  log(`Export format: ${job.input_json?.export_format || "png"}`);

  try {
    await prepareInputJson(job, jobFolder);

    if (isDryRun()) {
      log("LOCAL_DRY_RUN=1 â€” writing placeholder outputs (Photoshop not invoked)");
      await writeDryRunOutputs(job);
    } else {
      await runPhotoshop(job);
    }

    await finishJob(job, true);
  } catch (error) {
    await finishJob(job, false, error.message || String(error));
  } finally {
    try {
      await cleanCurrentJob();
    } catch (e) {
      log(`cleanup error: ${e.message}`);
    }
  }
}

async function startWorker() {
  syncWorkerWorkspace();
  const ps = detectPhotoshop();
  const dry = isDryRun();

  log("========================================");
  log("MRZ Studio Local Worker Starting");
  log("========================================");
  log(`Worker ID: ${WORKER_ID}`);
  log(`Studio root: ${PATHS.root}`);
  log(`Queue: ${PATHS.queue}`);
  log(`Photoshop: ${ps.path || "NOT FOUND"}`);
  log(`Dry run: ${dry}`);
  if (ps.found) {
    log(`Invoke: ${invokeCommand(ps.path, path.join(PATHS.workerScripts, "run_employeeid_job.jsx"))}`);
  } else if (!dry) {
    log(photoshopGuidance());
    log("Worker will keep running; jobs will fail until Photoshop is configured or LOCAL_DRY_RUN=1.");
  }
  log("========================================");

  writeHeartbeat();
  heartbeatTimer = setInterval(() => {
    try { writeHeartbeat(); }
    catch (error) { log(`Heartbeat could not be saved; will retry: ${error.code || error.message}`); }
  }, HEARTBEAT_INTERVAL_MS);

  while (!stopRequested) {
    const request = readJson(path.join(PATHS.control, "worker-stop.json"));
    if (process.env.MRZ_INSTANCE_ID && request?.instance === process.env.MRZ_INSTANCE_ID) break;
    try {
      if (!isProcessing) {
        const claimed = await claimNextJob();
        if (claimed) {
          isProcessing = true;
          currentJobId = claimed.job.id;
          writeHeartbeat();
          await processClaimed(claimed);
        }
      }
    } catch (error) {
      log(`Worker loop error: ${error.message}`);
    } finally {
      isProcessing = false;
      currentJobId = null;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  writeHeartbeat({ status: "offline", current_job_id: null });
  log("Worker stopped after finishing its current job.");
}

async function shutdown() {
  log("Shutting down worker...");
  stopRequested = true;
  // Finish the active Photoshop job before leaving the loop.
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startWorker().catch((error) => {
  log(`Worker crashed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
