import { useEffect, useState, type SyntheticEvent } from "react";
import { Loader2, Download, FileText, Layers, Image as ImageIcon, Check, ZoomIn, X, Wand2, Film, Sparkles, AlertCircle, Maximize2 } from "lucide-react";
import { supabase, isMockMode, isSupabaseConfigured } from "../../lib/supabase";
import type { BadgeJob } from "../../lib/supabase";
import { isLocalMode } from "../../lib/localApi";
import {
  DEFAULT_PRINT_DPI,
  PRINT_MARGIN_MAX_MM,
  PRINT_MARGIN_MIN_MM,
  PRINT_MARGIN_STEP_MM,
  clampPrintMarginMm,
  containPercent,
  downloadBlob,
  loadPrintMarginMm,
  marginPxFromMm,
  padImageWhiteBorderFromMm,
  pxToMm,
  savePrintMarginMm,
  type PrintMarginUnit,
} from "../../lib/print-margin";

/* ============================================================================
 * IncomingItems
 *
 * Renders expected output cards the moment a job is created. PNG jobs expose
 * Full Badge (EmployeeID result.png) plus two side cards (front / back) at
 * 2032:1276. Each mockup side is its own 9:16 card — back and front are no
 * longer paired inside a shared frame.
 *
 * PNG badge cards share a Print margin slider (white edge / bleed pad). The
 * pad is applied client-side at preview + download; the Photoshop worker is
 * not re-run. Mockups / PDF / PSD are unchanged.
 * ========================================================================== */

const BADGE_SIDE_RATIO = 2032 / 1276;
const FULL_BADGE_RATIO = 4108 / 1276;
const MOCKUP_ASPECT = 9 / 16;
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];

type FileSlot = {
  path: string | null;
  kind: "image" | "file";
  fileLabel?: string;
};

type Card = {
  key: string;
  label: string;
  aspect: number;
  variant: "badge" | "mockup";
  slot: FileSlot;
};

function extOf(path: string): string {
  if (path.endsWith(".manifest.json")) return "psd";
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function isImagePath(path: string): boolean {
  return IMAGE_EXTS.includes(extOf(path));
}

function buildCards(job: BadgeJob): Card[] {
  const cards: Card[] = [];
  const format = job.input_json.export_format;

  if (format === "png") {
    cards.push({
      key: "full-badge",
      label: "Full Badge",
      aspect: FULL_BADGE_RATIO,
      variant: "badge",
      slot: { path: job.output_full_png_path ?? job.output_png_path, kind: "image" },
    });
    cards.push({
      key: "badge-front",
      label: "Badge front",
      aspect: BADGE_SIDE_RATIO,
      variant: "badge",
      slot: { path: job.output_front_png_path, kind: "image" },
    });
    cards.push({
      key: "badge-back",
      label: "Badge back",
      aspect: BADGE_SIDE_RATIO,
      variant: "badge",
      slot: { path: job.output_back_png_path, kind: "image" },
    });
  } else if (format === "pdf") {
    cards.push({
      key: "badge",
      label: "Badge · PDF",
      aspect: BADGE_SIDE_RATIO,
      variant: "badge",
      slot: { path: job.output_pdf_path, kind: "file", fileLabel: "PDF" },
    });
  } else if (format === "psd") {
    cards.push({
      key: "badge",
      label: "Badge · PSD",
      aspect: BADGE_SIDE_RATIO,
      variant: "badge",
      slot: { path: job.output_psd_path, kind: "file", fileLabel: "PSD" },
    });
  }

  if (job.input_json.generate_mockups) {
    for (const n of [1, 2, 3] as const) {
      const backPath = (job as any)[`output_mockup_${n}_back_path`] as string | null;
      const frontPath = (job as any)[`output_mockup_${n}_front_path`] as string | null;
      const legacyPath = (job as any)[`output_mockup_${n}_path`] as string | null;
      cards.push({
        key: `m${n}-front`,
        label: `Mockup ${n} · Front`,
        aspect: MOCKUP_ASPECT,
        variant: "mockup",
        slot: { path: frontPath ?? legacyPath, kind: "image" },
      });
      cards.push({
        key: `m${n}-back`,
        label: `Mockup ${n} · Back`,
        aspect: MOCKUP_ASPECT,
        variant: "mockup",
        slot: { path: backPath, kind: "image" },
      });
    }
  }

  return cards;
}

function collectSlots(cards: Card[]): FileSlot[] {
  return cards.map((c) => c.slot);
}

function useSignedUrl(path: string | null): { url: string | null; errored: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setErrored(false);
    if (!path) return;
    if (path.startsWith("mock/")) return;
    if (path.startsWith("/api/") || path.startsWith("http://") || path.startsWith("https://")) {
      setUrl(path);
      return;
    }
    if (isLocalMode) return;
    if (!supabase) return;

    (async () => {
      const { data, error } = await supabase!.storage
        .from("badge-outputs")
        .createSignedUrl(path, 300);
      if (!alive) return;
      if (error || !data?.signedUrl) {
        setErrored(true);
        return;
      }
      setUrl(data.signedUrl);
    })();

    return () => {
      alive = false;
    };
  }, [path]);

  return { url, errored };
}

type ZoomTarget = {
  url: string;
  applyPrintMargin: boolean;
  natW: number;
  natH: number;
};

function SignedPreview({
  path,
  onDownload,
  onZoom,
  onEdit,
  applyPrintMargin = false,
  printMarginMm = 0,
}: {
  path: string;
  onDownload: () => void;
  onZoom: (target: ZoomTarget) => void;
  onEdit?: (url: string) => void;
  applyPrintMargin?: boolean;
  printMarginMm?: number;
}) {
  const { url, errored } = useSignedUrl(path);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [dlBusy, setDlBusy] = useState(false);

  const marginPx = applyPrintMargin ? marginPxFromMm(printMarginMm) : 0;

  const handleImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.naturalWidth && el.naturalHeight) {
      setNat({ w: el.naturalWidth, h: el.naturalHeight });
    }
  };

  const handleDownload = async () => {
    if (!applyPrintMargin || printMarginMm <= 0 || !url) {
      onDownload();
      return;
    }
    setDlBusy(true);
    try {
      const blob = await padImageWhiteBorderFromMm(url, printMarginMm);
      const name = decodeURIComponent(path.split("/").pop() || "badge.png");
      downloadBlob(blob, name);
    } catch (err) {
      console.error(err);
      onDownload();
    } finally {
      setDlBusy(false);
    }
  };

  if (errored) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-rose-300/70 text-[10px]">
        Preview unavailable
      </div>
    );
  }

  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white/[0.04]">
        <div className="text-white/40 text-[9px] mono uppercase tracking-[0.18em] flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          Decoding
        </div>
      </div>
    );
  }

  const showPad = marginPx > 0 && nat && nat.w > 0 && nat.h > 0;
  const outW = showPad ? nat!.w + 2 * marginPx : 0;
  const outH = showPad ? nat!.h + 2 * marginPx : 0;
  const fit = showPad ? containPercent(outW / outH, nat!.w / nat!.h) : null;

  return (
    <>
      {showPad && fit ? (
        <div className="absolute inset-0 print-margin-checker">
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative bg-white"
              style={{
                aspectRatio: `${outW} / ${outH}`,
                width: `${fit.widthPct}%`,
                height: `${fit.heightPct}%`,
              }}
            >
              <img
                src={url}
                alt=""
                onLoad={handleImgLoad}
                className="absolute"
                style={{
                  left: `${(marginPx / outW) * 100}%`,
                  top: `${(marginPx / outH) * 100}%`,
                  width: `${(nat!.w / outW) * 100}%`,
                  height: `${(nat!.h / outH) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <img
          src={url}
          alt=""
          onLoad={handleImgLoad}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <button
        type="button"
        onClick={() =>
          onZoom({
            url,
            applyPrintMargin,
            natW: nat?.w ?? 0,
            natH: nat?.h ?? 0,
          })
        }
        title="Zoom"
        aria-label="Zoom"
        className="absolute top-2 left-2 z-20 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/55 border border-white/15 text-white/85 hover:text-white hover:bg-black/75 backdrop-blur-md transition-colors"
      >
        <ZoomIn className="w-4 h-4" strokeWidth={1.8} />
      </button>
      <button
        type="button"
        onClick={handleDownload}
        disabled={dlBusy}
        title={applyPrintMargin && printMarginMm > 0 ? "Download for print" : "Download"}
        aria-label={applyPrintMargin && printMarginMm > 0 ? "Download for print" : "Download"}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/95 text-black hover:bg-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-colors disabled:opacity-70"
      >
        {dlBusy ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
        ) : (
          <Download className="w-4 h-4" strokeWidth={2} />
        )}
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit(url)}
          title="Open editor"
          aria-label="Open editor"
          className="absolute bottom-2 right-2 z-20 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-black/65 border border-white/15 text-white/90 hover:text-white hover:bg-black/80 backdrop-blur-md text-[10px] mono uppercase tracking-[0.14em] transition-colors"
        >
          <Wand2 className="w-3 h-3" strokeWidth={2} />
          Editor
        </button>
      )}
    </>
  );
}

function FileReady({ label, onDownload }: { label: string; onDownload: () => void }) {
  return (
    <button
      type="button"
      onClick={onDownload}
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-300/[0.04] hover:bg-emerald-300/[0.08] transition-colors"
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
        {label === "PSD" ? <Layers className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
      </div>
      <div className="flex items-center gap-1.5 text-emerald-200 text-xs">
        <Check className="w-3.5 h-3.5" />
        {label} ready
      </div>
      <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/15 text-white/85 text-[11px]">
        <Download className="w-3 h-3" />
        Download
      </div>
    </button>
  );
}

function Waiting({ status, compact = false }: { status: BadgeJob["status"]; compact?: boolean }) {
  const queued = status === "queued";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/[0.02]">
      <Loader2 className={`${compact ? "w-3.5 h-3.5" : "w-5 h-5"} text-white/60 ${queued ? "" : "animate-spin"}`} />
      <div className={`text-white/55 ${compact ? "text-[8px]" : "text-[10px]"} mono uppercase tracking-[0.18em]`}>
        {queued ? "Waiting" : "Rendering"}
      </div>
    </div>
  );
}

function NotReceived({ compact = false }: { compact?: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-rose-300/[0.04]">
      <div className={`text-rose-300/80 ${compact ? "text-[8px]" : "text-[10px]"} mono uppercase tracking-[0.18em]`}>
        Not received
      </div>
    </div>
  );
}

function ReadyBadge() {
  return (
    <div className="absolute top-1.5 right-1.5 z-20 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-300/15 border border-emerald-300/40 text-emerald-200 text-[8px] mono uppercase tracking-[0.16em] backdrop-blur-sm">
      <Check className="w-2.5 h-2.5" />
      Ready
    </div>
  );
}

function SlotContent({
  slot,
  status,
  showMissing,
  onDownload,
  onZoom,
  onEdit,
  compact = false,
  applyPrintMargin = false,
  printMarginMm = 0,
}: {
  slot: FileSlot;
  status: BadgeJob["status"];
  showMissing: boolean;
  onDownload: (path: string) => void;
  onZoom: (target: ZoomTarget) => void;
  onEdit?: (url: string) => void;
  compact?: boolean;
  applyPrintMargin?: boolean;
  printMarginMm?: number;
}) {
  const ready = !!slot.path;
  const isImageReady = ready && slot.kind === "image" && isImagePath(slot.path!);
  const isFileReady = ready && (slot.kind === "file" || !isImagePath(slot.path!));
  const showNot = !ready && showMissing;

  return (
    <>
      {isImageReady && (
        <SignedPreview
          path={slot.path!}
          onDownload={() => onDownload(slot.path!)}
          onZoom={onZoom}
          onEdit={onEdit}
          applyPrintMargin={applyPrintMargin}
          printMarginMm={printMarginMm}
        />
      )}
      {isFileReady && (
        <FileReady
          label={slot.fileLabel ?? extOf(slot.path!).toUpperCase()}
          onDownload={() => onDownload(slot.path!)}
        />
      )}
      {!ready && !showNot && <Waiting status={status} compact={compact} />}
      {showNot && <NotReceived compact={compact} />}
      {isImageReady && <ReadyBadge />}
    </>
  );
}

function Lightbox({
  target,
  printMarginMm,
  onClose,
}: {
  target: ZoomTarget;
  printMarginMm: number;
  onClose: () => void;
}) {
  const [nat, setNat] = useState<{ w: number; h: number } | null>(
    target.natW > 0 && target.natH > 0 ? { w: target.natW, h: target.natH } : null,
  );
  const [box, setBox] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const measure = () => {
      setBox({
        w: Math.max(160, window.innerWidth * 0.92),
        h: Math.max(160, window.innerHeight * 0.88),
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const marginPx = target.applyPrintMargin ? marginPxFromMm(printMarginMm) : 0;
  const showPad = marginPx > 0 && nat && nat.w > 0 && nat.h > 0;
  const outW = showPad ? nat!.w + 2 * marginPx : nat?.w ?? 0;
  const outH = showPad ? nat!.h + 2 * marginPx : nat?.h ?? 0;
  const scale =
    outW > 0 && outH > 0 ? Math.min(box.w / outW, box.h / outH) : 1;
  const dispW = outW * scale;
  const dispH = outH * scale;
  const pad = marginPx * scale;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 print-margin-checker"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-10 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      {showPad ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative bg-white rounded-lg shadow-2xl overflow-hidden"
          style={{ width: dispW, height: dispH }}
        >
          <img
            src={target.url}
            alt=""
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth && el.naturalHeight) {
                setNat({ w: el.naturalWidth, h: el.naturalHeight });
              }
            }}
            className="absolute"
            style={{
              left: pad,
              top: pad,
              width: nat!.w * scale,
              height: nat!.h * scale,
            }}
          />
        </div>
      ) : (
        <img
          src={target.url}
          alt=""
          onClick={(e) => e.stopPropagation()}
          onLoad={(e) => {
            const el = e.currentTarget;
            if (el.naturalWidth && el.naturalHeight) {
              setNat({ w: el.naturalWidth, h: el.naturalHeight });
            }
          }}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      )}
    </div>
  );
}

export function IncomingItems({
  job,
  onDownload,
}: {
  job: BadgeJob;
  onDownload: (path: string) => void;
}) {
  const [lightbox, setLightbox] = useState<ZoomTarget | null>(null);
  const [editorUrl, setEditorUrl] = useState<string | null>(null);
  const [printMarginMm, setPrintMarginMmState] = useState(() => loadPrintMarginMm());
  const cards = buildCards(job);
  if (cards.length === 0) return null;

  const setPrintMarginMm = (next: number) => {
    const v = clampPrintMarginMm(next);
    setPrintMarginMmState(v);
    savePrintMarginMm(v);
  };

  const allSlots = collectSlots(cards);
  const total = allSlots.length;
  const receivedCount = allSlots.filter((s) => !!s.path).length;
  const allDone = receivedCount === total;
  const showMissing = job.status === "complete" || job.status === "failed";

  const badgeCards = cards.filter((c) => c.variant === "badge");
  const mockupCards = cards.filter((c) => c.variant === "mockup");
  const fullBadgeCard = badgeCards.find((c) => c.key === "full-badge");
  const sideCards = badgeCards.filter((c) => c.key !== "full-badge");
  const showPrintMargin = job.input_json.export_format === "png" && !!fullBadgeCard;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-white text-sm tracking-tight">Incoming items</div>
        <div
          className={`text-[11px] mono uppercase tracking-[0.18em] ${
            allDone ? "text-emerald-300" : "text-white/55"
          }`}
        >
          {receivedCount}/{total} received
        </div>
      </div>

      {showPrintMargin && (
        <PrintMarginControl valueMm={printMarginMm} onChange={setPrintMarginMm} />
      )}

      {fullBadgeCard && (
        <div className="mb-4">
          <div
            className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black/40"
            style={{ aspectRatio: String(fullBadgeCard.aspect) }}
          >
            {fullBadgeCard.slot && (
              <SlotContent
                slot={fullBadgeCard.slot}
                status={job.status}
                showMissing={showMissing}
                onDownload={onDownload}
                onZoom={setLightbox}
                applyPrintMargin
                printMarginMm={printMarginMm}
              />
            )}
          </div>
          <div className="mt-1.5 px-0.5 text-white/70 text-[11px]">{fullBadgeCard.label}</div>
        </div>
      )}

      {/* Badge sides: 2-up grid for PNG (front/back), single column for PDF/PSD */}
      {sideCards.length > 0 && (
        <div
          className={`grid gap-3 mb-4 ${
            sideCards.length === 2 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {sideCards.map((card) => (
            <div key={card.key}>
              <div
                className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black/40"
                style={{ aspectRatio: String(card.aspect) }}
              >
                {card.slot && (
                  <SlotContent
                    slot={card.slot}
                    status={job.status}
                    showMissing={showMissing}
                    onDownload={onDownload}
                    onZoom={setLightbox}
                    applyPrintMargin={card.variant === "badge" && job.input_json.export_format === "png"}
                    printMarginMm={printMarginMm}
                  />
                )}
              </div>
              <div className="mt-1.5 px-0.5 text-white/70 text-[11px]">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Mockup cards: each side is its own 9:16 card. 3-up on desktop,
          2-up on small screens. */}
      {mockupCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mockupCards.map((card) => (
            <div key={card.key}>
              <div
                className="relative w-full overflow-hidden rounded-lg border border-white/10 bg-black/40"
                style={{ aspectRatio: String(card.aspect) }}
              >
                <SlotContent
                  slot={card.slot}
                  status={job.status}
                  showMissing={showMissing}
                  onDownload={onDownload}
                  onZoom={setLightbox}
                  onEdit={setEditorUrl}
                />
              </div>
              <div className="mt-1.5 px-0.5 text-white/70 text-[11px] truncate">
                {card.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          target={lightbox}
          printMarginMm={printMarginMm}
          onClose={() => setLightbox(null)}
        />
      )}
      {editorUrl && <MockupEditor url={editorUrl} onClose={() => setEditorUrl(null)} />}
    </div>
  );
}

function PrintMarginControl({
  valueMm,
  onChange,
}: {
  valueMm: number;
  onChange: (mm: number) => void;
}) {
  const [unit, setUnit] = useState<PrintMarginUnit>("mm");
  const dpi = DEFAULT_PRINT_DPI;
  const px = marginPxFromMm(valueMm, dpi);
  const maxPx = marginPxFromMm(PRINT_MARGIN_MAX_MM, dpi);
  const fillPct = (valueMm / PRINT_MARGIN_MAX_MM) * 100;
  const ticks = [0, 1, 2, 3, 4, 5];

  const onNumberChange = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return;
    if (unit === "mm") onChange(n);
    else onChange(pxToMm(n, dpi));
  };

  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <Maximize2 className="w-3.5 h-3.5 text-white/55 mt-0.5 shrink-0" strokeWidth={1.8} />
          <div className="min-w-0">
            <div className="text-white text-xs tracking-tight">Print margin</div>
            <div className="text-white/45 text-[10px] leading-tight">White edge for cutting</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            inputMode="decimal"
            min={unit === "mm" ? PRINT_MARGIN_MIN_MM : 0}
            max={unit === "mm" ? PRINT_MARGIN_MAX_MM : maxPx}
            step={unit === "mm" ? PRINT_MARGIN_STEP_MM : 1}
            value={unit === "mm" ? valueMm : px}
            onChange={(e) => onNumberChange(e.target.value)}
            aria-label={unit === "mm" ? "Print margin in millimetres" : "Print margin in pixels"}
            className="w-[4.25rem] h-7 px-1.5 rounded-md bg-black/40 border border-white/15 text-white text-xs mono text-right tabular-nums focus:outline-none focus:border-white/45"
          />
          <div
            className="inline-flex rounded-md border border-white/15 overflow-hidden"
            role="group"
            aria-label="Print margin unit"
          >
            {(["mm", "px"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className={`h-7 px-2 text-[10px] mono uppercase tracking-[0.12em] transition-colors ${
                  unit === u ? "bg-white text-black" : "text-white/65 hover:bg-white/5"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      <input
        type="range"
        className="print-margin-slider"
        min={PRINT_MARGIN_MIN_MM}
        max={PRINT_MARGIN_MAX_MM}
        step={PRINT_MARGIN_STEP_MM}
        value={valueMm}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label="Print margin"
        aria-valuemin={PRINT_MARGIN_MIN_MM}
        aria-valuemax={PRINT_MARGIN_MAX_MM}
        aria-valuenow={valueMm}
        aria-valuetext={`${valueMm.toFixed(1)} millimetres, ${px} pixels`}
        style={{
          background: `linear-gradient(to right, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.85) ${fillPct}%, rgba(255,255,255,0.12) ${fillPct}%, rgba(255,255,255,0.12) 100%)`,
        }}
      />

      <div className="flex justify-between mt-1 px-[1px]">
        {ticks.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-[8px] mono leading-none ${
              valueMm === n ? "text-white/80" : "text-white/35 hover:text-white/60"
            }`}
            aria-label={`${n} millimetres`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="mt-1.5 text-white/40 text-[10px] mono">
        {unit === "mm"
          ? `${px} px · ${dpi} DPI`
          : `${valueMm.toFixed(1)} mm · ${dpi} DPI`}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-white/70 text-xs">{label}</label>
        <span className="text-white/80 text-xs mono">{display}</span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-white/80 disabled:opacity-40"
      />
    </div>
  );
}

function MockupEditor({ url, onClose }: { url: string; onClose: () => void }) {
  // Motion controls (unchanged) — the worker's shake/zoom model is built to
  // match these, so they remain the single source of truth.
  const [zoom, setZoom] = useState(0.25); // 0..1 → static zoom-in
  const [shake, setShake] = useState(0.35); // 0..1 → handheld shake intensity
  const [duration, setDuration] = useState(5); // seconds, 3..10

  // Worker render lifecycle. The actual encode now happens on the FFmpeg worker
  // (browser MediaRecorder can't meet the Android/VMOS codec spec), so we queue
  // a Supabase job and wait for it.
  const [phase, setPhase] = useState<"idle" | "uploading" | "working" | "done" | "error">("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<BadgeJob["status"] | null>(null);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "uploading" || phase === "working";

  // Signed URL for the finished MP4 (badge-outputs bucket), reusing the same
  // mechanism the result images use.
  const { url: videoUrl, errored: videoErrored } = useSignedUrl(videoPath);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  // Poll the queued job row until it reaches a terminal state.
  useEffect(() => {
    if (phase !== "working" || !jobId || !supabase) return;
    let alive = true;
    const poll = async () => {
      const { data, error: e } = await supabase!
        .from("badge_jobs")
        .select("status, output_video_path, error_message")
        .eq("id", jobId)
        .single();
      if (!alive) return;
      if (e || !data) return; // transient read error — keep polling
      const row = data as Pick<BadgeJob, "status" | "output_video_path" | "error_message">;
      setJobStatus(row.status);
      if (row.status === "complete") {
        if (row.output_video_path) {
          setVideoPath(row.output_video_path);
          setPhase("done");
        } else {
          setError("Worker finished but returned no video. Check the worker logs.");
          setPhase("error");
        }
      } else if (row.status === "failed") {
        setError(row.error_message || "Video render failed on the worker.");
        setPhase("error");
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [phase, jobId]);

  const createVideo = async () => {
    setError(null);
    if (isMockMode) {
      setError("Video creation needs the local FFmpeg worker, which isn't available in mock/dev mode.");
      setPhase("error");
      return;
    }
    if (isLocalMode) {
      setError("Image-to-video is not enabled in local mode. Download the still instead.");
      setPhase("error");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase isn't configured, so the worker can't be reached.");
      setPhase("error");
      return;
    }

    setPhase("uploading");
    try {
      // 1. Take the exact still the preview animates (unmodified, full image)
      //    and upload it to the badge-inputs bucket.
      const resp = await fetch(url, { mode: "cors" });
      if (!resp.ok) throw new Error(`Could not fetch source image (${resp.status})`);
      const blob = await resp.blob();
      const ext =
        blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      const uuid =
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const sourceImagePath = `video-src/${uuid}.${ext}`;

      const { error: upErr } = await supabase!.storage
        .from("badge-inputs")
        .upload(sourceImagePath, blob, {
          contentType: blob.type || "image/png",
          upsert: true,
        });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      // 2. Build the render request per the worker contract.
      const render = {
        kind: "image_to_video" as const,
        sourceImagePath,
        durationSeconds: Math.max(3, Math.min(10, Math.round(duration))),
        zoom: Math.max(0, Math.min(1, zoom)),
        shake: Math.max(0, Math.min(1, shake)),
      };

      // 3. Queue the job. The RLS insert policy requires status='queued',
      //    template='EmployeeID.psd', and input_json.meta.intended_use=
      //    'internal_company_badge', so match those exactly. The worker's render
      //    branch keys off input_json.render and ignores the badge fields;
      //    employee_photo_path reuses the uploaded source to satisfy NOT NULL.
      const input_json = {
        meta: { intended_use: "internal_company_badge" },
        render,
      };
      const { data, error: insErr } = await supabase!
        .from("badge_jobs")
        .insert({
          status: "queued",
          template: "EmployeeID.psd",
          input_json,
          employee_photo_path: sourceImagePath,
          signature_image_path: null,
        })
        .select("id")
        .single();
      if (insErr) throw new Error(`Could not queue job: ${insErr.message}`);

      setJobId((data as { id: string }).id);
      setJobStatus("queued");
      setPhase("working");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("idle");
    setJobId(null);
    setJobStatus(null);
    setVideoPath(null);
    setError(null);
  };

  const downloadVideo = async () => {
    if (!videoUrl) return;
    try {
      const r = await fetch(videoUrl);
      const b = await r.blob();
      const u = URL.createObjectURL(b);
      const a = document.createElement("a");
      a.href = u;
      a.download = "mockup.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    } catch {
      window.open(videoUrl, "_blank");
    }
  };

  return (
    <div
      onClick={() => !busy && onClose()}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-2xl border border-white/12 bg-[#0b0b0d] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-white text-sm tracking-tight">
            <Wand2 className="w-4 h-4 text-white/70" />
            Mockup editor
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/80 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-0">
          <div className="bg-black flex items-center justify-center p-4 min-h-[320px]">
            {phase === "done" && videoUrl ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="max-w-full max-h-[60vh] rounded-md"
              />
            ) : (
              <img
                src={url}
                alt=""
                className="max-w-full max-h-[60vh] object-contain rounded-md"
              />
            )}
          </div>

          <div className="p-5 border-t md:border-t-0 md:border-l border-white/10 space-y-4">
            <div>
              <div className="flex items-center gap-1.5 text-white/65 text-[10px] mono uppercase tracking-[0.16em] mb-3">
                <Sparkles className="w-3 h-3" />
                Motion
              </div>

              <div className="space-y-4">
                <Slider
                  label="Duration"
                  value={duration}
                  min={3}
                  max={10}
                  step={0.5}
                  disabled={busy}
                  display={`${duration}s`}
                  onChange={setDuration}
                />
                <Slider
                  label="Zoom"
                  value={zoom}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={busy}
                  display={`${Math.round(zoom * 100)}%`}
                  onChange={setZoom}
                />
                <Slider
                  label="Shake"
                  value={shake}
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={busy}
                  display={shake === 0 ? "Off" : `${Math.round(shake * 100)}%`}
                  onChange={setShake}
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="text-white/65 text-[10px] mono uppercase tracking-[0.16em] mb-2">
                Create video
              </div>

              {phase === "done" ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={downloadVideo}
                    disabled={!videoUrl}
                    className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-white text-black text-sm hover:bg-white/90 disabled:opacity-50 transition-colors"
                  >
                    <Download className="w-4 h-4" strokeWidth={2} />
                    Download MP4
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="w-full inline-flex items-center justify-center gap-2 h-9 px-4 rounded-full border border-white/15 text-white/75 text-xs hover:bg-white/5 transition-colors"
                  >
                    Create another
                  </button>
                  {videoErrored && (
                    <div className="text-rose-300 text-[11px]">
                      Couldn’t load the rendered video preview. Try Download MP4.
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={createVideo}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full bg-white text-black text-sm hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {phase === "uploading" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading…
                    </>
                  ) : phase === "working" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {jobStatus === "processing" ? "Rendering on worker…" : "Queued…"}
                    </>
                  ) : (
                    <>
                      <Film className="w-4 h-4" strokeWidth={2} />
                      Create {duration}-second video
                    </>
                  )}
                </button>
              )}

              <div className="mt-2 text-white/45 text-[11px] leading-relaxed">
                Rendered by the local worker into a 1080×1920 H.264 MP4 (Android/VMOS
                compatible) with a subtle, perfectly-looping handheld shake that matches
                this preview. The worker must be running to process the job.
              </div>

              {error && (
                <div className="mt-2 flex items-start gap-1.5 text-rose-300 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
