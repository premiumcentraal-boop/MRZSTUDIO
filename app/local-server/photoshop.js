/**
 * Locate Adobe Photoshop on Windows.
 * Order: PHOTOSHOP_EXE env, control\photoshop-path.txt, common 2026→2023 installs.
 */
const fs = require("fs");
const path = require("path");
const { PATHS } = require("./paths");

const COMMON_PHOTOSHOP_EXES = [
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe",
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe",
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe",
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2023\\Photoshop.exe",
  "C:\\Program Files\\Adobe\\Adobe Photoshop 2022\\Photoshop.exe",
];

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readConfiguredPath() {
  const envPath = String(process.env.PHOTOSHOP_EXE || process.env.PHOTOSHOP_PATH || "").trim();
  if (envPath && fileExists(envPath)) return envPath;
  try {
    const fromFile = fs.readFileSync(PATHS.photoshopPathFile, "utf8").trim();
    if (fromFile && fileExists(fromFile)) return fromFile;
  } catch {
    // optional
  }
  return null;
}

function detectPhotoshop() {
  const configured = readConfiguredPath();
  if (configured) {
    return { found: true, path: configured, source: "configured" };
  }
  for (const candidate of COMMON_PHOTOSHOP_EXES) {
    if (fileExists(candidate)) {
      return { found: true, path: candidate, source: "detected" };
    }
  }
  return { found: false, path: null, source: "missing" };
}

function photoshopGuidance() {
  const lines = [
    "Adobe Photoshop was not found. Real jobs cannot run until Photoshop is installed and the exe path is set.",
    "Tried:",
    ...COMMON_PHOTOSHOP_EXES.map((p) => `  - ${p}`),
    "Fix: set env PHOTOSHOP_EXE to the full Photoshop.exe path, or write that path into:",
    `  ${PATHS.photoshopPathFile}`,
    "For UI wiring without Photoshop, start with LOCAL_DRY_RUN=1.",
  ];
  return lines.join("\n");
}

function invokeCommand(exe, scriptPath) {
  const ps = exe || "<PHOTOSHOP_EXE>";
  const jsx = scriptPath || path.join(PATHS.workerScripts, "run_employeeid_job.jsx");
  return `"${ps}" "${jsx}"`;
}

module.exports = {
  COMMON_PHOTOSHOP_EXES,
  detectPhotoshop,
  photoshopGuidance,
  invokeCommand,
};
