/**
 * Local job API. Replaces Supabase for the offline product tree.
 *
 *   GET  /api/health
 *   POST /api/jobs            multipart: payload, employee_photo, signature_image?
 *   GET  /api/jobs
 *   GET  /api/jobs/:id
 *   GET  /api/jobs/:id/files/:name
 *   POST /api/jobs/:id/retry
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  PATHS,
  ensureLayout,
  readJson,
  isDryRun,
  apiPort,
  appendLog,
} = require("./paths");
const { detectPhotoshop, photoshopGuidance, invokeCommand } = require("./photoshop");
const { parseMultipart, readRequestBody } = require("./multipart");
const {
  createJobRecord,
  saveJob,
  loadJob,
  listJobs,
  safeFileName,
  extFromName,
  toPublicJob,
  resolveOutputFile,
  mimeFor,
  nowIso,
  moveJobFolder,
  emptyOutputs,
} = require("./jobs");

const PORT = apiPort();
const HOST = process.env.LOCAL_API_HOST || "127.0.0.1";
const STUDIO_VERSION = require("../../release/version.json");
const handleMcpSettings = require("./mcp-connections").createSettingsHandler(PATHS.control);
const idGeneratorPlugin = require('./id-generator/plugin').createPlugin({control:PATHS.control,paths:PATHS,apiPort:PORT,uiPort:Number(process.env.MRZ_UI_PORT||5173),health:healthPayload});

function log(line) {
  console.log(line);
  try {
    appendLog("server.log", line);
  } catch {
    // ignore log IO
  }
}

function send(res, status, body, headers = {}) {
  const json = typeof body === "string" ? body : JSON.stringify(body);
  const isJson = typeof body !== "string";
  res.writeHead(status, {
    "Content-Type": isJson ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(json);
}

function sendError(res, status, message) {
  send(res, status, { error: message });
}

function corsPreflight(res) {
  res.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });
  res.end();
}

function parseUrl(req) {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  const parts = u.pathname.split("/").filter(Boolean);
  return { u, parts, pathname: u.pathname };
}

function workerHeartbeat() {
  const hb = readJson(PATHS.heartbeat, null);
  if (!hb) {
    return { online: false, last_seen_at: null, current_job_id: null, worker_id: null };
  }
  const last = hb.last_seen_at ? new Date(hb.last_seen_at).getTime() : 0;
  const online = hb.status !== "offline" && Number.isFinite(last) && Date.now() - last < 30000;
  return {
    online,
    last_seen_at: hb.last_seen_at || null,
    current_job_id: hb.current_job_id || null,
    worker_id: hb.worker_id || null,
    pid: hb.pid || null,
    instance: hb.instance || null,
    status: hb.status || (online ? "online" : "offline"),
  };
}

function healthPayload() {
  const ps = detectPhotoshop();
  const dryRun = isDryRun();
  const worker = workerHeartbeat();
  return {
    ok: true,
    mode: "local",
    studio: { product: STUDIO_VERSION.product, version: STUDIO_VERSION.version, instance: process.env.MRZ_INSTANCE_ID || null, pid: process.pid },
    dryRun,
    port: PORT,
    photoshop: {
      found: ps.found,
      path: ps.path,
      source: ps.source,
      invoke: ps.found
        ? invokeCommand(ps.path, path.join(PATHS.workerScripts, "run_employeeid_job.jsx"))
        : null,
      guidance: ps.found ? null : photoshopGuidance(),
    },
    worker,
    template: {
      expected: path.join(PATHS.workerTemplates, "EmployeeID.psd"),
      present: fs.existsSync(path.join(PATHS.workerTemplates, "EmployeeID.psd")),
    },
    root: PATHS.root,
  };
}

async function handleCreateJob(req, res) {
  const stopping = readJson(path.join(PATHS.control, "worker-stop.json"));
  if (process.env.MRZ_INSTANCE_ID && stopping?.instance === process.env.MRZ_INSTANCE_ID) {
    sendError(res, 503, "Studio is stopping or updating. Please try again after it restarts.");
    return;
  }
  const contentType = String(req.headers["content-type"] || "");
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    sendError(res, 400, "POST /api/jobs expects multipart/form-data (payload + employee_photo)");
    return;
  }

  const body = await readRequestBody(req);
  if (process.env.MRZ_INSTANCE_ID && readJson(path.join(PATHS.control, "worker-stop.json"))?.instance === process.env.MRZ_INSTANCE_ID) {
    sendError(res, 503, "Studio is stopping. Retry this upload after it restarts.");
    return;
  }
  const { fields, files } = parseMultipart(body, contentType);

  let payload;
  try {
    payload = JSON.parse(fields.payload || "{}");
  } catch {
    sendError(res, 400, "payload must be JSON");
    return;
  }

  const photo = files.employee_photo;
  if (!photo || !photo.data || photo.data.length === 0) {
    sendError(res, 400, "employee_photo is required");
    return;
  }

  const photoExt = extFromName(photo.filename, photo.mime);
  const photoName = `photo${photoExt}`;
  const signature = files.signature_image;
  const signatureName = signature && signature.data && signature.data.length
    ? `signature${extFromName(signature.filename, signature.mime)}`
    : null;

  payload.assets = {
    employee_photo_path: photoName,
    signature_image_path: signatureName || undefined,
  };
  payload.meta = payload.meta || {
    created_from: "mrz-studio-local",
    intended_use: "internal_company_badge",
  };
  if (!payload.meta.intended_use) payload.meta.intended_use = "internal_company_badge";
  payload.template = payload.template || "EmployeeID.psd";
  payload.export_format = payload.export_format || "png";

  const job = createJobRecord({ payload, photoName, signatureName });

  const dir = path.join(PATHS.incoming, job.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, photoName), photo.data);
  if (signatureName && signature) {
    fs.writeFileSync(path.join(dir, signatureName), signature.data);
  }
  // Publish the claimable job record only after all input assets are complete.
  saveJob("incoming", job);
  if(payload.meta?.created_from==='cyclone-ports/id-generator-panel')idGeneratorPlugin.trackPanelJob(job);

  log(`created job ${job.id} in queue/incoming`);
  send(res, 201, toPublicJob(job));
}

function handleRetry(jobId, res) {
  const found = loadJob(jobId);
  if (!found) {
    sendError(res, 404, "Job not found");
    return;
  }
  const { stage, job } = found;
  if (stage === "incoming" || stage === "processing") {
    send(res, 200, toPublicJob(job));
    return;
  }

  const next = {
    ...job,
    ...emptyOutputs(),
    status: "queued",
    error_message: null,
    worker_id: null,
    started_at: null,
    completed_at: null,
    updated_at: nowIso(),
  };
  saveJob(stage, next);
  moveJobFolder(job.id, stage, "incoming");
  const reloaded = loadJob(job.id);
  log(`retried job ${job.id}`);
  send(res, 200, toPublicJob(reloaded.job));
}

function handleFile(jobId, fileName, res) {
  const safe = path.basename(decodeURIComponent(fileName || ""));
  const filePath = resolveOutputFile(jobId, safe);
  if (!filePath) {
    sendError(res, 404, "File not found");
    return;
  }
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": mimeFor(filePath),
    "Content-Length": data.length,
    "Content-Disposition": `inline; filename="${safeFileName(safe, safe)}"`,
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (await idGeneratorPlugin.handle(req, res)) return;
    if (await handleMcpSettings(req, res)) return;
    if (req.method === "OPTIONS") {
      corsPreflight(res);
      return;
    }

    const { parts, pathname } = parseUrl(req);

    if (req.method === "GET" && (pathname === "/api/health" || pathname === "/health")) {
      send(res, 200, healthPayload());
      return;
    }

    if (req.method === "POST" && pathname === "/api/jobs") {
      await handleCreateJob(req, res);
      return;
    }

    if (req.method === "GET" && pathname === "/api/jobs") {
      send(res, 200, { jobs: listJobs(30).map(toPublicJob) });
      return;
    }

    if (parts[0] === "api" && parts[1] === "jobs" && parts[2] && parts[3] === "files" && parts[4]) {
      if (req.method !== "GET") {
        sendError(res, 405, "Method not allowed");
        return;
      }
      handleFile(parts[2], parts[4], res);
      return;
    }

    if (parts[0] === "api" && parts[1] === "jobs" && parts[2] && parts[3] === "retry") {
      if (req.method !== "POST") {
        sendError(res, 405, "Method not allowed");
        return;
      }
      handleRetry(parts[2], res);
      return;
    }

    if (req.method === "GET" && parts[0] === "api" && parts[1] === "jobs" && parts[2] && !parts[3]) {
      const found = loadJob(parts[2]);
      if (!found) {
        sendError(res, 404, "Job not found");
        return;
      }
      send(res, 200, toPublicJob(found.job));
      return;
    }

    sendError(res, 404, `No route for ${req.method} ${pathname}`);
  } catch (error) {
    log(`server error: ${error.message}`);
    sendError(res, 500, error.message || "Internal server error");
  }
});

ensureLayout();
server.listen(PORT, HOST, () => {
  const ps = detectPhotoshop();
  log(`Local API listening on http://${HOST}:${PORT}`);
  log(`dryRun=${isDryRun()} photoshop=${ps.path || "MISSING"}`);
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  void idGeneratorPlugin.close();
  log("Local API shutting down");
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => server.closeAllConnections(), 15000).unref();
}

if (process.env.MRZ_INSTANCE_ID) setInterval(() => {
  const request = readJson(path.join(PATHS.control, "runtime-request.json"));
  if (request?.instance === process.env.MRZ_INSTANCE_ID && request.phase === "services") shutdown();
}, 300).unref();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
