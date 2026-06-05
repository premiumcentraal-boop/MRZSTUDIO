// ============================================================================
// Badge Generation Worker for Windows + Photoshop
// ============================================================================
// Purpose: Poll Supabase for badge jobs and process them with Photoshop
// Safety: Only processes internal company badge requests
// Requirements: Node.js, Photoshop CC 2020+, Required fonts installed
// ============================================================================

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { convertJobToPhotoshopInput, validatePhotoshopInput } = require('./job-adapter');

const DEFAULT_BASE_PATH = path.resolve(__dirname, '..', 'local-worker');
const ENV_BASE_PATH = process.env.BADGE_AUTOMATION_BASE_PATH || DEFAULT_BASE_PATH;

// Load environment variables. Prefer dotenv when installed, but keep the worker
// self-contained for machines where npm install is blocked.
loadEnv(path.join(ENV_BASE_PATH, '.env'));
loadEnv(path.resolve(process.cwd(), '.env'));

function loadEnv(envPath) {
  try {
    require('dotenv').config({ path: envPath, override: false });
    return;
  } catch (_) {
    // Fall through to tiny local parser.
  }

  try {
    const text = require('fs').readFileSync(envPath, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const equalsAt = line.indexOf('=');
      if (equalsAt <= 0) continue;
      const key = line.slice(0, equalsAt).trim();
      let value = line.slice(equalsAt + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    }
  } catch (_) {
    // Missing env files are allowed; validation below reports required values.
  }
}

// Configuration
const CONFIG = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  WORKER_ID: process.env.WORKER_ID || 'photoshop-worker-01',
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 3000,
  HEARTBEAT_INTERVAL_MS: parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 10000,
  BASE_PATH: ENV_BASE_PATH,
  PHOTOSHOP_PATH: process.env.PHOTOSHOP_PATH || 'C:/Program Files/Adobe/Adobe Photoshop 2024/Photoshop.exe',
};

// Validate configuration
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_SERVICE_KEY
);

// Worker state
let isProcessing = false;
let currentJobId = null;
let heartbeatInterval = null;

// ============================================================================
// Main Worker Loop
// ============================================================================

async function startWorker() {
  console.log('========================================');
  console.log('Badge Generation Worker Starting');
  console.log('========================================');
  console.log(`Worker ID: ${CONFIG.WORKER_ID}`);
  console.log(`Supabase URL: ${CONFIG.SUPABASE_URL}`);
  console.log(`Poll Interval: ${CONFIG.POLL_INTERVAL_MS}ms`);
  console.log(`Heartbeat Interval: ${CONFIG.HEARTBEAT_INTERVAL_MS}ms`);
  console.log('========================================\n');

  // Start heartbeat
  heartbeatInterval = setInterval(updateHeartbeat, CONFIG.HEARTBEAT_INTERVAL_MS);
  await updateHeartbeat();

  // Main polling loop
  while (true) {
    try {
      if (!isProcessing) {
        await pollAndProcessJob();
      }
    } catch (error) {
      console.error('Worker loop error:', error.message);
    }

    await sleep(CONFIG.POLL_INTERVAL_MS);
  }
}

// ============================================================================
// Job Polling and Processing
// ============================================================================

async function pollAndProcessJob() {
  try {
    // Query for oldest queued job
    const { data: jobs, error } = await supabase
      .from('badge_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1);

    if (error) {
      console.error('Poll error:', error.message);
      return;
    }

    if (!jobs || jobs.length === 0) {
      // No jobs available
      return;
    }

    const job = jobs[0];
    console.log(`\n[${new Date().toISOString()}] Found job: ${job.id}`);

    // Claim the job
    await claimJob(job.id);

    // Process the job
    await processJob(job);

  } catch (error) {
    console.error('Poll and process error:', error.message);
  }
}

async function claimJob(jobId) {
  isProcessing = true;
  currentJobId = jobId;

  const { error } = await supabase
    .from('badge_jobs')
    .update({
      status: 'processing',
      worker_id: CONFIG.WORKER_ID,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to claim job: ${error.message}`);
  }

  console.log(`Job ${jobId} claimed`);
}

async function processJob(job) {
  try {
    console.log(`Processing job ${job.id}...`);
    console.log(`Employee: ${job.input_json.first_name} ${job.input_json.last_name}`);
    console.log(`Export format: ${job.input_json.export_format}`);

    // Step 1: Download input assets
    console.log('Downloading assets...');
    const { photoPath, signaturePath } = await downloadAssets(job);

    // Step 2: Prepare input.json for Photoshop using job-adapter
    console.log('Preparing input.json...');
    await prepareInputJson(job, photoPath, signaturePath);

    // Step 3: Run Photoshop script
    console.log('Running Photoshop...');
    await runPhotoshopScript();

    // Step 4: Upload output files
    console.log('Uploading results...');
    const outputPaths = await uploadResults(job);

    // Step 5: Mark job as complete
    console.log('Marking job complete...');
    await markJobComplete(job.id, outputPaths);

    console.log(`Job ${job.id} completed successfully`);

  } catch (error) {
    console.error(`Job ${job.id} failed:`, error.message);
    await markJobFailed(job.id, error.message);
  } finally {
    isProcessing = false;
    currentJobId = null;

    // Cleanup current-job folder
    try {
      await cleanupJob();
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }
  }
}

// ============================================================================
// Asset Download
// ============================================================================

async function downloadAssets(job) {
  const currentJobPath = path.join(CONFIG.BASE_PATH, 'current-job');
  await fs.mkdir(currentJobPath, { recursive: true });

  let photoPath = '';
  let signaturePath = '';

  // Download employee photo
  if (job.employee_photo_path) {
    const { data, error } = await supabase.storage
      .from('badge-inputs')
      .download(job.employee_photo_path);

    if (error) throw new Error(`Failed to download photo: ${error.message}`);

    const ext = path.extname(job.employee_photo_path);
    photoPath = path.join(currentJobPath, `photo${ext}`);
    await fs.writeFile(photoPath, Buffer.from(await data.arrayBuffer()));
    console.log(`Downloaded photo: ${photoPath}`);
  }

  // Download signature if present
  if (job.signature_image_path) {
    const { data, error } = await supabase.storage
      .from('badge-inputs')
      .download(job.signature_image_path);

    if (error) {
      console.warn(`Failed to download signature: ${error.message}`);
    } else {
      const ext = path.extname(job.signature_image_path);
      signaturePath = path.join(currentJobPath, `signature${ext}`);
      await fs.writeFile(signaturePath, Buffer.from(await data.arrayBuffer()));
      console.log(`Downloaded signature: ${signaturePath}`);
    }
  }

  return { photoPath, signaturePath };
}

// ============================================================================
// Input JSON Preparation (Uses job-adapter for canonical mapping)
// ============================================================================

async function prepareInputJson(job, photoPath, signaturePath) {
  const currentJobPath = path.join(CONFIG.BASE_PATH, 'current-job');

  // Convert job to Photoshop input using canonical mapping
  const input = convertJobToPhotoshopInput(job, photoPath, signaturePath);

  // Validate input structure
  const errors = validatePhotoshopInput(input);
  if (errors.length > 0) {
    throw new Error(`Invalid Photoshop input: ${errors.join(', ')}`);
  }

  // Write input.json
  const inputJsonPath = path.join(currentJobPath, 'input.json');
  await fs.writeFile(inputJsonPath, JSON.stringify(input, null, 2));
  console.log(`Input JSON saved: ${inputJsonPath}`);
  console.log(`PSD targets: ${Object.keys(input.psdTextTargets).length} text layers mapped`);
}

// ============================================================================
// Photoshop Execution
// ============================================================================

async function runPhotoshopScript() {
  const scriptPath = path.join(CONFIG.BASE_PATH, 'scripts', 'run_employeeid_job.jsx');

  try {
    // Execute Photoshop with the script
    const command = `"${CONFIG.PHOTOSHOP_PATH}" "${scriptPath}"`;
    console.log(`Executing: ${command}`);

    execSync(command, {
      cwd: CONFIG.BASE_PATH,
      stdio: 'inherit',
      env: {
        ...process.env,
        BADGE_AUTOMATION_BASE_PATH: CONFIG.BASE_PATH,
      },
      timeout: 120000, // 2 minute timeout
    });

    console.log('Photoshop script completed');

  } catch (error) {
    throw new Error(`Photoshop execution failed: ${error.message}`);
  }
}

// ============================================================================
// Result Upload
// ============================================================================

async function uploadResults(job) {
  const outputFolder = path.join(CONFIG.BASE_PATH, 'output', job.id);
  const outputPaths = {};
  const expectedFormats = getExpectedOutputFormats(job);

  // Upload PNG
  const pngPath = path.join(outputFolder, 'result.png');
  if (await fileExists(pngPath)) {
    const pngData = await fs.readFile(pngPath);
    const uploadPath = `${job.id}/result.png`;

    const { error } = await supabase.storage
      .from('badge-outputs')
      .upload(uploadPath, pngData, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) throw new Error(`Failed to upload PNG: ${error.message}`);
    outputPaths.output_png_path = uploadPath;
    console.log(`Uploaded PNG: ${uploadPath}`);
  } else if (expectedFormats.includes('png')) {
    throw new Error(`Expected PNG output was not created: ${pngPath}`);
  }

  // Upload PDF if exists
  const pdfPath = path.join(outputFolder, 'result.pdf');
  if (await fileExists(pdfPath)) {
    const pdfData = await fs.readFile(pdfPath);
    const uploadPath = `${job.id}/result.pdf`;

    const { error } = await supabase.storage
      .from('badge-outputs')
      .upload(uploadPath, pdfData, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (error) throw new Error(`Failed to upload PDF: ${error.message}`);
    outputPaths.output_pdf_path = uploadPath;
    console.log(`Uploaded PDF: ${uploadPath}`);
  } else if (expectedFormats.includes('pdf')) {
    throw new Error(`Expected PDF output was not created: ${pdfPath}`);
  }

  // Upload PSD if exists
  const psdPath = path.join(outputFolder, 'result.psd');
  if (await fileExists(psdPath)) {
    const psdData = await fs.readFile(psdPath);
    const uploadPath = `${job.id}/result.psd`;

    const { error } = await supabase.storage
      .from('badge-outputs')
      .upload(uploadPath, psdData, {
        contentType: 'application/octet-stream',
        upsert: true,
      });

    if (error) throw new Error(`Failed to upload PSD: ${error.message}`);
    outputPaths.output_psd_path = uploadPath;
    console.log(`Uploaded PSD: ${uploadPath}`);
  } else if (expectedFormats.includes('psd')) {
    throw new Error(`Expected PSD output was not created: ${psdPath}`);
  }

  return outputPaths;
}

function getExpectedOutputFormats(job) {
  const format = String(job.input_json?.export_format || 'png').toLowerCase();
  if (format === 'all') return ['png', 'pdf', 'psd'];
  return [format];
}

// ============================================================================
// Job Status Updates
// ============================================================================

async function markJobComplete(jobId, outputPaths) {
  const { error } = await supabase
    .from('badge_jobs')
    .update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...outputPaths,
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to mark job complete: ${error.message}`);
  }
}

async function markJobFailed(jobId, errorMessage) {
  const { error } = await supabase
    .from('badge_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to mark job as failed:', error.message);
  }
}

// ============================================================================
// Heartbeat
// ============================================================================

async function updateHeartbeat() {
  try {
    const { error } = await supabase
      .from('worker_heartbeat')
      .upsert({
        worker_id: CONFIG.WORKER_ID,
        status: 'online',
        last_seen_at: new Date().toISOString(),
        current_job_id: currentJobId,
      });

    if (error) {
      console.error('Heartbeat error:', error.message);
    }
  } catch (error) {
    console.error('Heartbeat error:', error.message);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

async function cleanupJob() {
  const currentJobPath = path.join(CONFIG.BASE_PATH, 'current-job');

  try {
    const files = await fs.readdir(currentJobPath);
    for (const file of files) {
      await fs.unlink(path.join(currentJobPath, file));
    }
    console.log('Cleaned up current-job folder');
  } catch (error) {
    // Folder might not exist
  }
}

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown() {
  console.log('\nShutting down worker...');

  // Clear heartbeat interval
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Mark worker as offline
  try {
    await supabase
      .from('worker_heartbeat')
      .upsert({
        worker_id: CONFIG.WORKER_ID,
        status: 'offline',
        last_seen_at: new Date().toISOString(),
        current_job_id: null,
      });
  } catch (error) {
    console.error('Failed to update offline status:', error.message);
  }

  console.log('Worker stopped');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============================================================================
// Start Worker
// ============================================================================

startWorker().catch((error) => {
  console.error('Worker crashed:', error);
  process.exit(1);
});
