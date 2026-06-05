import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { buildTD1, buildTD3, type BuildResult } from "../lib/mrz";
import { DocRulesInfoButton } from "./components/doc-rules-info";
import {
  Download,
  Badge,
  RotateCcw,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw,
  Shuffle,
  Images,
  Check,
  X,
} from "lucide-react";

/* ============================================================================
 * Number generators (same algorithms used by NL Tools)
 *   - Document number: 9 chars, ICAO mod-10 with weights 7,3,1, RvIG post-2019
 *   - Personal number / BSN: 9 digits, Dutch elfproef weights 9..2,-1 mod 11
 * ========================================================================== */
// All Dutch document-number / BSN / MRZ calculations now route through the
// canonical library at src/lib/dutch-id-validation. The model series + era
// flag are resolved from the form's issueDate so we get the right rules for
// 2014/2021/2024 documents automatically.
import {
  generateDutchTravelDocumentNumber,
  validateDutchTravelDocumentNumber,
  generateBsn as libGenerateBsn,
  pickPrimaryModelSeries,
  eraForModel,
} from "../lib/dutch-id-validation";
import {
  generateGermanTravelDocumentNumber,
  validateGermanTravelDocumentNumber,
  pickPrimaryModelSeries as pickPrimaryGermanModelSeries,
} from "../lib/german-id-validation";

function eraFromIssueDate(issueDate: string | undefined, family: "passport" | "identity_card") {
  const m = pickPrimaryModelSeries({ family, issueDate });
  return eraForModel(m);
}

type DocFamily = "passport" | "identity_card" | "driving_licence";

function generateDocNumber(
  issueDate?: string,
  family: DocFamily = "identity_card",
  country: string = "NL",
): string {
  if (country === "DE") return generateGermanTravelDocumentNumber();
  if (family === "driving_licence") return generateGermanTravelDocumentNumber();
  return generateDutchTravelDocumentNumber(
    eraFromIssueDate(issueDate, family === "driving_licence" ? "identity_card" : family),
  );
}
function isValidDocNumber(
  raw: string,
  issueDate?: string,
  family: DocFamily = "identity_card",
  country: string = "NL",
): boolean {
  if (country === "DE") return validateGermanTravelDocumentNumber(raw).status === "valid";
  if (family === "driving_licence") return /^[0-9A-Z]{8,12}$/.test(raw.toUpperCase());
  return (
    validateDutchTravelDocumentNumber(
      raw,
      eraFromIssueDate(issueDate, family === "driving_licence" ? "identity_card" : family),
    ).status === "valid"
  );
}
function parseHeightCm(value: string | undefined): number {
  const m = /(\d+)\s*[,\.]\s*(\d{1,2})/.exec(String(value || ""));
  if (m) return Math.round(parseFloat(`${m[1]}.${m[2].padEnd(2, "0")}`) * 100);
  const n = parseInt(String(value || "").replace(/\D/g, ""), 10);
  if (Number.isFinite(n) && n >= 100 && n <= 250) return n;
  return 172;
}
function formatHeightMeters(cm: number): string {
  const safe = Math.max(140, Math.min(210, Math.round(cm || 172)));
  const meters = Math.floor(safe / 100);
  const rem = safe % 100;
  return `${meters},${String(rem).padStart(2, "0")} m`;
}

// BSN generation routes through the library so its elfproef logic is the
// single source of truth across the site.
const generateBSN = (): string => libGenerateBsn();
import {
  supabase,
  isSupabaseConfigured,
  isMockMode,
  validateBadgeJobForm,
  generateStoragePath,
  type BadgeJob,
  type BadgeJobPayload,
  type WorkerHeartbeat,
  type ValidationError,
} from "../lib/supabase";
import {
  COUNTRY_PRESETS,
  COUNTRY_LIST,
  getCountryPreset,
  defaultExpiry,
  clampExpiry,
  validityYearsForHolder,
  docTypeLabel,
  type CountryCode,
  type DocType,
} from "../lib/countryPresets";
import { formatGenderForDocument } from "../lib/genderFormat";
import {
  calculateBirthYear,
  validateEmployeeFields,
  COMPANY_FIELDS,
  EMPLOYEE_FIELDS,
} from "../lib/badgeMapping";
import { PhotoEditor, EXPORT_W, EXPORT_H, SIGNATURE_W, SIGNATURE_H } from "./components/photo-editor";
import { IncomingItems } from "./components/incoming-items";
import { ProfilesBar } from "./components/profiles-bar";
import { SignatureGenerator } from "./components/signature-generator";
import { SuggestedToolsRow } from "./steps/nl-tools-step";
import selfieOverlayUrl from "../imports/NEWSELFIEOVERLAY.png";

/* ============================================================================
 * Helper Components
 * ========================================================================== */

function PrimaryButton({
  onClick,
  disabled,
  type = "button",
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="glass-sm px-4 sm:px-5 h-10 rounded-full text-xs mono uppercase tracking-wider flex items-center gap-2 text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  type = "button",
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-4 sm:px-5 h-10 rounded-full text-xs mono uppercase tracking-wider flex items-center gap-2 text-white/70 hover:text-white border border-white/15 hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass-sm px-3.5 py-2 rounded-full text-xs text-white/80 mono uppercase tracking-wider flex items-center gap-2 hover:text-white transition-colors"
    >
      ← Back
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  error,
  onGenerate,
  generateTitle,
  status,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  onGenerate?: () => void;
  generateTitle?: string;
  status?: "ok" | "err" | null;
}) {
  // When `status` is supplied, the in-bar check/X icon is the sole pass/fail
  // signal — we suppress the inline error text so the UI doesn't double up.
  const showErrorText = !status && error;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-white/70 text-xs">
          {label}
          {showErrorText && <span className="text-rose-300 ml-2">• {error}</span>}
        </label>
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            title={generateTitle || "Generate a valid value"}
            className="hidden sm:flex items-center gap-1 text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors px-2 py-0.5 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5"
          >
            <Shuffle className="w-3 h-3" strokeWidth={2} />
            <span>Generate</span>
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 ${
            onGenerate ? "pr-12 sm:pr-3" : ""
          } ${status ? "sm:pr-10" : ""} rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 disabled:opacity-50 ${
            status === "err" || (!status && error)
              ? "border-rose-300/50"
              : status === "ok"
              ? "border-emerald-300/40"
              : "border-white/10"
          }`}
        />
        {onGenerate && (
          <button
            type="button"
            onClick={onGenerate}
            title={generateTitle || "Generate a valid value"}
            aria-label={generateTitle || "Generate"}
            className="sm:hidden absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md bg-white/10 border border-white/15 text-white/85 hover:text-white hover:bg-white/15 active:bg-white/20 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        )}
        {status && (
          <span
            className={`hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 items-center justify-center w-5 h-5 rounded-full border ${
              status === "ok"
                ? "text-emerald-300 border-emerald-300/40 bg-emerald-300/10"
                : "text-rose-300 border-rose-300/40 bg-rose-300/10"
            }`}
          >
            {status === "ok" ? (
              <Check className="w-3 h-3" strokeWidth={2.5} />
            ) : (
              <X className="w-3 h-3" strokeWidth={2.5} />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
 * Mock Worker Mode (for development without Supabase)
 * ========================================================================== */

let mockJobQueue: BadgeJob[] = [];

function createMockJob(payload: BadgeJobPayload, photoPath: string, signaturePath: string): BadgeJob {
  const job: BadgeJob = {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    status: "queued",
    template: "EmployeeID.psd",
    input_json: payload,
    employee_photo_path: photoPath,
    signature_image_path: signaturePath || null,
    output_png_path: null,
    output_front_png_path: null,
    output_back_png_path: null,
    output_full_png_path: null,
    output_pdf_path: null,
    output_psd_path: null,
    output_mockup_1_path: null,
    output_mockup_2_path: null,
    output_mockup_3_path: null,
    output_mockup_1_back_path: null,
    output_mockup_1_front_path: null,
    output_mockup_2_back_path: null,
    output_mockup_2_front_path: null,
    output_mockup_3_back_path: null,
    output_mockup_3_front_path: null,
    error_message: null,
    worker_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
  };
  mockJobQueue.push(job);
  simulateMockWorker(job);
  return job;
}

function simulateMockWorker(job: BadgeJob) {
  // Simulate: queued → processing (2s) → complete (3s)
  setTimeout(() => {
    const found = mockJobQueue.find((j) => j.id === job.id);
    if (found) {
      found.status = "processing";
      found.worker_id = "mock-worker-dev";
      found.started_at = new Date().toISOString();
      found.updated_at = new Date().toISOString();
    }
  }, 2000);

  // Front lands first while still processing — exercises the partial-receive UI.
  setTimeout(() => {
    const found = mockJobQueue.find((j) => j.id === job.id);
    if (!found) return;
    if (job.input_json.export_format === "png") {
      found.output_front_png_path = `mock/${job.id}/result-front.png`;
    }
    found.updated_at = new Date().toISOString();
  }, 3500);

  setTimeout(() => {
    const found = mockJobQueue.find((j) => j.id === job.id);
    if (found) {
      found.status = "complete";
      found.completed_at = new Date().toISOString();
      found.updated_at = new Date().toISOString();
      if (job.input_json.export_format === "png") {
        found.output_front_png_path = `mock/${job.id}/result-front.png`;
        found.output_back_png_path = `mock/${job.id}/result-back.png`;
        found.output_full_png_path = `mock/${job.id}/result.png`;
        found.output_png_path = `mock/${job.id}/result.png`;
      }
      if (job.input_json.export_format === "pdf") {
        found.output_pdf_path = `mock/${job.id}/result.pdf`;
      }
      if (job.input_json.export_format === "psd") {
        found.output_psd_path = `mock/${job.id}/result.psd`;
      }
    }
  }, 5000);

  // Stagger mockup uploads so the incremental UI shows cards filling in.
  // Each side arrives ~700ms apart; the legacy single path mirrors the
  // front upload for backwards compatibility.
  if (job.input_json.generate_mockups) {
    const sides: Array<["back" | "front", number]> = [
      ["back", 5500], ["front", 6200],
      ["back", 6900], ["front", 7600],
      ["back", 8300], ["front", 9000],
    ];
    [1, 2, 3].forEach((n, idx) => {
      const [, backDelay] = sides[idx * 2];
      const [, frontDelay] = sides[idx * 2 + 1];
      setTimeout(() => {
        const f = mockJobQueue.find((j) => j.id === job.id);
        if (!f) return;
        (f as any)[`output_mockup_${n}_back_path`] = `mock/${job.id}/mockup-${n}-back.jpg`;
        f.updated_at = new Date().toISOString();
      }, backDelay);
      setTimeout(() => {
        const f = mockJobQueue.find((j) => j.id === job.id);
        if (!f) return;
        (f as any)[`output_mockup_${n}_front_path`] = `mock/${job.id}/mockup-${n}-front.jpg`;
        (f as any)[`output_mockup_${n}_path`] = `mock/${job.id}/mockup-${n}-front.jpg`;
        f.updated_at = new Date().toISOString();
      }, frontDelay);
    });
  }
}

function getMockJob(id: string): BadgeJob | null {
  return mockJobQueue.find((j) => j.id === id) || null;
}

function getMockJobs(): BadgeJob[] {
  return [...mockJobQueue].reverse();
}

/* ============================================================================
 * Main ID Generator Component
 * ========================================================================== */

export default function IdGeneratorStep({
  onBack,
  onPickTool,
}: {
  onBack: () => void;
  onPickTool?: (toolId: string) => void;
}) {
  const [formData, setFormData] = useState({
    // Country + document type
    country: "NL" as "NL" | "DE" | "OTHER",
    doc_type: "id_card" as "id_card" | "passport" | "driving_licence",
    nationality_code: "NLD",
    // Company fields
    company_name: "Acme Corporation",
    issuer_code: "NLD",
    department: "Engineering",
    // Employee fields
    first_name: "Mila",
    last_name: "De Vries",
    doc_number: "AB12C34D5",
    personal_number: "123456789",
    // Validity fields
    valid_from: "2020-06-14",
    expires: "2030-06-14",
    // Personal info fields
    birth_date: "1990-06-14",
    gender: "F",
    height: "1,72 m",
    country_of_birth: "Nederlandse",
    city_of_birth: "Zoetermeer",
    company_location: "Burg. van Zoetermeer",
    // Export format
    export_format: "png",
    // Mockup generation
    generate_mockups: false,
    // MRZ overrides — only used when country === "OTHER"
    mrz_format: "auto" as "auto" | "td1" | "td3",
    mrz_method: "icao9303" as "icao9303" | "icao_strict" | "none",
  });
  const [employeePhoto, setEmployeePhoto] = useState<File | null>(null);
  const [photoEditorSource, setPhotoEditorSource] = useState<File | null>(null);
  const [signatureEditorSource, setSignatureEditorSource] = useState<File | null>(null);
  const [signatureImage, setSignatureImage] = useState<File | null>(null);
  const [employeePhotoPreview, setEmployeePhotoPreview] = useState<string>("");
  const [signaturePreview, setSignaturePreview] = useState<string>("");
  const [currentJob, setCurrentJob] = useState<BadgeJob | null>(null);
  const [recentJobs, setRecentJobs] = useState<BadgeJob[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [workerInfo, setWorkerInfo] = useState<WorkerHeartbeat | null>(null);
  const [workerChecked, setWorkerChecked] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [downloadProgressText, setDownloadProgressText] = useState("");

  const workerOnline = workerInfo
    ? new Date().getTime() - new Date(workerInfo.last_seen_at).getTime() < 30000
    : false;

  // Live MRZ — picks TD1 for ID cards and TD3 for passports.
  // The issuer/nationality codes come from the Country & Document section,
  // so changing country (NL/DE/OTHER) or document type re-targets the right tool.
  const mrzResult: BuildResult = useMemo(() => {
    const preset = getCountryPreset(formData.country as CountryCode);
    // NL NIK model-year rule:
    //   2014 generation (issue 2014-03-09 .. 2021-08-01): BSN encoded in line-1 optional data.
    //   2021+ generation: BSN removed from the MRZ.
    // Other countries: pass personal_number straight through.
    const issueYear =
      /^\d{4}-\d{2}-\d{2}$/.test(formData.valid_from || "")
        ? parseInt(formData.valid_from.slice(0, 4), 10)
        : new Date().getFullYear();
    const nlPre2021 = formData.country === "NL" && issueYear < 2021;
    const optional1 =
      formData.country === "NL"
        ? nlPre2021
          ? formData.personal_number
          : ""
        : formData.personal_number;
    const mrzInput = {
      documentCode: formData.doc_type === "passport" ? "P<" : "I<",
      issuer: formData.issuer_code || preset.issuerCode,
      number: formData.doc_number,
      surname: formData.last_name,
      given: formData.first_name,
      nationality: formData.nationality_code || preset.nationalityCode,
      birth: formData.birth_date,
      sex:
        formData.country === "NL" || formData.country === "DE"
          ? formatGenderForDocument({
              country: formData.country,
              documentType: formData.doc_type,
              gender: formData.gender,
              target: "mrz",
            })
          : formData.gender,
      expiry: formData.expires,
      // TD3 personal field is unused for NL (BSN goes into TD1 optional1 instead).
      personal: formData.country === "NL" ? "" : formData.personal_number,
      optional1,
      optional2: "",
    };
    // For OTHER, the user can override format via mrz_format ("auto" follows doc_type).
    const resolvedFormat =
      formData.country === "OTHER" && formData.mrz_format !== "auto"
        ? formData.mrz_format
        : formData.doc_type === "passport"
        ? "td3"
        : "td1";
    if (formData.country === "OTHER") {
      mrzInput.documentCode = resolvedFormat === "td3" ? "P<" : "I<";
    }
    return resolvedFormat === "td3"
      ? buildTD3(mrzInput as any)
      : buildTD1(mrzInput as any);
  }, [
    formData.country,
    formData.doc_type,
    formData.issuer_code,
    formData.nationality_code,
    formData.doc_number,
    formData.first_name,
    formData.last_name,
    formData.birth_date,
    formData.gender,
    formData.expires,
    formData.valid_from,
    formData.personal_number,
    formData.mrz_format,
    formData.mrz_method,
  ]);
  const mrzString = mrzResult.lines.join("\n");

  // Auto-fit MRZ font size by directly measuring the rendered text against
  // its container. TD3 (44 chars / passport) is wider than TD1 (30 chars /
  // ID card) and was overflowing the panel because the previous heuristic
  // used a guessed char-advance ratio. We now read the actual scrollWidth
  // after a layout pass and shrink until it fits — no guessing.
  // Auto-fit the MRZ to its container width with a measurement-driven loop
  // (no hard-coded char-advance constant). We scale up *and* down so TD1
  // (30 chars) fills the panel comfortably while TD3 (44 chars) shrinks to
  // fit. The MAX cap keeps the font readable on wide desktop panels;
  // anything smaller is driven entirely by the content.
  const mrzPreRef = useRef<HTMLPreElement | null>(null);
  const [mrzFontSize, setMrzFontSize] = useState(15);
  useEffect(() => {
    const el = mrzPreRef.current;
    if (!el) return;
    const MAX = 18; // never bigger than this even when there's room
    const MIN = 8; // smallest readable size on narrow mobile

    const fit = () => {
      requestAnimationFrame(() => {
        const node = mrzPreRef.current;
        if (!node) return;
        const cs = getComputedStyle(node);
        const padX =
          parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
        const innerW = node.clientWidth - padX;
        const contentW = node.scrollWidth - padX;
        const current = parseFloat(cs.fontSize || "15") || 15;
        if (contentW <= 0 || innerW <= 0) return;
        // 0.995 absorbs sub-pixel rounding so we fill ~all of the available
        // width without re-overflowing on the next layout pass.
        const ratio = (innerW * 0.995) / contentW;
        const next = Math.max(MIN, Math.min(MAX, current * ratio));
        if (Math.abs(next - current) > 0.25) setMrzFontSize(next);
      });
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [mrzResult.lines.length, mrzString]);

  // Check worker heartbeat
  useEffect(() => {
    if (isMockMode) {
      setWorkerInfo({
        worker_id: "mock-worker-dev",
        status: "online",
        last_seen_at: new Date().toISOString(),
        current_job_id: null,
      });
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;

    const checkWorker = async () => {
      try {
        const { data, error } = await supabase
          .from("worker_heartbeat")
          .select("*")
          .order("last_seen_at", { ascending: false })
          .limit(1)
          .single();

        if (!error && data) {
          setWorkerInfo(data as WorkerHeartbeat);
        } else {
          setWorkerInfo(null);
        }
      } catch {
        setWorkerInfo(null);
      } finally {
        setWorkerChecked(true);
      }
    };

    checkWorker();
    const interval = setInterval(checkWorker, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load recent jobs
  const loadJobs = async () => {
    if (isMockMode) {
      setRecentJobs(getMockJobs());
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data, error } = await supabase
        .from("badge_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setRecentJobs(data as BadgeJob[]);
      }
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    loadJobs();
  }, [currentJob]);

  // Poll current job
  useEffect(() => {
    if (!currentJob || currentJob.status === "complete" || currentJob.status === "failed") {
      return;
    }

    const pollInterval = setInterval(async () => {
      if (isMockMode) {
        const updated = getMockJob(currentJob.id);
        if (updated) setCurrentJob(updated);
        return;
      }

      if (!isSupabaseConfigured || !supabase) return;

      try {
        const { data, error } = await supabase
          .from("badge_jobs")
          .select("*")
          .eq("id", currentJob.id)
          .single();

        if (!error && data) {
          setCurrentJob(data as BadgeJob);
        }
      } catch {
        /* noop */
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [currentJob?.id, currentJob?.status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "photo" | "signature") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear previous error for this field
    setValidationErrors((prev) => prev.filter((err) => err.field !== (type === "photo" ? "employee_photo" : "signature_image")));

    if (type === "photo") {
      // Send through the editor so every uploaded photo is normalized to the
      // standard EXPORT_W × EXPORT_H frame.
      setPhotoEditorSource(file);
    } else {
      // Same flow for signatures, normalized to SIGNATURE_W × SIGNATURE_H.
      setSignatureEditorSource(file);
    }
    // Reset the input so picking the same file again re-opens the editor
    e.target.value = "";
  };

  const handlePhotoEditorConfirm = (file: File, previewDataUrl: string) => {
    setEmployeePhoto(file);
    setEmployeePhotoPreview(previewDataUrl);
    setPhotoEditorSource(null);
  };

  const handleSignatureEditorConfirm = (file: File, previewDataUrl: string) => {
    setSignatureImage(file);
    setSignaturePreview(previewDataUrl);
    setSignatureEditorSource(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Auto-derive birth_year from birth_date so the validator passes
    // (birth_year is required by badgeMapping but isn't a visible form field)
    const dataForValidation = {
      ...formData,
      birth_year: calculateBirthYear(formData.birth_date),
    };

    // Validate form data using badgeMapping validation
    const fieldErrors = validateEmployeeFields(dataForValidation);
    const fileErrors = validateBadgeJobForm(formData, employeePhoto, signatureImage);
    const allErrors = [...fieldErrors, ...fileErrors];

    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      return;
    }
    setValidationErrors([]);

    if (!employeePhoto) return;

    setIsSubmitting(true);
    setIsUploading(true);

    try {
      // Mock mode
      if (isMockMode) {
        const birthYear = calculateBirthYear(formData.birth_date);
        const jobPayload: BadgeJobPayload = {
          template: "EmployeeID.psd",
          company_name: formData.company_name,
          issuer_code: formData.issuer_code,
          department: formData.department,
          // Worker/PSD output expects names swapped versus our form labels.
          // MRZ above is built from the un-swapped formData and is unaffected.
          first_name: formData.last_name,
          last_name: formData.first_name,
          doc_number: formData.doc_number,
          personal_number: formData.personal_number,
          valid_from: formData.valid_from,
          expires: formData.expires,
          birth_date: formData.birth_date,
          birth_year: birthYear,
          gender: formData.gender,
          height: formData.height,
          country_of_birth: formData.country_of_birth,
          city_of_birth: formData.city_of_birth,
          company_location: formData.company_location,
          country: formData.country,
          doc_type: formData.doc_type,
          nationality_code: formData.nationality_code,
          mrz: mrzString,
          export_format: formData.export_format as any,
          generate_mockups: formData.generate_mockups,
          assets: {
            employee_photo_path: "mock/photo.jpg",
            signature_image_path: signatureImage ? "mock/signature.png" : undefined,
          },
          meta: {
            created_from: "custom-tools/id-generator",
            intended_use: "internal_company_badge",
          },
        };

        const mockJob = createMockJob(jobPayload, "mock/photo.jpg", signatureImage ? "mock/signature.png" : "");
        setCurrentJob(mockJob);
        setIsSubmitting(false);
        setIsUploading(false);
        return;
      }

      // Real Supabase mode
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.");
      }

      // Upload employee photo
      const photoPath = generateStoragePath("temp", employeePhoto.name);
      const { error: photoError } = await supabase.storage
        .from("badge-inputs")
        .upload(photoPath, employeePhoto);

      if (photoError) throw new Error(`Failed to upload employee photo: ${photoError.message}`);

      // Upload signature if provided
      let signaturePath = "";
      if (signatureImage) {
        signaturePath = generateStoragePath("temp", signatureImage.name);
        const { error: sigError } = await supabase.storage
          .from("badge-inputs")
          .upload(signaturePath, signatureImage);

        if (sigError) throw new Error(`Failed to upload signature: ${sigError.message}`);
      }

      setIsUploading(false);

      // Calculate birth year from birth date
      const birthYear = calculateBirthYear(formData.birth_date);

      // Create job payload using Internal Employee Badge Studio data model
      const jobPayload: BadgeJobPayload = {
        template: "EmployeeID.psd",
        // Country + document type — drives MRZ tool selection (TD1 vs TD3)
        country: formData.country,
        doc_type: formData.doc_type,
        nationality_code: formData.nationality_code,
        // MRZ — built by src/lib/mrz.ts buildTD1/buildTD3 based on country & doc_type
        mrz: mrzString,
        // Company fields
        company_name: formData.company_name,
        issuer_code: formData.issuer_code,
        department: formData.department,
        // Employee fields — names swapped for the worker/PSD output.
        // MRZ above is built from the un-swapped formData and is unaffected.
        first_name: formData.last_name,
        last_name: formData.first_name,
        doc_number: formData.doc_number,
        personal_number: formData.personal_number,
        // Validity fields
        valid_from: formData.valid_from,
        expires: formData.expires,
        // Personal info fields
        birth_date: formData.birth_date,
        birth_year: birthYear,
        gender: formData.gender,
        height: formData.height,
        country_of_birth: formData.country_of_birth,
        city_of_birth: formData.city_of_birth,
        company_location: formData.company_location,
        // Export format
        export_format: formData.export_format as any,
        // Mockup generation
        generate_mockups: formData.generate_mockups,
        // Assets
        assets: {
          employee_photo_path: photoPath,
          signature_image_path: signaturePath || undefined,
        },
        // Metadata
        meta: {
          created_from: "custom-tools/id-generator",
          intended_use: "internal_company_badge",
        },
      };

      // Create job in database
      const { data, error } = await supabase
        .from("badge_jobs")
        .insert({
          status: "queued",
          template: "EmployeeID.psd",
          input_json: jobPayload,
          employee_photo_path: photoPath,
          signature_image_path: signaturePath || null,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create job: ${error.message}`);

      setCurrentJob(data as BadgeJob);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to create job");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      company_name: "",
      issuer_code: "",
      department: "",
      first_name: "",
      last_name: "",
      doc_number: "",
      personal_number: "",
      valid_from: "",
      expires: "",
      birth_date: "",
      gender: "",
      height: "",
      country_of_birth: "",
      city_of_birth: "",
      company_location: "",
      export_format: "png",
      generate_mockups: false,
    });
    setEmployeePhoto(null);
    setSignatureImage(null);
    setEmployeePhotoPreview("");
    setSignaturePreview("");
    setCurrentJob(null);
    setValidationErrors([]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadJobs();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRetry = async (job: BadgeJob) => {
    if (isMockMode) {
      const retryJob = createMockJob(
        job.input_json,
        job.employee_photo_path,
        job.signature_image_path || ""
      );
      setCurrentJob(retryJob);
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;

    try {
      // Create a new job with the same payload
      const { data, error } = await supabase
        .from("badge_jobs")
        .insert({
          status: "queued",
          template: job.template,
          input_json: job.input_json,
          employee_photo_path: job.employee_photo_path,
          signature_image_path: job.signature_image_path,
        })
        .select()
        .single();

      if (!error && data) {
        setCurrentJob(data as BadgeJob);
      }
    } catch {
      alert("Failed to retry job");
    }
  };

  const downloadResult = async (path: string) => {
    if (isMockMode) {
      alert("Mock mode: Would download file from " + path);
      return;
    }

    if (!isSupabaseConfigured || !supabase) return;

    try {
      if (path.endsWith(".manifest.json")) {
        await downloadMultipartPsd(path);
        return;
      }

      const { data, error } = await supabase.storage
        .from("badge-outputs")
        .createSignedUrl(path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error) {
      console.error(error);
      alert("Failed to download result");
    }
  };

  const downloadMultipartPsd = async (manifestPath: string) => {
    if (!supabase) return;
    setDownloadingPath(manifestPath);
    setDownloadProgressText("Preparing PSD download...");

    try {
      const { data: manifestBlob, error: manifestError } = await supabase.storage
        .from("badge-outputs")
        .download(manifestPath);

      if (manifestError) throw manifestError;
      if (!manifestBlob) throw new Error("Manifest was empty");

      const manifest = JSON.parse(await manifestBlob.text());

      if (manifest.type !== "multipart-psd" || !Array.isArray(manifest.parts)) {
        throw new Error("Invalid PSD manifest");
      }

      const parts = [...manifest.parts].sort((a: any, b: any) => a.index - b.index);
      const chunks: Uint8Array[] = [];

      for (let i = 0; i < parts.length; i++) {
        setDownloadProgressText(`Downloading PSD part ${i + 1} of ${parts.length}...`);

        const { data: partBlob, error: partError } = await supabase.storage
          .from("badge-outputs")
          .download(parts[i].path);

        if (partError) throw partError;
        if (!partBlob) throw new Error(`Part was empty: ${parts[i].path}`);

        chunks.push(new Uint8Array(await partBlob.arrayBuffer()));
      }

      setDownloadProgressText("Building PSD file...");

      const blob = new Blob(chunks.map((chunk) => chunk.slice()), {
        type: manifest.contentType || "application/octet-stream",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = manifest.fileName || "result.psd";
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      alert("Failed to download PSD parts. Please refresh and try again.");
    } finally {
      setDownloadingPath(null);
      setDownloadProgressText("");
    }
  };

  const getFieldError = (field: string) => {
    return validationErrors.find((err) => err.field === field)?.message;
  };

  // Country preset drives issuer code, gender options, personal-number generator,
  // expiry cap, and the MRZ layout (TD1 for ID cards, TD3 for passports).
  const [formMode, setFormMode] = useState<"simple" | "advanced">("simple");
  const CITY_OPTIONS = ["Rotterdam", "Amsterdam", "Zoetermeer"];

  const preset = getCountryPreset(formData.country);
  const personalNumberError =
    formData.personal_number && preset.personalNumber.validate(formData.personal_number);
  // Under-18-on-issue rule: NL & DE both cap minor documents at 5 years.
  const effectiveValidityYears = validityYearsForHolder(
    formData.birth_date,
    formData.valid_from,
    preset.maxValidityYears,
  );
  const expiryClamp = clampExpiry(
    formData.valid_from,
    formData.expires,
    effectiveValidityYears,
  );

  const applyCountry = (next: CountryCode) => {
    const p = COUNTRY_PRESETS[next];
    setFormData((prev) => ({
      ...prev,
      country: next,
      doc_type: p.supportedDocTypes.includes(prev.doc_type as DocType)
        ? prev.doc_type
        : p.defaultDocType,
      issuer_code: p.issuerCode,
      nationality_code: p.nationalityCode,
      country_of_birth: p.nationalityDemonym || prev.country_of_birth,
      personal_number: "",
      gender: p.genderOptions[0].value,
      expires:
        prev.valid_from && !prev.expires
          ? defaultExpiry(
              prev.valid_from,
              validityYearsForHolder(prev.birth_date, prev.valid_from, p.maxValidityYears),
            )
          : prev.expires,
    }));
  };

  const applyDocType = (next: DocType) => {
    setFormData((prev) => ({ ...prev, doc_type: next }));
  };

  return (
    <div className="max-w-7xl mx-auto">
      {photoEditorSource && (
        <PhotoEditor
          sourceFile={photoEditorSource}
          onConfirm={handlePhotoEditorConfirm}
          onCancel={() => setPhotoEditorSource(null)}
          background="transparent"
          overlayImageSrc={selfieOverlayUrl}
          title="Position employee photo"
        />
      )}
      {signatureEditorSource && (
        <PhotoEditor
          sourceFile={signatureEditorSource}
          onConfirm={handleSignatureEditorConfirm}
          onCancel={() => setSignatureEditorSource(null)}
          exportWidth={SIGNATURE_W}
          exportHeight={SIGNATURE_H}
          background="transparent"
          bgRemoval="luminance"
          title="Position signature"
        />
      )}
      <div className="text-center mb-8">
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          Identity document Generator
        </h1>
        <p className="text-white/55 mt-3 max-w-xl mx-auto">
          Generate high quality realistic ID cards and mockups
        </p>
      </div>

      {/* Connection Status */}
      <div className="mb-6 flex justify-center flex-wrap gap-2">
        {(() => {
          const supabaseTone = isSupabaseConfigured
            ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-300"
            : "border-rose-300/30 bg-rose-300/10 text-rose-300";
          const supabaseDot = isSupabaseConfigured ? "bg-emerald-300" : "bg-rose-300";

          let workerTone = "border-amber-300/30 bg-amber-300/10 text-amber-300";
          let workerDot = "bg-amber-300 animate-pulse";
          let workerLabel: React.ReactNode = "Checking worker…";
          if (isMockMode) {
            workerTone = "border-blue-300/30 bg-blue-300/10 text-blue-300";
            workerDot = "bg-blue-300";
            workerLabel = "Mock worker (dev mode)";
          } else if (!isSupabaseConfigured) {
            workerTone = "border-rose-300/30 bg-rose-300/10 text-rose-300";
            workerDot = "bg-rose-300";
            workerLabel = "Worker unknown — Supabase not configured";
          } else if (!workerChecked) {
            // keep default "checking" state
          } else if (workerOnline) {
            workerTone = "border-emerald-300/30 bg-emerald-300/10 text-emerald-300";
            workerDot = "bg-emerald-300";
            workerLabel = (
              <>
                Local Photoshop worker online
                {workerInfo && <span className="text-white/50 ml-1">({workerInfo.worker_id})</span>}
              </>
            );
          } else {
            workerTone = "border-rose-300/30 bg-rose-300/10 text-rose-300";
            workerDot = "bg-rose-300";
            workerLabel = "Local Photoshop worker offline";
          }

          const bothOnline =
            (isSupabaseConfigured || isMockMode) &&
            (isMockMode || (workerChecked && workerOnline));

          if (bothOnline) {
            return (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 text-emerald-300 text-xs">
                <span className="relative inline-flex w-2.5 h-2.5">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-300/60 animate-ping" />
                  <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.7)]" />
                </span>
                All systems online
              </div>
            );
          }

          return (
            <>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${supabaseTone}`}>
                <div className={`w-2 h-2 rounded-full ${supabaseDot}`} />
                {isSupabaseConfigured ? "Supabase connected" : "Supabase not configured"}
              </div>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${workerTone}`}>
                <div className={`w-2 h-2 rounded-full ${workerDot}`} />
                {workerLabel}
              </div>
            </>
          );
        })()}
      </div>

      {/* Configuration Warning */}
      {!isSupabaseConfigured && !isMockMode && (
        <div className="mb-6 rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-300 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium mb-1">Supabase Not Configured</div>
              <div className="text-amber-300/80 text-xs">
                Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, or set VITE_MOCK_ID_GENERATOR=true for development mode. See SUPABASE_SETUP.md for details.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mock Mode Banner */}
      {isMockMode && (
        <div className="mb-6 rounded-xl border border-blue-300/30 bg-blue-300/10 p-4 text-blue-300 text-sm">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium mb-1">Development Mock Mode</div>
              <div className="text-blue-300/80 text-xs">
                Jobs are simulated locally. No Supabase connection required. Remove VITE_MOCK_ID_GENERATOR for production.
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: Input Form */}
        <div className="glass p-6">
          <h2 className="text-white text-xl tracking-tight mb-1">Document Details</h2>
          <p className="text-white/50 text-xs mb-4">Fill in your personal information</p>

          <ProfilesBar formData={formData} onLoad={(d) => setFormData({ ...formData, ...d })} />

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Country & Document Section */}
            <div className="border-t border-white/10 pt-4 mt-4 relative">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-white/70 text-xs uppercase tracking-wider">
                  Country &amp; Document
                </h3>
                <DocRulesInfoButton
                  country={formData.country}
                  family={
                    formData.doc_type === "passport"
                      ? "passport"
                      : formData.doc_type === "driving_licence"
                      ? "driving_licence"
                      : "identity_card"
                  }
                  issueDate={formData.valid_from}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 text-xs mb-1.5">Country *</label>
                  <select
                    value={formData.country}
                    onChange={(e) => applyCountry(e.target.value as CountryCode)}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                  >
                    {COUNTRY_LIST.map((c) => (
                      <option key={c} value={c}>
                        {COUNTRY_PRESETS[c].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-white/70 text-xs mb-1.5">Document Type *</label>
                  <select
                    value={formData.doc_type}
                    onChange={(e) => applyDocType(e.target.value as DocType)}
                    className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                  >
                    {preset.supportedDocTypes.map((t) => (
                      <option key={t} value={t}>
                        {docTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {formData.country === "OTHER" ? (
                <>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Field
                      label="Issuer Code *"
                      value={formData.issuer_code}
                      onChange={(v) =>
                        setFormData({ ...formData, issuer_code: v.toUpperCase() })
                      }
                      placeholder="UTO"
                    />
                    <Field
                      label="Nationality Code *"
                      value={formData.nationality_code}
                      onChange={(v) =>
                        setFormData({ ...formData, nationality_code: v.toUpperCase() })
                      }
                      placeholder="UTO"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-white/70 text-xs mb-1.5">MRZ Format</label>
                      <select
                        value={formData.mrz_format}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mrz_format: e.target.value as "auto" | "td1" | "td3",
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                      >
                        <option value="auto">Auto (from doc type)</option>
                        <option value="td1">TD1 — 3 × 30 (ID card)</option>
                        <option value="td3">TD3 — 2 × 44 (passport)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/70 text-xs mb-1.5">Calculation Method</label>
                      <select
                        value={formData.mrz_method}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            mrz_method: e.target.value as
                              | "icao9303"
                              | "icao_strict"
                              | "none",
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                      >
                        <option value="icao9303">ICAO 9303 (7-3-1 mod 10)</option>
                        <option value="icao_strict">ICAO 9303 strict (0 never → &lt;)</option>
                        <option value="none">No check digits (raw)</option>
                      </select>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* View toggle + live MRZ preview */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <div className="flex items-center gap-3 mb-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={formMode === "advanced"}
                  aria-label="Toggle view mode"
                  onClick={() => setFormMode(formMode === "simple" ? "advanced" : "simple")}
                  className="relative shrink-0 flex items-center h-8 w-[140px] rounded-full bg-black/40 border border-white/10 p-0.5 cursor-pointer select-none"
                >
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-white transition-transform duration-200 ease-out"
                    style={{
                      width: "calc(50% - 2px)",
                      transform:
                        formMode === "advanced" ? "translateX(100%)" : "translateX(0)",
                    }}
                  />
                  <span
                    className={`relative z-10 w-1/2 text-center text-[10px] mono uppercase tracking-[0.16em] transition-colors ${
                      formMode === "simple" ? "text-black" : "text-white/65"
                    }`}
                  >
                    Simple
                  </span>
                  <span
                    className={`relative z-10 w-1/2 text-center text-[10px] mono uppercase tracking-[0.16em] transition-colors ${
                      formMode === "advanced" ? "text-black" : "text-white/65"
                    }`}
                  >
                    Dev
                  </span>
                </button>
                <span className="text-white/45 text-[10px] mono uppercase tracking-[0.16em]">
                  MRZ · {mrzResult.label}
                </span>
              </div>
              <pre
                ref={mrzPreRef}
                className="block w-full max-w-full min-w-0 leading-[1.5] mono text-white/85 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 overflow-hidden whitespace-pre"
                style={{ fontSize: `${mrzFontSize}px` }}
              >
{mrzString}
              </pre>
            </div>

            {/* Employee Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-white/70 text-xs mb-3 uppercase tracking-wider">Personal Information</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="First Name *"
                    value={formData.first_name}
                    onChange={(v) => setFormData({ ...formData, first_name: v })}
                    placeholder="Mila"
                    error={getFieldError("first_name")}
                  />
                  <Field
                    label="Last Name *"
                    value={formData.last_name}
                    onChange={(v) => setFormData({ ...formData, last_name: v })}
                    placeholder="De Vries"
                    error={getFieldError("last_name")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Doc Number *"
                    value={formData.doc_number}
                    onChange={(v) => setFormData({ ...formData, doc_number: v })}
                    placeholder="AB12C34D5"
                    error={getFieldError("doc_number")}
                    status={
                      formData.doc_number
                        ? isValidDocNumber(
                            formData.doc_number,
                            formData.valid_from,
                            formData.doc_type,
                            formData.country,
                          )
                          ? "ok"
                          : "err"
                        : null
                    }
                    onGenerate={() =>
                      setFormData({
                        ...formData,
                        doc_number: generateDocNumber(
                          formData.valid_from,
                          formData.doc_type,
                          formData.country,
                        ),
                      })
                    }
                    generateTitle={
                      formData.country === "DE"
                        ? "Generate valid 9-char number (Bundesdruckerei rules, ICAO mod-10)"
                        : "Generate valid 9-char number (RvIG rules for the chosen issue date)"
                    }
                  />
                  <Field
                    label={`${preset.personalNumber.label} *`}
                    value={formData.personal_number}
                    onChange={(v) => setFormData({ ...formData, personal_number: v })}
                    placeholder={preset.personalNumber.placeholder}
                    status={
                      formData.personal_number
                        ? personalNumberError
                          ? "err"
                          : "ok"
                        : null
                    }
                    onGenerate={() =>
                      setFormData({
                        ...formData,
                        personal_number: preset.personalNumber.generate(),
                      })
                    }
                    generateTitle={`Generate a valid ${preset.personalNumber.label}`}
                  />
                </div>
              </div>
            </div>

            {/* Validity Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-white/70 text-xs mb-3 uppercase tracking-wider">Validity Period</h3>
              {formMode === "simple" ? (
                <div className="min-w-0">
                  <label className="block text-white/70 text-xs mb-1.5">Issue Date *</label>
                  <input
                    type="date"
                    value={formData.valid_from}
                    onChange={(e) => {
                      const v = e.target.value;
                      const years = validityYearsForHolder(
                        formData.birth_date,
                        v,
                        preset.maxValidityYears,
                      );
                      setFormData({
                        ...formData,
                        valid_from: v,
                        expires: defaultExpiry(v, years),
                      });
                    }}
                    className="block w-full max-w-full min-w-0 appearance-none px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                    style={{ WebkitAppearance: "none", fontSize: 16 }}
                  />
                  <div className="text-[11px] text-white/45 mono mt-1.5">
                    Expires{" "}
                    <span className="text-white/75">
                      {formData.expires || "—"}
                    </span>{" "}
                    (auto · +{effectiveValidityYears}y
                    {effectiveValidityYears !== preset.maxValidityYears
                      ? " · under 18 on issue"
                      : ""}
                    )
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-white/70 text-xs mb-1.5">
                      Valid From *
                      {getFieldError("valid_from") && <span className="text-rose-300 ml-2">• {getFieldError("valid_from")}</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      className={`block w-full max-w-full min-w-0 appearance-none px-3 py-2 rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 ${
                        getFieldError("valid_from") ? "border-rose-300/50" : "border-white/10"
                      }`}
                      style={{ WebkitAppearance: "none", fontSize: 16 }}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-white/70 text-xs mb-1.5">
                      Expires *
                      {getFieldError("expires") && <span className="text-rose-300 ml-2">• {getFieldError("expires")}</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.expires}
                      onChange={(e) => setFormData({ ...formData, expires: e.target.value })}
                      className={`block w-full max-w-full min-w-0 appearance-none px-3 py-2 rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 ${
                        getFieldError("expires") ? "border-rose-300/50" : "border-white/10"
                      }`}
                      style={{ WebkitAppearance: "none", fontSize: 16 }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Personal Information Section */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-white/70 text-xs mb-3 uppercase tracking-wider">Personal Information</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <label className="block text-white/70 text-xs mb-1.5">
                      Birth Date *
                      {getFieldError("birth_date") && <span className="text-rose-300 ml-2">• {getFieldError("birth_date")}</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => {
                        const v = e.target.value;
                        // In simple mode the expiry tracks the issue date and the
                        // under-18-on-issue rule, so keep it in sync when birth changes.
                        const years = validityYearsForHolder(
                          v,
                          formData.valid_from,
                          preset.maxValidityYears,
                        );
                        setFormData({
                          ...formData,
                          birth_date: v,
                          expires:
                            formMode === "simple" && formData.valid_from
                              ? defaultExpiry(formData.valid_from, years)
                              : formData.expires,
                        });
                      }}
                      className={`block w-full max-w-full min-w-0 appearance-none px-3 py-2 rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 ${
                        getFieldError("birth_date") ? "border-rose-300/50" : "border-white/10"
                      }`}
                      style={{ WebkitAppearance: "none", fontSize: 16 }}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-white/70 text-xs mb-1.5">
                      Gender *
                      {getFieldError("gender") && <span className="text-rose-300 ml-2">• {getFieldError("gender")}</span>}
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      className={`block w-full max-w-full min-w-0 appearance-none px-3 py-2 rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 ${
                        getFieldError("gender") ? "border-rose-300/50" : "border-white/10"
                      }`}
                      style={{ WebkitAppearance: "none", fontSize: 16, backgroundImage: "none" }}
                    >
                      <option value="">Select gender</option>
                      {preset.genderOptions.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {formMode === "simple" ? (
                  <div>
                    <label className="block text-white/70 text-xs mb-1.5">City *</label>
                    <select
                      value={formData.city_of_birth}
                      onChange={(e) => {
                        const v = e.target.value;
                        setFormData({
                          ...formData,
                          city_of_birth: v,
                          company_location: v ? `Burg. van ${v}` : "",
                        });
                      }}
                      className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                    >
                      <option value="">Select city</option>
                      {CITY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-white/70 text-xs">
                            Height
                            {getFieldError("height") && (
                              <span className="text-rose-300 ml-2">• {getFieldError("height")}</span>
                            )}
                          </label>
                          <span className="text-white/80 text-xs mono">
                            {formatHeightMeters(parseHeightCm(formData.height))}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={140}
                          max={210}
                          step={1}
                          value={parseHeightCm(formData.height)}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              height: formatHeightMeters(parseInt(e.target.value, 10)),
                            })
                          }
                          className="w-full accent-white/80"
                        />
                        <div className="flex justify-between text-[10px] text-white/40 mono mt-1">
                          <span>1,40 m</span>
                          <span>2,10 m</span>
                        </div>
                      </div>
                      <Field
                        label="Company Location"
                        value={formData.company_location}
                        onChange={(v) => setFormData({ ...formData, company_location: v })}
                        placeholder="Burg. van Zoetermeer"
                        error={getFieldError("company_location")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Country of Birth"
                        value={formData.country_of_birth}
                        onChange={(v) => setFormData({ ...formData, country_of_birth: v })}
                        placeholder="Nederlandse"
                        error={getFieldError("country_of_birth")}
                      />
                      <Field
                        label="City of Birth"
                        value={formData.city_of_birth}
                        onChange={(v) => setFormData({ ...formData, city_of_birth: v })}
                        placeholder="Zoetermeer"
                        error={getFieldError("city_of_birth")}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-white/70 text-xs mb-3 uppercase tracking-wider">Uploads</h3>

              {/* Employee Photo */}
              <div className="mb-4">
                <label className="block text-white/70 text-xs mb-1.5">
                  Employee Photo * (PNG, JPG, WebP, max 10MB)
                  {getFieldError("employee_photo") && <span className="text-rose-300 ml-2">• {getFieldError("employee_photo")}</span>}
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => handleFileChange(e, "photo")}
                  className={`w-full px-3 py-2 rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-white/10 file:text-white/70 file:text-xs ${
                    getFieldError("employee_photo") ? "border-rose-300/50" : "border-white/10"
                  }`}
                />
                {employeePhotoPreview && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={employeePhotoPreview}
                      alt="Employee photo preview"
                      className="h-24 w-24 object-cover rounded-lg border border-white/10"
                    />
                    <div className="text-xs text-white/50">
                      {employeePhoto && (
                        <>
                          <div>{employeePhoto.name}</div>
                          <div>{(employeePhoto.size / 1024 / 1024).toFixed(2)} MB</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Signature */}
              <div>
                <label className="block text-white/70 text-xs mb-1.5">
                  Signature Image (PNG, JPG, WebP, max 10MB)
                  {getFieldError("signature_image") && <span className="text-rose-300 ml-2">• {getFieldError("signature_image")}</span>}
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => handleFileChange(e, "signature")}
                  className={`w-full px-3 py-2 rounded-lg bg-black/40 border text-white text-sm focus:outline-none focus:border-white/30 file:mr-3 file:px-3 file:py-1 file:rounded file:border-0 file:bg-white/10 file:text-white/70 file:text-xs ${
                    getFieldError("signature_image") ? "border-rose-300/50" : "border-white/10"
                  }`}
                />
                {signaturePreview && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={signaturePreview}
                      alt="Signature preview"
                      className="h-16 rounded-lg border border-white/10 bg-white p-2"
                    />
                    <div className="text-xs text-white/50">
                      {signatureImage && (
                        <>
                          <div>{signatureImage.name}</div>
                          <div>{(signatureImage.size / 1024 / 1024).toFixed(2)} MB</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <SignatureGenerator
                  defaultName={(() => {
                    // Use only WHOLE name parts that fit in 10 characters total
                    // (spaces included). "Hans Tak" -> "Hans Tak" (8). "Johanathan
                    // Fredricus" -> "Johanathan" (10) — the surname would push
                    // past the limit so it's dropped. If the first part alone is
                    // already over the limit, we still keep it intact rather
                    // than truncating mid-name.
                    const parts = [formData.first_name, formData.last_name]
                      .map((s) => (s || "").trim())
                      .filter(Boolean);
                    const out: string[] = [];
                    for (const p of parts) {
                      const next = out.length ? out.join(" ") + " " + p : p;
                      if (out.length === 0 || next.length <= 10) out.push(p);
                      else break;
                    }
                    return out.join(" ");
                  })()}
                  onUse={(file, dataUrl) => {
                    setSignatureImage(file);
                    setSignaturePreview(dataUrl);
                    setValidationErrors((prev) => prev.filter((err) => err.field !== "signature_image"));
                  }}
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 mt-4">
              <h3 className="text-white/70 text-xs mb-3 uppercase tracking-wider">Export Settings</h3>
              <div>
                <label className="block text-white/70 text-xs mb-1.5">Export Format *</label>
                <select
                  value={formData.export_format}
                  onChange={(e) => setFormData({ ...formData, export_format: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
                >
                  <option value="png">PNG (Recommended)</option>
                  <option value="pdf">PDF</option>
                  <option value="psd">PSD (Source File)</option>
                </select>
              </div>
              <motion.button
                type="button"
                onClick={() =>
                  setFormData({ ...formData, generate_mockups: !formData.generate_mockups })
                }
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.99 }}
                aria-pressed={formData.generate_mockups}
                className="glass group relative w-full overflow-hidden text-left p-5 sm:p-6 mt-3"
                style={{ isolation: "isolate" }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 overflow-hidden z-0"
                  style={{ borderRadius: "inherit" }}
                >
                  <div
                    className="id-cta-scanner absolute top-0 left-0 h-full w-[26%]"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.22) 55%, transparent 100%)",
                      filter: "blur(2px)",
                    }}
                  />
                </div>
                <div className="relative z-10 flex items-center gap-4">
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl grid place-items-center text-white border border-white/25"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 12px -4px rgba(0,0,0,0.35)",
                    }}
                  >
                    <Images className="w-5 h-5" strokeWidth={1.6} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-base sm:text-lg tracking-tight">
                        Generate mockup images
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] mono uppercase tracking-[0.14em] text-white/75">
                        Recommended
                      </span>
                    </div>
                    <p className="text-white/65 text-xs sm:text-sm mt-0.5">
                      Produce 3 photorealistic mockup images alongside the ID — perfect for
                      verification & approvals.
                    </p>
                  </div>
                  <div
                    className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${
                      formData.generate_mockups ? "bg-white" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                        formData.generate_mockups
                          ? "left-[1.125rem] bg-black"
                          : "left-0.5 bg-white/80"
                      }`}
                    />
                  </div>
                </div>
              </motion.button>
            </div>

            <div className="flex gap-3 pt-4">
              <PrimaryButton type="submit" disabled={isSubmitting || (!isSupabaseConfigured && !isMockMode)}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isUploading ? "Uploading..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Badge className="w-4 h-4" />
                    Generate ID
                  </>
                )}
              </PrimaryButton>
            </div>

            {!workerOnline && (
              <div className="text-xs text-amber-300/80 mt-3">
                Note: Job will be queued until the local Photoshop worker comes online.
              </div>
            )}
          </form>
        </div>

        {/* Right Panel: Job Status */}
        <div className="glass p-6">
          <h2 className="text-white text-xl tracking-tight mb-1">Job Status</h2>
          <p className="text-white/50 text-xs mb-5">Track the progress of your badge generation</p>

          {!currentJob ? (
            <div className="text-center py-12 text-white/40">
              <Badge className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No active job</p>
              <p className="text-xs mt-1">Fill the form and click Generate Badge to start</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status Indicator */}
              <div
                className={`rounded-xl border p-4 ${
                  currentJob.status === "complete"
                    ? "border-emerald-300/30 bg-emerald-300/10"
                    : currentJob.status === "failed"
                    ? "border-rose-300/30 bg-rose-300/10"
                    : currentJob.status === "processing"
                    ? "border-blue-300/30 bg-blue-300/10"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {currentJob.status === "queued" && <Clock className="w-5 h-5 text-white/70" />}
                  {currentJob.status === "processing" && <Loader2 className="w-5 h-5 text-blue-300 animate-spin" />}
                  {currentJob.status === "complete" && <CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                  {currentJob.status === "failed" && <AlertCircle className="w-5 h-5 text-rose-300" />}
                  <div>
                    <div className="text-white text-sm font-medium">
                      {currentJob.status === "queued" && "Waiting for worker"}
                      {currentJob.status === "processing" && "Photoshop is generating badge"}
                      {currentJob.status === "complete" && "Badge output ready"}
                      {currentJob.status === "failed" && "Generation failed"}
                    </div>
                    <div className="text-white/50 text-xs mt-0.5">Job ID: {currentJob.id.slice(0, 8)}...</div>
                  </div>
                </div>

                {/* Job Details */}
                <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/60 space-y-1">
                  <div>Employee: {currentJob.input_json.employee_name}</div>
                  <div>ID: {currentJob.input_json.employee_id}</div>
                  <div>Format: {currentJob.input_json.export_format.toUpperCase()}</div>
                  <div>Created: {new Date(currentJob.created_at).toLocaleString()}</div>
                  {currentJob.completed_at && <div>Completed: {new Date(currentJob.completed_at).toLocaleString()}</div>}
                </div>

                {/* Error Message */}
                {currentJob.status === "failed" && currentJob.error_message && (
                  <div className="mt-3 pt-3 border-t border-rose-300/30 text-xs text-rose-300">
                    <div className="font-medium mb-1">Error Details:</div>
                    <div className="text-rose-300/80">{currentJob.error_message}</div>
                  </div>
                )}

                {/* Multipart PSD download progress (Incoming items panel
                    triggers downloads but progress text lives here so it
                    doesn't disrupt the card grid layout). */}
                {downloadingPath && downloadProgressText && (
                  <div className="mt-3 text-xs text-white/60 px-1">{downloadProgressText}</div>
                )}
              </div>

              {/* Incoming items — expected outputs streamed in as the worker uploads them */}
              {currentJob.status !== "failed" && (
                <IncomingItems job={currentJob} onDownload={downloadResult} />
              )}

              {/* Retry Button */}
              {currentJob.status === "failed" && (
                <SecondaryButton onClick={() => handleRetry(currentJob)}>
                  <RotateCcw className="w-4 h-4" />
                  Retry Job
                </SecondaryButton>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Suggested tools — linear row spanning the full width below
          Document Details + Job status (on desktop they sit side by side,
          on mobile the job status panel is directly above). */}
      <div className="mt-6">
        <SuggestedToolsRow
          country={formData.country === "OTHER" ? "ALL" : formData.country}
          docType="ALL"
          onPick={(id) => onPickTool?.(id)}
        />
      </div>

      {/* Recent Jobs Table */}
      {recentJobs.length > 0 && (
        <div className="mt-8 glass p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-xl tracking-tight">Recent Jobs</h2>
              <p className="text-white/50 text-xs mt-0.5">View and manage your badge generation history</p>
            </div>
            <SecondaryButton onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </SecondaryButton>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-white/70 pb-2 pr-4 font-medium">Status</th>
                  <th className="text-left text-white/70 pb-2 pr-4 font-medium">Created</th>
                  <th className="text-left text-white/70 pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 pr-4">
                      {job.status === "complete" ? (
                        <span
                          title="complete"
                          aria-label="complete"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-300/10 text-emerald-300 border border-emerald-300/30"
                        >
                          <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </span>
                      ) : (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                            job.status === "failed"
                              ? "bg-rose-300/10 text-rose-300 border border-rose-300/30"
                              : job.status === "processing"
                              ? "bg-blue-300/10 text-blue-300 border border-blue-300/30"
                              : "bg-white/10 text-white/60 border border-white/10"
                          }`}
                        >
                          {job.status}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-white/60">
                      <div>{new Date(job.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-white/40">{new Date(job.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        {job.status === "complete" && job.output_png_path && (
                          <button
                            onClick={() => downloadResult(job.output_png_path!)}
                            className="text-xs text-white/70 hover:text-white underline"
                          >
                            Download
                          </button>
                        )}
                        {job.status === "complete" && job.output_mockup_1_path && (
                          <button
                            onClick={() => downloadResult(job.output_mockup_1_path!)}
                            className="text-xs text-white/70 hover:text-white underline"
                          >
                            Mockup 1
                          </button>
                        )}
                        {job.status === "complete" && job.output_mockup_2_path && (
                          <button
                            onClick={() => downloadResult(job.output_mockup_2_path!)}
                            className="text-xs text-white/70 hover:text-white underline"
                          >
                            Mockup 2
                          </button>
                        )}
                        {job.status === "complete" && job.output_mockup_3_path && (
                          <button
                            onClick={() => downloadResult(job.output_mockup_3_path!)}
                            className="text-xs text-white/70 hover:text-white underline"
                          >
                            Mockup 3
                          </button>
                        )}
                        {job.status === "failed" && (
                          <>
                            <button
                              onClick={() => setCurrentJob(job)}
                              className="text-xs text-white/70 hover:text-white underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleRetry(job)}
                              className="text-xs text-white/70 hover:text-white underline"
                            >
                              Retry
                            </button>
                          </>
                        )}
                        {job.status === "queued" || job.status === "processing" ? (
                          <button
                            onClick={() => setCurrentJob(job)}
                            className="text-xs text-white/70 hover:text-white underline"
                          >
                            View
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-3">
          {isMockMode && (
            <div className="text-white/40 text-[11px] mono uppercase tracking-[0.16em] hidden sm:block">
              mock mode · local simulation
            </div>
          )}
          <div className="relative group">
            <button
              type="button"
              aria-label="Usage disclaimer"
              className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-300 hover:bg-amber-300/20 transition-colors"
            >
              <Info className="w-4 h-4" strokeWidth={2} />
            </button>
            <div
              role="tooltip"
              className="pointer-events-none absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-amber-300/30 bg-[#1a1505] text-amber-200 text-[11px] leading-snug px-3 py-2 shadow-xl opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150"
            >
              For internal company badge use only. This tool does not create official identity documents.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
