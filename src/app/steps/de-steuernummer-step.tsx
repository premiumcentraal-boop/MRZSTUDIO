import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Shuffle,
  X,
  MapPin,
  Loader2,
} from "lucide-react";
import { BackButton, PrimaryButton, SecondaryButton } from "../components/buttons";
import { Field } from "../components/field";
import {
  generateSyntheticSteuernummer,
  validate as validateSteuernummer,
  elster13ToLocal,
  BUNDESLANDS,
  ELSTER_STEUERNUMMER_SOURCE,
  type Bundesland,
  type SteuernummerValidationResult,
} from "../../lib/de-tax/steuernummer";

const BUNDESLAND_LABELS: Record<Bundesland, string> = {
  baden_wuerttemberg: "Baden-Württemberg",
  bayern: "Bayern",
  berlin: "Berlin",
  brandenburg: "Brandenburg",
  bremen: "Bremen",
  hamburg: "Hamburg",
  hessen: "Hessen",
  mecklenburg_vorpommern: "Mecklenburg-Vorpommern",
  niedersachsen: "Niedersachsen",
  nordrhein_westfalen: "Nordrhein-Westfalen",
  rheinland_pfalz: "Rheinland-Pfalz",
  saarland: "Saarland",
  sachsen: "Sachsen",
  sachsen_anhalt: "Sachsen-Anhalt",
  schleswig_holstein: "Schleswig-Holstein",
  thueringen: "Thüringen",
};

/* Map a Nominatim `address.state` value (German Bundesland name) to our key. */
const STATE_TO_BUNDESLAND: Record<string, Bundesland> = {
  "Baden-Württemberg": "baden_wuerttemberg",
  "Bayern": "bayern",
  "Berlin": "berlin",
  "Brandenburg": "brandenburg",
  "Bremen": "bremen",
  "Hamburg": "hamburg",
  "Hessen": "hessen",
  "Mecklenburg-Vorpommern": "mecklenburg_vorpommern",
  "Niedersachsen": "niedersachsen",
  "Nordrhein-Westfalen": "nordrhein_westfalen",
  "Rheinland-Pfalz": "rheinland_pfalz",
  "Saarland": "saarland",
  "Sachsen": "sachsen",
  "Sachsen-Anhalt": "sachsen_anhalt",
  "Schleswig-Holstein": "schleswig_holstein",
  "Thüringen": "thueringen",
};

type AddressHit = {
  display_name: string;
  address: { state?: string; country_code?: string };
};

function AddressBundeslandSearch({
  onPick,
}: {
  onPick: (b: Bundesland, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 3) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=de&limit=6&q=${encodeURIComponent(
          query,
        )}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = (await res.json()) as AddressHit[];
        setHits(Array.isArray(data) ? data.filter((h) => h.address?.state) : []);
        setOpen(true);
      } catch {
        setError("Address lookup failed.");
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const select = (h: AddressHit) => {
    const state = h.address?.state ?? "";
    const b = STATE_TO_BUNDESLAND[state];
    if (b) {
      onPick(b, h.display_name);
      setQuery(h.display_name);
      setOpen(false);
    } else {
      setError(`No Bundesland match for "${state}".`);
    }
  };

  return (
    <div className="relative w-full" ref={wrapRef}>
      <div className="text-white/65 text-xs mb-1.5 tracking-wide flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
        Address search · auto-detect Bundesland
      </div>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder="Munich, Marienplatz · Berlin, Alexanderplatz · Hauptstraße 1, Köln…"
          className="w-full h-11 pl-3 pr-9 rounded-xl bg-white/5 border border-white/12 text-white text-sm focus:outline-none focus:border-white/30 placeholder:text-white/30"
        />
        {loading && (
          <Loader2
            className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-white/55 animate-spin"
            strokeWidth={2}
          />
        )}
      </div>
      {error && <div className="text-rose-300 text-[11px] mt-1.5">{error}</div>}
      {open && hits.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-white/12 bg-neutral-950/95 backdrop-blur-sm shadow-xl max-h-72 overflow-y-auto">
          {hits.map((h, i) => {
            const state = h.address?.state ?? "";
            const b = STATE_TO_BUNDESLAND[state];
            return (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(h);
                }}
                disabled={!b}
                className="w-full text-left px-3 py-2 hover:bg-white/5 disabled:opacity-40 border-b border-white/5 last:border-b-0 transition-colors"
              >
                <div className="text-white text-xs truncate">{h.display_name}</div>
                <div className="text-[10px] mono uppercase tracking-[0.14em] text-emerald-300/85 mt-0.5">
                  {b ? BUNDESLAND_LABELS[b] : state || "Unknown"}
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div className="text-[10px] text-white/40 mt-1.5">
        Powered by OpenStreetMap Nominatim. Type at least 3 characters.
      </div>
    </div>
  );
}

/* ---------------------------- Small primitives -------------------------- */

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[10px] mono uppercase tracking-[0.14em] text-white/60 hover:text-white border border-white/12 hover:bg-white/5 transition-colors"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ToolPanel({
  title,
  subtitle,
  accent = "idle",
  children,
}: {
  title: string;
  subtitle: string;
  accent?: "ok" | "err" | "warn" | "idle";
  children: React.ReactNode;
}) {
  const ring =
    accent === "ok"
      ? "ring-1 ring-emerald-300/40"
      : accent === "err"
      ? "ring-1 ring-rose-300/40"
      : accent === "warn"
      ? "ring-1 ring-amber-300/40"
      : "";
  return (
    <div className={`rounded-2xl border border-white/12 bg-black/25 p-5 ${ring}`}>
      <div className="mb-4">
        <div className="text-white text-base tracking-tight">{title}</div>
        <div className="text-white/50 text-xs mt-0.5">{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function StatusRow({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "err" | "warn";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "text-emerald-300 border-emerald-300/30 bg-emerald-300/10"
      : tone === "err"
      ? "text-rose-300 border-rose-300/30 bg-rose-300/10"
      : "text-amber-300 border-amber-300/30 bg-amber-300/10";
  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 flex items-start gap-2 text-xs ${cls}`}>
      <span className="shrink-0 mt-0.5">{icon}</span>
      <span className="leading-snug">{children}</span>
    </div>
  );
}

function GeneratedRow({
  value,
  sub,
  onSelect,
}: {
  value: string;
  sub?: string;
  onSelect?: (value: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
    onSelect?.(value);
  };
  return (
    <button
      onClick={handle}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 hover:bg-white/5 transition-colors group text-left"
    >
      <span className="min-w-0">
        <span className="block mono text-white text-sm tracking-[0.14em] truncate">{value}</span>
        {sub && (
          <span className="block mono text-[10px] uppercase tracking-[0.14em] text-white/45 mt-0.5">
            {sub}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-white/55">Verified</span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} />
        ) : (
          <Copy className="w-3.5 h-3.5 text-white/45 group-hover:text-white" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

/* ------------------------------ Main body ------------------------------- */

type GeneratedItem = { elster: string; local: string };

export function DeSteuernummerToolBody() {
  const [bundesland, setBundesland] = useState<Bundesland>("bayern");
  const [outputFormat, setOutputFormat] = useState<"elster_13" | "local">("elster_13");
  const [berlinVariant, setBerlinVariant] = useState<"A" | "B">("A");
  const [input, setInput] = useState("");
  const [generated, setGenerated] = useState<GeneratedItem[]>([]);
  const [genError, setGenError] = useState<string | null>(null);

  const result: SteuernummerValidationResult | null = useMemo(() => {
    if (!input.trim()) return null;
    return validateSteuernummer(input, { bundesland });
  }, [input, bundesland]);

  const isValid = !!result && result.valid_structure && result.valid_checksum;
  const inputHasContent = input.trim().length > 0;

  const generateOne = (): GeneratedItem | null => {
    try {
      setGenError(null);
      const out = generateSyntheticSteuernummer({
        bundesland,
        generation_mode: "synthetic_test_only",
        output_format: outputFormat,
        seed: `${Date.now()}-${Math.random()}`,
        berlin_variant: bundesland === "berlin" ? berlinVariant : undefined,
      });
      return { elster: out.elster_13, local: out.local };
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Generation failed.");
      return null;
    }
  };

  const fillField = () => {
    const out = generateOne();
    if (out) setInput(outputFormat === "local" ? out.local : out.elster);
  };

  const generateBulk = (n: number) => {
    const items: GeneratedItem[] = [];
    for (let i = 0; i < n; i++) {
      const out = generateOne();
      if (out) items.push(out);
    }
    setGenerated(items);
  };

  // Conversions for the input field once it validates.
  const conversion = useMemo(() => {
    if (!result || !result.normalized || !result.bundesland_detected) return null;
    try {
      return {
        elster: result.normalized,
        local: elster13ToLocal(result.normalized, result.bundesland_detected),
      };
    } catch {
      return null;
    }
  }, [result]);

  return (
    <div>
      {/* Address search */}
      <div className="rounded-2xl border border-white/12 bg-black/25 p-4 mb-3">
        <AddressBundeslandSearch onPick={(b) => setBundesland(b)} />
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-white/12 bg-black/25 p-4 mb-5 flex flex-wrap items-end gap-4">
        <label className="block flex-1 min-w-[220px]">
          <div className="text-white/65 text-xs mb-1.5 tracking-wide">Bundesland</div>
          <select
            value={bundesland}
            onChange={(e) => setBundesland(e.target.value as Bundesland)}
            className="w-full h-11 px-3 rounded-xl bg-white/5 border border-white/12 text-white text-sm focus:outline-none focus:border-white/30"
          >
            {BUNDESLANDS.map((b) => (
              <option key={b} value={b} className="bg-neutral-900">
                {BUNDESLAND_LABELS[b]}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="text-white/65 text-xs mb-1.5 tracking-wide">Format</div>
          <div className="inline-flex p-1 rounded-full bg-black/30 border border-white/12">
            {(["elster_13", "local"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setOutputFormat(opt)}
                className={`h-9 px-4 rounded-full text-[11px] mono uppercase tracking-[0.14em] transition-colors ${
                  outputFormat === opt ? "bg-white text-black" : "text-white/65 hover:text-white"
                }`}
              >
                {opt === "elster_13" ? "ELSTER 13" : "Local"}
              </button>
            ))}
          </div>
        </div>

        {bundesland === "berlin" && (
          <div>
            <div className="text-white/65 text-xs mb-1.5 tracking-wide">Berlin variant</div>
            <div className="inline-flex p-1 rounded-full bg-black/30 border border-white/12">
              {(["A", "B"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setBerlinVariant(v)}
                  className={`h-9 px-4 rounded-full text-[11px] mono uppercase tracking-[0.14em] transition-colors ${
                    berlinVariant === v ? "bg-white text-black" : "text-white/65 hover:text-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Two-panel main */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Check & Convert */}
        <ToolPanel
          title="Check"
          subtitle="Paste a Steuernummer (ELSTER 13 or local) — or generate one"
          accent={isValid ? "ok" : inputHasContent ? "err" : "idle"}
        >
          <Field
            label="Steuernummer"
            value={input}
            onChange={setInput}
            placeholder="9198081508151"
            mono
            status={inputHasContent ? (isValid ? "ok" : "err") : null}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <SecondaryButton onClick={fillField}>
              <Shuffle className="w-4 h-4" strokeWidth={2} />
              Generate example
            </SecondaryButton>
            {input && (
              <SecondaryButton onClick={() => setInput("")}>
                <X className="w-4 h-4" strokeWidth={2} />
                Clear
              </SecondaryButton>
            )}
          </div>

          {result && (
            <StatusRow
              tone={isValid ? "ok" : "err"}
              icon={
                isValid ? (
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <AlertCircle className="w-4 h-4" strokeWidth={2} />
                )
              }
            >
              {isValid
                ? `Valid · ${result.bundesland_detected ? BUNDESLAND_LABELS[result.bundesland_detected] : ""}${result.method_used ? ` · ${result.method_used}` : ""}`
                : result.errors[0]?.message || "Invalid Steuernummer."}
            </StatusRow>
          )}

          {/* Conversion view when valid */}
          {isValid && conversion && (
            <div className="mt-4 space-y-2">
              <div className="rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] mono uppercase tracking-[0.14em] text-white/45">ELSTER 13</div>
                  <div className="mono text-white text-sm tracking-[0.14em] truncate">{conversion.elster}</div>
                </div>
                <CopyChip value={conversion.elster} />
              </div>
              <div className="rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] mono uppercase tracking-[0.14em] text-white/45">Local</div>
                  <div className="mono text-white text-sm tracking-[0.14em] truncate">{conversion.local}</div>
                </div>
                <CopyChip value={conversion.local} />
              </div>
            </div>
          )}
        </ToolPanel>

        {/* Bulk generate */}
        <ToolPanel
          title="Bulk generate"
          subtitle="Synthetic structurally-valid examples for the selected Bundesland"
        >
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => generateBulk(1)}>
              <Shuffle className="w-4 h-4" strokeWidth={2} />
              One
            </PrimaryButton>
            <SecondaryButton onClick={() => generateBulk(10)}>
              <Shuffle className="w-4 h-4" strokeWidth={2} />
              Ten
            </SecondaryButton>
            {generated.length > 0 && (
              <SecondaryButton onClick={() => setGenerated([])}>
                <X className="w-4 h-4" strokeWidth={2} />
                Clear
              </SecondaryButton>
            )}
          </div>

          {genError && (
            <StatusRow tone="err" icon={<AlertCircle className="w-4 h-4" strokeWidth={2} />}>
              {genError}
            </StatusRow>
          )}

          {generated.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {generated.map((g, i) => {
                const primary = outputFormat === "local" ? g.local : g.elster;
                const secondary = outputFormat === "local" ? `ELSTER · ${g.elster}` : `Local · ${g.local}`;
                return <GeneratedRow key={i} value={primary} sub={secondary} onSelect={setInput} />;
              })}
            </div>
          )}

          {generated.length === 0 && !genError && (
            <div className="mt-4 text-white/40 text-xs">
              Click <span className="text-white/70">One</span> or <span className="text-white/70">Ten</span> to generate examples. Click any row to copy.
            </div>
          )}
        </ToolPanel>
      </div>

      <div className="mt-5 text-[11px] text-white/45 leading-relaxed">
        Source: {ELSTER_STEUERNUMMER_SOURCE}. Public output deliberately does not disclose the
        corrected replacement check digit on failure. Strict official Finanzamtsdaten validation
        requires a separately bundled current ELSTER list.
      </div>
    </div>
  );
}

/* ----------------------------- Standalone step -------------------------- */

export function DeSteuernummerStep({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="eyebrow mb-3">German Tax Numbers</div>
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          Steuernummer
        </h1>
        <p className="text-white/55 mt-3 max-w-xl mx-auto text-sm">
          Generate, validate, and convert synthetic German Steuernummer examples. Synthetic test data only.
        </p>
      </div>
      <DeSteuernummerToolBody />
      <div className="mt-10 flex">
        <BackButton onClick={onBack} />
      </div>
    </div>
  );
}

export default DeSteuernummerStep;
