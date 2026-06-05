import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Shuffle,
  X,
  Check,
  Copy,
  Search,
  Info,
  Loader2,
  Building2,
  MapPin,
  Globe,
  ShieldAlert,
  FileText,
  IdCard,
  CreditCard,
  Percent,
  PenLine,
  Receipt,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { projectId, publicAnonKey } from "../../../utils/supabase/info";
import { PrimaryButton, SecondaryButton, BackButton } from "../components/buttons";
import { Field } from "../components/field";
import {
  IBAN_REGISTRY,
  checkIban,
  generateIban,
  breakdownIban,
  formatIban,
  type IbanCheckResult,
} from "../../lib/iban";
import {
  VAT_REGISTRY,
  checkVat,
  generateVat,
  formatVat,
} from "../../lib/euvat";
import { DeSteuernummerToolBody } from "./de-steuernummer-step";
import { Flag } from "../components/flag";
import { SignatureGenerator } from "../components/signature-generator";
import { generateAddressForCity, checkDutchAddress, SUPPORTED_ADDRESS_CITIES } from "../../lib/dutchAddresses";
import { DocRulesInfoButton } from "../components/doc-rules-info";

/* ===================== NL Number Tools =================================
 *
 * Four mathematical engines:
 *   A. checkDocNumber     — ICAO 9303 weights [7,3,1] mod 10 over the
 *                            first 8 chars; the 9th char IS the check digit.
 *   B. generateDocNumber  — random 8-char base (no 'O', no '0' for safety),
 *                            then computed 9th check digit.
 *   C. checkBSN           — elfproef weights [9,8,7,6,5,4,3,2,-1] mod 11,
 *                            sum > 0 and divisible by 11. Accepts 8-digit
 *                            (legacy "sofinummer") input by zero-padding.
 *   D. generateBSN        — random 8 digits, solve for 9th s.t. sum % 11 = 0;
 *                            retry if the required digit is out of 0..9.
 * ====================================================================== */

/* RvIG document-number rules (Dutch passport + ID card).
 *
 *   Universal structure (all eras):
 *     Pos 1-2 : letters only
 *     Pos 3-8 : letters or digits
 *     Pos 9   : digit (ICAO 9303 mod-10 check, weights [7,3,1])
 *   Letter 'O' is never used in any era (OCR ambiguity with '0').
 *
 *   Era-specific:
 *     "pre-2019" — 2014 model issued 9 Mar 2014 → 30 Nov 2019:
 *                  digit '0' IS allowed anywhere, pos 9 may be 0–9.
 *     "post-2019" — 2014 model from 1 Dec 2019 onwards, 2021 ID card
 *                   (from 2 Aug 2021), 2021 passport (from 30 Aug 2021),
 *                   2024 passport: digit '0' is NOT used anywhere,
 *                   pos 9 must be 1–9.
 *
 * The ICAO MRZ check-digit equation itself is identical across all eras;
 * only the allowed character set in the issued document number changed. */

export type DocNumberEra = "pre-2019" | "post-2019";

const DOC_LETTERS = "ABCDEFGHIJKLMNPQRSTUVWXYZ"; // no 'O'
const DOC_ALPHANUM_PRE = "ABCDEFGHIJKLMNPQRSTUVWXYZ0123456789"; // no 'O', '0' allowed
const DOC_ALPHANUM_POST = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // no 'O', no '0'
const DOC_WEIGHTS = [7, 3, 1, 7, 3, 1, 7, 3];

function docCharValue(c: string): number {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return -1;
}

type DocCheckResult = {
  ok: boolean;
  reason?: string;
  expected?: string;
  sum?: number;
  era: DocNumberEra;
};

export function checkDocNumber(
  raw: string,
  era: DocNumberEra = "post-2019",
): DocCheckResult {
  const v = (raw || "").toUpperCase();
  if (v.length !== 9) return { ok: false, reason: "Must be exactly 9 characters.", era };
  if (v.includes("O"))
    return { ok: false, reason: "Letter 'O' is never used in Dutch documents.", era };

  const structureRegex =
    era === "post-2019"
      ? /^[A-Z]{2}[A-Z1-9]{6}[1-9]$/
      : /^[A-Z]{2}[A-Z0-9]{6}[0-9]$/;

  if (!structureRegex.test(v)) {
    if (!/^[A-Z]{2}/.test(v))
      return { ok: false, reason: "Positions 1–2 must be letters.", era };
    if (era === "post-2019" && v.includes("0"))
      return {
        ok: false,
        reason: "Digit '0' is not used in Dutch documents issued from 1 Dec 2019.",
        era,
      };
    if (era === "post-2019" && !/[1-9]$/.test(v))
      return { ok: false, reason: "Position 9 must be a digit 1–9.", era };
    if (!/[0-9]$/.test(v))
      return { ok: false, reason: "Position 9 must be a digit.", era };
    return { ok: false, reason: "Only A–Z (no O) and digits are allowed.", era };
  }

  let sum = 0;
  for (let i = 0; i < 8; i++) sum += docCharValue(v[i]) * DOC_WEIGHTS[i];
  const expected = String(sum % 10);
  if (v[8] !== expected) {
    return {
      ok: false,
      reason: `ICAO check digit mismatch: expected '${expected}', got '${v[8]}'.`,
      expected,
      sum,
      era,
    };
  }
  return { ok: true, expected, sum, era };
}

export function generateDocNumber(era: DocNumberEra = "post-2019"): string {
  const alphanum = era === "post-2019" ? DOC_ALPHANUM_POST : DOC_ALPHANUM_PRE;
  for (let attempt = 0; attempt < 400; attempt++) {
    let base =
      DOC_LETTERS[Math.floor(Math.random() * DOC_LETTERS.length)] +
      DOC_LETTERS[Math.floor(Math.random() * DOC_LETTERS.length)];
    for (let i = 2; i < 8; i++) {
      base += alphanum[Math.floor(Math.random() * alphanum.length)];
    }
    let sum = 0;
    for (let i = 0; i < 8; i++) sum += docCharValue(base[i]) * DOC_WEIGHTS[i];
    const d9 = sum % 10;
    if (era === "post-2019" ? d9 >= 1 && d9 <= 9 : d9 >= 0 && d9 <= 9) {
      return base + String(d9);
    }
  }
  return era === "post-2019" ? "AB123451" : "AB000000";
}

/* ICAO 9303 MRZ check-digit equation — independent of Dutch issuance rules.
 * Weights [7,3,1] cycle across the field; '<' counts as 0, A–Z as 10–35,
 * digits as their value. Identical for document number, DOB, expiry, and
 * composite-line check digits across all Dutch eras and all states. */
export function icaoMrzCheckDigit(field: string): string {
  const W = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i++) {
    const c = field[i];
    let v: number;
    if (c === "<") v = 0;
    else if (c >= "0" && c <= "9") v = c.charCodeAt(0) - 48;
    else if (c >= "A" && c <= "Z") v = c.charCodeAt(0) - 55;
    else v = 0;
    sum += v * W[i % 3];
  }
  return String(sum % 10);
}

type BSNCheckResult = {
  ok: boolean;
  reason?: string;
  normalized?: string;
  sum?: number;
};

export function checkBSN(raw: string): BSNCheckResult {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length !== 8 && digits.length !== 9) {
    return { ok: false, reason: "BSN must be 8 or 9 digits." };
  }
  const padded = digits.length === 8 ? "0" + digits : digits;
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += weights[i] * parseInt(padded[i], 10);
  if (sum <= 0) return { ok: false, reason: "BSN cannot be all zeros.", normalized: padded, sum };
  if (sum % 11 !== 0) return { ok: false, reason: `Elfproef failed: sum=${sum}, sum mod 11 = ${sum % 11}.`, normalized: padded, sum };
  return { ok: true, normalized: padded, sum };
}

export function generateBSN(): string {
  // Retry until the required check digit lands in 0..9.
  for (let attempt = 0; attempt < 200; attempt++) {
    let base = "";
    for (let i = 0; i < 8; i++) base += String(Math.floor(Math.random() * 10));
    const weights = [9, 8, 7, 6, 5, 4, 3, 2];
    let partial = 0;
    for (let i = 0; i < 8; i++) partial += weights[i] * parseInt(base[i], 10);
    const d9 = partial % 11;
    if (d9 < 10) {
      const candidate = base + String(d9);
      if (parseInt(candidate, 10) > 0) return candidate;
    }
  }
  return "111222333";
}

type ToolTab = "doc" | "bsn" | "iban" | "vat" | "kvk" | "detax" | "signature" | "address";

/* ===================== Tool tag registry =================================
 *
 * Every validate/generate tool declares which countries and which document
 * types it applies to. The page filters this registry by the active country
 * and document-type pickers and renders matching tools below the filters.
 *
 * countries: ISO codes the tool is meaningful for. "*" = jurisdiction-agnostic
 * (shows up regardless of country filter).
 *
 * docTypes: high-level kinds the tool applies to.
 * ====================================================================== */

type CountryTag =
  | "*"
  | "DE"
  | "NL"
  | "FR"
  | "ES"
  | "IT"
  | "GB"
  | "US"
  | "EU";

type DocTypeTag =
  | "passport"
  | "id-card"
  | "tax-id"
  | "bank"
  | "business"
  | "personal-id"
  | "signature"
  | "address";

type ToolRenderCtx = { activeCountry: CountryTag | "ALL" };

type ToolDef = {
  id: ToolTab;
  label: string;
  sub: string;
  /** Short one-line description shown on the suggestions carousel card. */
  blurb?: string;
  badge: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  countries: CountryTag[];
  docTypes: DocTypeTag[];
  render: (ctx: ToolRenderCtx) => JSX.Element;
};

/* Map our CountryTag → 2-letter ISO codes used inside individual tools. */
function countryTagToIso(tag: CountryTag | "ALL"): string | undefined {
  if (tag === "ALL" || tag === "*" || tag === "EU") return undefined;
  return tag;
}

const COUNTRY_FILTERS: { id: CountryTag | "ALL"; label: string; iso?: string }[] = [
  { id: "ALL", label: "All countries" },
  { id: "DE", label: "Germany", iso: "DE" },
  { id: "NL", label: "Netherlands", iso: "NL" },
  { id: "FR", label: "France", iso: "FR" },
  { id: "ES", label: "Spain", iso: "ES" },
  { id: "IT", label: "Italy", iso: "IT" },
  { id: "GB", label: "UK", iso: "GB" },
  { id: "US", label: "USA", iso: "US" },
  { id: "EU", label: "EU-wide", iso: "EU" },
];

const DOCTYPE_FILTERS: { id: DocTypeTag | "ALL"; label: string }[] = [
  { id: "ALL", label: "All types" },
  { id: "passport", label: "Passport" },
  { id: "id-card", label: "ID Card" },
  { id: "personal-id", label: "Personal ID" },
  { id: "tax-id", label: "Tax ID" },
  { id: "bank", label: "Bank / IBAN" },
  { id: "business", label: "Business" },
  { id: "signature", label: "Signature" },
  { id: "address", label: "Address" },
];

const TOOL_REGISTRY: ToolDef[] = [
  {
    id: "doc",
    label: "Document number",
    sub: "ICAO 9303 mod-10 check digit · validate & generate 9-char serials",
    blurb: "ICAO mod-10 check for 9-char passport & ID serials",
    badge: "ICAO",
    icon: FileText,
    countries: ["*"],
    docTypes: ["passport", "id-card"],
    render: () => <DocNumberTool />, // algorithm only — no country state
  },
  {
    id: "bsn",
    label: "BSN · elfproef",
    sub: "Dutch Burgerservicenummer — 11-test validator & generator",
    blurb: "Dutch BSN elfproef validator & generator",
    badge: "NLD",
    icon: IdCard,
    countries: ["NL"],
    docTypes: ["personal-id"],
    render: () => <BSNTool />,
  },
  {
    id: "iban",
    label: "IBAN",
    sub: "MOD97-10 check, breakdown & generation across all IBAN countries",
    blurb: "MOD97-10 IBAN check across every IBAN country",
    badge: "IBAN",
    icon: CreditCard,
    countries: ["*"],
    docTypes: ["bank"],
    render: (ctx) => <IbanTool defaultCountry={countryTagToIso(ctx.activeCountry)} />,
  },
  {
    id: "vat",
    label: "EU VAT",
    sub: "Format check across the EU — fully offline (no VIES lookup)",
    blurb: "Offline EU VAT format check across member states",
    badge: "EU",
    icon: Percent,
    countries: ["EU", "DE", "NL", "FR", "ES", "IT"],
    docTypes: ["business", "tax-id"],
    render: (ctx) => <VatTool defaultCountry={countryTagToIso(ctx.activeCountry)} />,
  },
  {
    id: "kvk",
    label: "KVK · Netherlands",
    sub: "Dutch chamber of commerce number lookup",
    blurb: "Dutch chamber-of-commerce KVK number checks",
    badge: "NLD",
    icon: Building2,
    countries: ["NL"],
    docTypes: ["business"],
    render: () => <KvkTool />,
  },
  {
    id: "signature",
    label: "Signature generator",
    sub: "Type a name, pick a script font, download a transparent PNG signature",
    blurb: "Type a name, pick a script font, export PNG",
    badge: "PNG",
    icon: PenLine,
    countries: ["*"],
    docTypes: ["signature"],
    render: () => <SignatureTool />,
  },
  {
    id: "address",
    label: "Dutch address generator",
    sub: "Plausible street, house number & postcode for Rotterdam, Amsterdam or Zoetermeer",
    blurb: "Plausible NL street + postcode for 3 cities",
    badge: "NLD",
    icon: MapPin,
    countries: ["NL"],
    docTypes: ["address"],
    render: () => <AddressTool />,
  },
  {
    id: "detax",
    label: "DE Tax · Steuer-ID & Steuernummer",
    sub: "11-digit personal tax ID + per-Bundesland Steuernummer (validate, generate, convert)",
    blurb: "Steuer-ID + per-Bundesland Steuernummer tools",
    badge: "DE",
    icon: Receipt,
    countries: ["DE"],
    docTypes: ["tax-id"],
    render: () => (
      <div className="space-y-8">
        <div>
          <div className="text-white/65 text-[10px] mono uppercase tracking-[0.16em] mb-3">
            Steuer-ID · 11-digit personal tax identifier
          </div>
          <SteuerIdTool />
        </div>
        <div className="border-t border-white/10 pt-6">
          <div className="text-white/65 text-[10px] mono uppercase tracking-[0.16em] mb-3">
            Steuernummer · per-Bundesland tax number
          </div>
          <DeSteuernummerToolBody />
        </div>
      </div>
    ),
  },
];

function toolMatches(
  t: ToolDef,
  search: string,
  country: CountryTag | "ALL",
  docType: DocTypeTag | "ALL",
): boolean {
  if (search) {
    const q = search.toLowerCase();
    const hay = `${t.label} ${t.sub} ${t.badge} ${t.docTypes.join(" ")} ${t.countries.join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (country !== "ALL" && !t.countries.includes("*") && !t.countries.includes(country)) return false;
  if (docType !== "ALL" && !t.docTypes.includes(docType)) return false;
  return true;
}

function FilterPill({
  active,
  highlighted,
  onClick,
  children,
}: {
  active: boolean;
  highlighted: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 px-3.5 rounded-full text-[11px] mono uppercase tracking-[0.14em] transition-all border ${
        active
          ? "bg-white text-black border-white shadow-[0_0_0_3px_rgba(255,255,255,0.15)]"
          : highlighted
          ? "bg-white/5 text-white/60 border-white/10 opacity-50"
          : "bg-black/20 text-white/65 border-white/10 hover:text-white hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

export function NLToolsStep({ onBack, initialTab }: { onBack: () => void; initialTab?: ToolTab }) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState<CountryTag | "ALL">("ALL");
  const [docType, setDocType] = useState<DocTypeTag | "ALL">("ALL");

  // Honour an initialTab hint by setting the most-specific filter pair so the
  // requested tool is the first (or only) match without forcing a tab UI.
  useEffect(() => {
    if (!initialTab) return;
    const seed = TOOL_REGISTRY.find((t) => t.id === initialTab);
    if (!seed) return;
    setSearch(seed.label);
  }, [initialTab]);

  const filtered = TOOL_REGISTRY.filter((t) => toolMatches(t, search, country, docType));
  const countryActive = country !== "ALL";
  const docTypeActive = docType !== "ALL";
  const anyFilter = countryActive || docTypeActive || search.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <div className="eyebrow mb-3">Validate &amp; generate</div>
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          Validate &amp; generate tools
        </h1>
        <p className="text-white/55 mt-3 max-w-xl mx-auto">
          Search any tool by name, or filter by country and document type. All math runs locally
          — no network calls, no live lookups.
        </p>
      </div>

      <div className="rounded-2xl border border-white/12 bg-black/25 p-4 mb-5 flex items-start gap-3">
        <ShieldAlert className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
        <div className="text-xs text-white/75 leading-relaxed">
          <span className="text-amber-300 mono uppercase tracking-[0.14em]">Synthetic test data only.</span>
        </div>
      </div>

      {/* Full-width search bar */}
      <div className="glass p-3 sm:p-4 mb-4">
        <div className="flex items-center gap-3 h-14 px-4 rounded-2xl bg-black/30 border border-white/12 focus-within:border-white/35 transition-colors">
          <Search className="w-5 h-5 text-white/55" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tools — e.g. iban, bsn, steuer, vat, document number…"
            className="flex-1 bg-transparent outline-none text-white text-base placeholder:text-white/35"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-white/45 hover:text-white"
            >
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* Two filter blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div
          className={`rounded-2xl border p-4 transition-all ${
            countryActive
              ? "border-white/35 bg-white/5 shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
              : "border-white/12 bg-black/25"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-white" strokeWidth={1.8} />
              <div className="eyebrow">Country</div>
              {countryActive && (
                <span className="mono text-[9px] uppercase tracking-[0.14em] text-emerald-300/90 px-1.5 py-0.5 rounded-full border border-emerald-300/30 bg-emerald-300/10">
                  Filter active
                </span>
              )}
            </div>
            {countryActive && (
              <button
                type="button"
                onClick={() => setCountry("ALL")}
                className="text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COUNTRY_FILTERS.map((c) => (
              <FilterPill
                key={c.id}
                active={country === c.id}
                highlighted={countryActive && country !== c.id}
                onClick={() => setCountry(c.id)}
              >
                {c.iso && <Flag code={c.iso} className="w-4 h-auto rounded-[2px] mr-1.5 inline-block align-[-2px] ring-1 ring-black/20" />}
                {c.label}
              </FilterPill>
            ))}
          </div>
        </div>

        <div
          className={`rounded-2xl border p-4 transition-all ${
            docTypeActive
              ? "border-white/35 bg-white/5 shadow-[0_0_0_3px_rgba(255,255,255,0.06)]"
              : "border-white/12 bg-black/25"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-white" strokeWidth={1.8} />
              <div className="eyebrow">Document type</div>
              {docTypeActive && (
                <span className="mono text-[9px] uppercase tracking-[0.14em] text-emerald-300/90 px-1.5 py-0.5 rounded-full border border-emerald-300/30 bg-emerald-300/10">
                  Filter active
                </span>
              )}
            </div>
            {docTypeActive && (
              <button
                type="button"
                onClick={() => setDocType("ALL")}
                className="text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DOCTYPE_FILTERS.map((d) => (
              <FilterPill
                key={d.id}
                active={docType === d.id}
                highlighted={docTypeActive && docType !== d.id}
                onClick={() => setDocType(d.id)}
              >
                {d.label}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>

      {/* Suggested tools — filter-aware carousel */}
      <SuggestedToolsRow
        country={country}
        docType={docType}
        onPick={(id) => {
          const seed = TOOL_REGISTRY.find((t) => t.id === id);
          if (seed) setSearch(seed.label);
        }}
      />

      {/* Result summary */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="text-white/55 text-xs">
          {filtered.length} of {TOOL_REGISTRY.length} tools
          {anyFilter && <span className="text-white/35"> · filtered</span>}
        </div>
        {anyFilter && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCountry("ALL");
              setDocType("ALL");
            }}
            className="text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Tool list */}
      <div className="space-y-5">
        {filtered.length === 0 && (
          <div className="glass p-8 text-center">
            <div className="text-white/65 text-sm mb-1">No tools match these filters.</div>
            <div className="text-white/40 text-xs">
              Try widening your country or document-type filter, or clear the search.
            </div>
          </div>
        )}

        {filtered.map((t) => (
          <section key={t.id} className="glass p-5 sm:p-6">
            <header className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0">
                <div className="text-white text-lg tracking-tight">{t.label}</div>
                <div className="text-white/55 text-xs mt-0.5">{t.sub}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                {t.countries.map((c) => (
                  <span
                    key={c}
                    className="mono text-[10px] uppercase tracking-[0.14em] text-white/55 px-2 py-0.5 rounded-full border border-white/12"
                  >
                    {c === "*" ? "Global" : c}
                  </span>
                ))}
                {t.docTypes.map((d) => (
                  <span
                    key={d}
                    className="mono text-[10px] uppercase tracking-[0.14em] text-white/45 px-2 py-0.5 rounded-full border border-white/10 bg-black/30"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </header>
            {t.render({ activeCountry: country })}
          </section>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <BackButton onClick={onBack} />
        <div className="text-white/40 text-[11px] mono uppercase tracking-[0.16em]">
          all math runs locally · no data leaves your browser
        </div>
      </div>
    </div>
  );
}

function DocNumberTool() {
  const [input, setInput] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const [era, setEra] = useState<"pre-2019" | "post-2019">("post-2019");

  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
  const result = cleaned.length === 9 ? checkDocNumber(cleaned, era) : null;

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(generateDocNumber(era));
    setGenerated(out);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-white/65 text-[10px] mono uppercase tracking-[0.16em]">
            RvIG numbering era
          </div>
          <DocRulesInfoButton
            country="NL"
            family={era === "post-2019" ? "identity_card" : "identity_card"}
            issueDate={era === "post-2019" ? "2022-01-01" : "2018-01-01"}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setEra("post-2019")}
            className={`h-8 px-3 rounded-full text-[11px] mono uppercase tracking-[0.14em] border transition-colors ${
              era === "post-2019"
                ? "bg-white text-black border-white"
                : "bg-black/30 text-white/70 border-white/12 hover:text-white hover:border-white/30"
            }`}
          >
            Post-1-Dec-2019 · no 0
          </button>
          <button
            type="button"
            onClick={() => setEra("pre-2019")}
            className={`h-8 px-3 rounded-full text-[11px] mono uppercase tracking-[0.14em] border transition-colors ${
              era === "pre-2019"
                ? "bg-white text-black border-white"
                : "bg-black/30 text-white/70 border-white/12 hover:text-white hover:border-white/30"
            }`}
          >
            2014 model · pre-Dec-2019 · 0 allowed
          </button>
        </div>
      </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ToolPanel
        title="Check"
        subtitle={
          era === "post-2019"
            ? "9 chars · pos 1-2 letters · no O · no 0 · pos 9 = 1–9"
            : "9 chars · pos 1-2 letters · no O · 0 allowed · pos 9 = 0–9"
        }
        accent={
          result?.ok ? "ok" : cleaned.length === 9 ? "err" : cleaned.length > 0 ? "warn" : "idle"
        }
      >
        <Field
          label="Document number"
          value={cleaned}
          onChange={setInput}
          placeholder="L01X00T47"
          maxLength={9}
          mono
          uppercase
          status={cleaned.length === 9 ? (result?.ok ? "ok" : "err") : null}
        />
        {cleaned.length > 0 && cleaned.length < 9 && (
          <StatusRow tone="warn" icon={<AlertCircle className="w-4 h-4" strokeWidth={2} />}>
            {cleaned.length}/9 — keep typing.
          </StatusRow>
        )}
        {result && (
          <>
            <StatusRow
              tone={result.ok ? "ok" : "err"}
              icon={
                result.ok ? (
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <AlertCircle className="w-4 h-4" strokeWidth={2} />
                )
              }
            >
              {result.ok ? "Valid ICAO check digit." : result.reason}
            </StatusRow>
            {result.sum !== undefined && (
              <div className="mono text-[11px] text-white/55 mt-2">
                Σ = {result.sum} · {result.sum} mod 10 = <span className="text-white/85">{result.expected}</span>
              </div>
            )}
          </>
        )}
      </ToolPanel>

      <ToolPanel
        title="Generate"
        subtitle={
          era === "post-2019"
            ? "Valid 9-char numbers · no O · no 0 · ICAO check digit 1–9"
            : "Valid 9-char numbers · 2014 model · no O · 0 allowed · check digit 0–9"
        }
      >
        <div className="flex gap-2 flex-wrap">
          <PrimaryButton onClick={() => gen(1)}>
            <Shuffle className="w-4 h-4" strokeWidth={2} />
            One
          </PrimaryButton>
          <SecondaryButton onClick={() => gen(10)}>
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
        {generated.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {generated.map((g, i) => (
              <GeneratedRow key={i} value={g} verdict={era === "post-2019" ? "post-2019" : "pre-2019"} />
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
    </div>
  );
}

function BSNTool() {
  const [input, setInput] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);

  const cleaned = input.replace(/\D/g, "").slice(0, 9);
  const result = cleaned.length >= 8 ? checkBSN(cleaned) : null;

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(generateBSN());
    setGenerated(out);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ToolPanel
        title="Check"
        subtitle="Accepts 8 or 9 digits (8 → padded with leading 0)"
        accent={result?.ok ? "ok" : cleaned.length >= 8 ? "err" : cleaned.length > 0 ? "warn" : "idle"}
      >
        <Field
          label="BSN"
          value={cleaned}
          onChange={setInput}
          placeholder="123456782"
          maxLength={9}
          mono
          status={cleaned.length >= 8 ? (result?.ok ? "ok" : "err") : null}
        />
        {cleaned.length > 0 && cleaned.length < 8 && (
          <StatusRow tone="warn" icon={<AlertCircle className="w-4 h-4" strokeWidth={2} />}>
            {cleaned.length}/9 — keep typing.
          </StatusRow>
        )}
        {result && (
          <>
            <StatusRow
              tone={result.ok ? "ok" : "err"}
              icon={
                result.ok ? (
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                ) : (
                  <AlertCircle className="w-4 h-4" strokeWidth={2} />
                )
              }
            >
              {result.ok ? "Elfproef passes — mathematically valid BSN." : result.reason}
            </StatusRow>
            {result.normalized && result.normalized !== cleaned && (
              <div className="mono text-[11px] text-white/55 mt-2">
                Normalized to 9 digits: <span className="text-white/85">{result.normalized}</span>
              </div>
            )}
            {result.sum !== undefined && (
              <div className="mono text-[11px] text-white/55 mt-1">
                Σ = {result.sum} · {result.sum} mod 11 = <span className="text-white/85">{result.sum % 11}</span>
              </div>
            )}
          </>
        )}
      </ToolPanel>

      <ToolPanel title="Generate" subtitle="Mathematically valid BSNs (test data only — not real people)">
        <div className="flex gap-2 flex-wrap">
          <PrimaryButton onClick={() => gen(1)}>
            <Shuffle className="w-4 h-4" strokeWidth={2} />
            One
          </PrimaryButton>
          <SecondaryButton onClick={() => gen(10)}>
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
        {generated.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {generated.map((g, i) => (
              <GeneratedRow key={i} value={g} verdict="elfproef ok" />
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
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
    <div className={`mt-3 rounded-xl border px-3 py-2.5 flex items-center gap-2 text-xs ${cls}`}>
      <span className="shrink-0">{icon}</span>
      <span className="leading-snug">{children}</span>
    </div>
  );
}

function IbanTool({ defaultCountry }: { defaultCountry?: string } = {}) {
  const [input, setInput] = useState("");
  const [country, setCountry] = useState(() => {
    if (defaultCountry && IBAN_REGISTRY.some((c) => c.code === defaultCountry)) return defaultCountry;
    return "NL";
  });
  const [generated, setGenerated] = useState<string[]>([]);

  useEffect(() => {
    if (defaultCountry && IBAN_REGISTRY.some((c) => c.code === defaultCountry)) {
      setCountry(defaultCountry);
    }
  }, [defaultCountry]);

  const normalized = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const result: IbanCheckResult | null = normalized.length >= 4 ? checkIban(normalized) : null;
  const breakdown = result?.ok ? breakdownIban(normalized).result : undefined;

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const v = generateIban(country);
      if (v) out.push(v);
    }
    setGenerated(out);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <ToolPanel
          title="Validate &amp; break down"
          subtitle="ISO 13616 · MOD97-10 checksum + per-field breakdown"
          accent={result?.ok ? "ok" : normalized.length >= 4 ? "err" : "idle"}
        >
          <Field
            label="IBAN"
            value={normalized}
            onChange={setInput}
            placeholder="NL91ABNA0417164300"
            maxLength={34}
            mono
            uppercase
          />
          {result && (
            <div className="mt-3 space-y-1.5">
              {result.steps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 border ${
                    s.ok
                      ? "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-200"
                      : "border-rose-300/30 bg-rose-300/[0.06] text-rose-200"
                  }`}
                >
                  {s.ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                  )}
                  <span className="text-white/75">{s.label}</span>
                  {s.detail && <span className="mono text-white/45 truncate">· {s.detail}</span>}
                </div>
              ))}
            </div>
          )}
          {breakdown && (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3 space-y-1.5">
              <div className="text-[10px] mono uppercase tracking-[0.16em] text-white/45 mb-1">
                Breakdown · {breakdown.countryName}
              </div>
              <BreakdownField label="Print" value={formatIban(normalized)} />
              <BreakdownField label="Country" value={breakdown.country} />
              <BreakdownField label="Check digits" value={breakdown.checkDigits} />
              <BreakdownField label="BBAN" value={breakdown.bban} />
              <BreakdownField label="Bank" value={breakdown.bankCode ?? "Unknown"} muted={!breakdown.bankCode} />
              <BreakdownField label="Branch" value={breakdown.branchCode ?? "Unknown"} muted={!breakdown.branchCode} />
              <BreakdownField label="Account" value={breakdown.accountNumber ?? "Unknown"} muted={!breakdown.accountNumber} />
            </div>
          )}
        </ToolPanel>

        <ToolPanel title="Generate" subtitle="Synthetic IBANs per country BBAN pattern">
          <CountrySelect
            value={country}
            onChange={setCountry}
            options={IBAN_REGISTRY.map((c) => ({ code: c.code, label: `${c.code} · ${c.name}` }))}
          />
          <div className="flex gap-2 flex-wrap mt-3">
            <PrimaryButton onClick={() => gen(1)}>
              <Shuffle className="w-4 h-4" strokeWidth={2} />
              One
            </PrimaryButton>
            <SecondaryButton onClick={() => gen(10)}>
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
          {generated.length > 0 && (
            <div className="mt-4 space-y-1.5">
              {generated.map((g, i) => (
                <GeneratedRow key={i} value={formatIban(g)} verdict="mod97 ok" />
              ))}
            </div>
          )}
        </ToolPanel>
      </div>
    </div>
  );
}

function VatTool({ defaultCountry }: { defaultCountry?: string } = {}) {
  const [input, setInput] = useState("");
  const [country, setCountry] = useState(() => {
    if (defaultCountry && VAT_REGISTRY.some((c) => c.code === defaultCountry)) return defaultCountry;
    return "DE";
  });
  const [generated, setGenerated] = useState<string[]>([]);

  useEffect(() => {
    if (defaultCountry && VAT_REGISTRY.some((c) => c.code === defaultCountry)) {
      setCountry(defaultCountry);
    }
  }, [defaultCountry]);

  const normalized = input.toUpperCase().replace(/[\s\-\._]/g, "");
  const result = normalized.length >= 3 ? checkVat(normalized) : null;

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const v = generateVat(country);
      if (v) out.push(v);
    }
    setGenerated(out);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ToolPanel
        title="Validate"
        subtitle="Format-only · no live VIES lookup"
        accent={result?.ok ? "ok" : normalized.length >= 3 ? "err" : "idle"}
      >
        <Field
          label="VAT number"
          value={normalized}
          onChange={setInput}
          placeholder="DE123456789"
          maxLength={20}
          mono
          uppercase
        />
        {result && (
          <div className="mt-3 space-y-1.5">
            {result.steps.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-[11px] rounded-lg px-2.5 py-1.5 border ${
                  s.ok
                    ? "border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-200"
                    : "border-rose-300/30 bg-rose-300/[0.06] text-rose-200"
                }`}
              >
                {s.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                )}
                <span className="text-white/75">{s.label}</span>
                {s.detail && <span className="mono text-white/45 truncate">· {s.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </ToolPanel>

      <ToolPanel title="Generate" subtitle="Country prefix + format-valid body">
        <CountrySelect
          value={country}
          onChange={setCountry}
          options={VAT_REGISTRY.map((c) => ({ code: c.code, label: `${c.code} · ${c.name}` }))}
        />
        <div className="flex gap-2 flex-wrap mt-3">
          <PrimaryButton onClick={() => gen(1)}>
            <Shuffle className="w-4 h-4" strokeWidth={2} />
            One
          </PrimaryButton>
          <SecondaryButton onClick={() => gen(10)}>
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
        {generated.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {generated.map((g, i) => (
              <GeneratedRow key={i} value={formatVat(g)} verdict="format ok" />
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
  );
}

function CountrySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { code: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="text-white/65 text-xs mb-1.5 tracking-wide">Country</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input w-full px-3.5 h-11 mono"
        style={{ colorScheme: "dark" }}
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function BreakdownField({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="text-white/50 mono uppercase tracking-[0.14em]">{label}</span>
      <span className={`mono tracking-[0.12em] truncate ${muted ? "text-white/35" : "text-white"}`}>
        {value}
      </span>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-white/15 bg-white/[0.04] text-white/75 text-[10px] mono uppercase tracking-[0.14em]">
      {children}
    </span>
  );
}

function GeneratedRow({ value, verdict }: { value: string; verdict: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <button
      onClick={copy}
      className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/30 px-3.5 py-2.5 hover:bg-white/5 transition-colors group"
    >
      <span className="mono text-white text-sm tracking-[0.16em]">{value}</span>
      <span className="flex items-center gap-2">
        <span className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-300/85">{verdict}</span>
        {copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-300" strokeWidth={2.5} />
        ) : (
          <Copy className="w-3.5 h-3.5 text-white/45 group-hover:text-white" strokeWidth={2} />
        )}
      </span>
    </button>
  );
}

/* ===================== KVK — Dutch Chamber of Commerce =====================
 * Local format validation only. A KVK number is exactly 8 digits, with no
 * published checksum, so we cannot prove a number is *issued* without an
 * authoritative lookup. The live OpenKvK/Overheid.io v3 lookup requires a
 * server-side API key (must never ship to the browser) so we render a
 * "lookup unavailable" notice in this frontend-only build.
 * ======================================================================== */

type KvkFormatCheck = {
  name: "length" | "digits_only";
  passed: boolean;
  details: string;
};

type KvkFormatResult = {
  valid: boolean;
  normalized: string | null;
  checks: KvkFormatCheck[];
};

export function normalizeKvkNumber(raw: string): string {
  return (raw || "").replace(/[\s.\-_]/g, "");
}

export function validateKvkFormat(raw: string): KvkFormatResult {
  const normalized = normalizeKvkNumber(raw);
  const digitsOnly = /^[0-9]*$/.test(normalized);
  const correctLength = normalized.length === 8;
  const checks: KvkFormatCheck[] = [
    {
      name: "digits_only",
      passed: digitsOnly,
      details: digitsOnly
        ? "KVK number contains only digits."
        : "Letters or symbols are not allowed.",
    },
    {
      name: "length",
      passed: correctLength,
      details: correctLength
        ? "KVK number has 8 digits."
        : `Expected 8 digits, got ${normalized.length}.`,
    },
  ];
  return {
    valid: digitsOnly && correctLength,
    normalized: digitsOnly && correctLength ? normalized : null,
    checks,
  };
}

export function generateKvkNumber(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

type KvkLookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "notfound"; message: string }
  | { status: "unavailable"; message: string }
  | { status: "found"; company: any; matches: any[]; disclaimer?: string };

function KvkTool() {
  const [input, setInput] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const [lookup, setLookup] = useState<KvkLookupState>({ status: "idle" });
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedName, setCopiedName] = useState(false);

  const normalized = normalizeKvkNumber(input);
  const result = normalized.length > 0 ? validateKvkFormat(input) : null;

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(generateKvkNumber());
    setGenerated(out);
  };

  const runLookup = async () => {
    if (!result?.valid || !result.normalized) return;
    setLookup({ status: "loading" });
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-11021192/kvk/lookup?kvk=${encodeURIComponent(
        result.normalized,
      )}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        setLookup({
          status: "error",
          message: data?.error ?? "Lookup failed. Please try again.",
        });
        return;
      }
      if (data.found) {
        setLookup({
          status: "found",
          company: data.company,
          matches: data.matches ?? [],
          disclaimer: data.disclaimer,
        });
        return;
      }
      const isUnavailable = data?.source?.provider === "local_format_only";
      setLookup({
        status: isUnavailable ? "unavailable" : "notfound",
        message: data.message ?? "No company found for this KVK number.",
      });
    } catch (e: any) {
      console.log(`KVK lookup network error: ${e}`);
      setLookup({
        status: "error",
        message: "Network error contacting the lookup provider.",
      });
    }
  };

  const copyJson = async () => {
    if (lookup.status !== "found") return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(lookup.company, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 1200);
    } catch {}
  };
  const copyName = async () => {
    if (lookup.status !== "found" || !lookup.company?.name) return;
    try {
      await navigator.clipboard.writeText(lookup.company.name);
      setCopiedName(true);
      setTimeout(() => setCopiedName(false), 1200);
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ToolPanel
        title="Validate"
        subtitle="Dutch KVK (Chamber of Commerce) number — 8 digits, no checksum"
        accent={result?.valid ? "ok" : normalized.length > 0 ? "err" : "idle"}
      >
        <Field
          label="KVK number"
          value={input}
          onChange={setInput}
          placeholder="58488340"
          maxLength={14}
          mono
          status={normalized.length > 0 ? (result?.valid ? "ok" : "err") : null}
        />

        {result && (
          <>
            <div className="mt-3 space-y-1.5">
              {result.checks.map((c) => (
                <div
                  key={c.name}
                  className={`flex items-start gap-2 text-[11px] mono ${
                    c.passed ? "text-emerald-300/90" : "text-rose-300/90"
                  }`}
                >
                  {c.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                  )}
                  <span className="leading-snug">{c.details}</span>
                </div>
              ))}
            </div>
            {result.valid && result.normalized && (
              <div className="mono text-[11px] text-white/55 mt-3">
                Normalized: <span className="text-white/85">{result.normalized}</span>
              </div>
            )}
          </>
        )}

        <div className="mt-4 flex gap-2 flex-wrap">
          <PrimaryButton
            onClick={runLookup}
            disabled={!result?.valid || lookup.status === "loading"}
          >
            {lookup.status === "loading" ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
            ) : (
              <Search className="w-4 h-4" strokeWidth={2} />
            )}
            Lookup company
          </PrimaryButton>
          {lookup.status !== "idle" && lookup.status !== "loading" && (
            <SecondaryButton onClick={() => setLookup({ status: "idle" })}>
              <X className="w-4 h-4" strokeWidth={2} />
              Clear
            </SecondaryButton>
          )}
        </div>

        {lookup.status === "error" && (
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-rose-300 mt-0.5 shrink-0" strokeWidth={2} />
            <div className="text-rose-100/90 text-[11px] leading-relaxed">{lookup.message}</div>
          </div>
        )}

        {lookup.status === "notfound" && (
          <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-300/85 mt-0.5 shrink-0" strokeWidth={2} />
            <div className="text-amber-200/85 text-[11px] leading-relaxed">{lookup.message}</div>
          </div>
        )}

        {lookup.status === "unavailable" && (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-white/55 mt-0.5 shrink-0" strokeWidth={2} />
            <div className="text-white/60 text-[11px] leading-relaxed">
              <span className="text-white/85">Live lookup not configured.</span>{" "}
              {lookup.message} Add the <span className="mono">openkvk_api_key</span>{" "}
              Supabase secret to enable real company data.
            </div>
          </div>
        )}

        {lookup.status === "found" && (
          <div className="mt-4 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.04] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-emerald-200/90 text-[10px] mono uppercase tracking-[0.16em]">
                  <Building2 className="w-3 h-3" strokeWidth={2.5} />
                  Company found · public-data match
                </div>
                <div className="mt-1 text-white text-base truncate">
                  {lookup.company?.name ?? "(no name)"}
                </div>
                <div className="mono text-[11px] text-white/55 mt-0.5">
                  KVK {lookup.company?.kvkNumber}
                  {lookup.company?.branchNumber ? ` · vestiging ${lookup.company.branchNumber}` : ""}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={copyName}
                  className="inline-flex items-center gap-1 rounded-full px-2 h-7 text-[10px] mono uppercase tracking-wider border border-white/10 bg-white/[0.04] text-white/75 hover:text-white hover:bg-white/[0.08]"
                  title="Copy company name"
                >
                  {copiedName ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <Copy className="w-3 h-3" strokeWidth={2} />}
                  Name
                </button>
                <button
                  type="button"
                  onClick={copyJson}
                  className="inline-flex items-center gap-1 rounded-full px-2 h-7 text-[10px] mono uppercase tracking-wider border border-white/10 bg-white/[0.04] text-white/75 hover:text-white hover:bg-white/[0.08]"
                  title="Copy full JSON"
                >
                  {copiedJson ? <Check className="w-3 h-3" strokeWidth={2.5} /> : <Copy className="w-3 h-3" strokeWidth={2} />}
                  JSON
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] mono">
              {lookup.company?.legalForm && (
                <KvkRow label="Legal form" value={lookup.company.legalForm} />
              )}
              {lookup.company?.active != null && (
                <KvkRow
                  label="Status"
                  value={lookup.company.active ? "Active" : "Inactive"}
                  tone={lookup.company.active ? "ok" : "warn"}
                />
              )}
              {lookup.company?.registrationDate && (
                <KvkRow label="Registered" value={lookup.company.registrationDate} />
              )}
              {lookup.company?.website && (
                <KvkRow
                  label="Website"
                  value={
                    <a
                      href={lookup.company.website.startsWith("http") ? lookup.company.website : `https://${lookup.company.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:underline inline-flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3" strokeWidth={2} />
                      {lookup.company.website}
                    </a>
                  }
                />
              )}
            </div>

            {lookup.company?.address?.fullAddress && (
              <div className="flex items-start gap-2 text-[11px] mono text-white/75">
                <MapPin className="w-3 h-3 mt-0.5 text-white/45 shrink-0" strokeWidth={2} />
                <span>{lookup.company.address.fullAddress}</span>
              </div>
            )}

            {Array.isArray(lookup.company?.activities) && lookup.company.activities.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] mono uppercase tracking-[0.16em] text-white/45">
                  SBI activities
                </div>
                {lookup.company.activities.slice(0, 5).map((a: any, i: number) => (
                  <div key={i} className="text-[11px] mono text-white/75">
                    <span className="text-white/45">{a.sbiCode}</span>{" "}
                    {a.sbiDescription}
                    {a.isMainActivity && (
                      <span className="ml-1 text-emerald-300/80">· main</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(lookup.matches) && lookup.matches.length > 1 && (
              <details className="text-[11px]">
                <summary className="cursor-pointer text-white/55 hover:text-white">
                  {lookup.matches.length} other matches
                </summary>
                <div className="mt-2 space-y-1">
                  {lookup.matches.map((m: any, i: number) => (
                    <div key={i} className="mono text-white/70">
                      <span className="text-white/45">{m.kvkNumber}</span>{" "}
                      {m.name} {m.city ? `· ${m.city}` : ""}
                    </div>
                  ))}
                </div>
              </details>
            )}

            <div className="text-[10px] text-white/45 leading-relaxed pt-1 border-t border-white/5">
              {lookup.disclaimer ??
                "Not a legally certified KVK extract. For binding info, use KVK.nl."}
            </div>
          </div>
        )}
      </ToolPanel>

      <ToolPanel
        title="Generate"
        subtitle="Random 8-digit KVK-shaped numbers (test data only — no checksum exists)"
      >
        <div className="flex gap-2 flex-wrap">
          <PrimaryButton onClick={() => gen(1)}>
            <Shuffle className="w-4 h-4" strokeWidth={2} />
            One
          </PrimaryButton>
          <SecondaryButton onClick={() => gen(10)}>
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
        {generated.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {generated.map((g, i) => (
              <GeneratedRow key={i} value={g} verdict="format ok" />
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
  );
}

function KvkRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span
        className={
          tone === "ok"
            ? "text-emerald-300/90"
            : tone === "warn"
            ? "text-amber-300/90"
            : "text-white/85"
        }
      >
        {value}
      </span>
    </div>
  );
}

/* ===================== German Steuer-ID (IdNr) =============================
 * Per ELSTER spec: 11 digits, position 11 is the check digit.
 * First 10 digits must satisfy a distribution rule:
 *   - exactly one digit appears twice and one digit is missing, OR
 *   - exactly one digit appears three times (non-adjacent) and two are missing.
 * Check digit uses the ISO 7064 MOD 11,10-style ELSTER algorithm.
 * Synthetic test data only.
 * ======================================================================== */

export function normalizeGermanSteuerId(raw: string): string {
  return (raw || "").replace(/[\s.\-/]/g, "");
}

export function calculateGermanSteuerIdCheckDigit(first10: string): number {
  if (!/^\d{10}$/.test(first10)) {
    throw new Error("German Steuer-ID check digit requires exactly 10 digits.");
  }
  const n = 11;
  const m = 10;
  let product = m;
  for (const ch of first10) {
    const digit = Number(ch);
    let sum = (digit + product) % m;
    if (sum === 0) sum = m;
    product = (2 * sum) % n;
  }
  const cd = n - product;
  return cd === 10 ? 0 : cd;
}

type SteuerCheck = { name: string; passed: boolean; details?: string };

export function validateGermanSteuerId(
  raw: string,
  options: { allowTestLeadingZero?: boolean } = {},
) {
  const normalized = normalizeGermanSteuerId(raw);
  const checks: SteuerCheck[] = [];

  const digitsOnly = /^\d*$/.test(normalized);
  checks.push({
    name: "digits_only",
    passed: digitsOnly,
    details: digitsOnly ? "Digits only." : "Letters or symbols are not allowed.",
  });
  const lengthOk = normalized.length === 11;
  checks.push({
    name: "length",
    passed: lengthOk,
    details: lengthOk ? "11 digits." : `Expected 11 digits, got ${normalized.length}.`,
  });
  if (!digitsOnly || !lengthOk) {
    return { valid: false, normalized: null, checks };
  }

  const first10 = normalized.slice(0, 10);
  const leadingOk = options.allowTestLeadingZero ? true : first10[0] !== "0";
  checks.push({
    name: "leading_zero",
    passed: leadingOk,
    details: leadingOk
      ? "Leading digit is non-zero."
      : "Leading zero is reserved for test numbers.",
  });

  const counts = new Map<string, number>();
  for (const ch of first10) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  const freq = Array.from(counts.values()).sort((a, b) => b - a);
  const missing = 10 - counts.size;
  let distOk = false;
  let distDetail = "";
  if (freq[0] === 2 && (freq[1] ?? 0) === 1 && missing === 1) {
    distOk = true;
    distDetail = "One digit appears twice; one digit missing.";
  } else if (freq[0] === 3 && (freq[1] ?? 0) === 1 && missing === 2) {
    // triple — check non-adjacency
    let tripleDigit = "";
    for (const [d, c] of counts) if (c === 3) tripleDigit = d;
    let adjacent = false;
    for (let i = 0; i < first10.length - 1; i++) {
      if (first10[i] === tripleDigit && first10[i + 1] === tripleDigit) {
        adjacent = true;
        break;
      }
    }
    distOk = !adjacent;
    distDetail = adjacent
      ? "Tripled digit appears adjacent — not allowed."
      : "One digit appears three times (non-adjacent); two digits missing.";
  } else {
    distDetail = "First 10 digits do not match the required distribution.";
  }
  checks.push({ name: "digit_distribution", passed: distOk, details: distDetail });

  const expected = calculateGermanSteuerIdCheckDigit(first10);
  const cdOk = expected === Number(normalized[10]);
  checks.push({
    name: "check_digit",
    passed: cdOk,
    // Per spec: do not reveal expected digit publicly on failure.
    details: cdOk ? "Check digit matches." : "Check digit failed.",
  });

  const valid = checks.every((c) => c.passed);
  return { valid, normalized, checks };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateSyntheticGermanSteuerId(
  options: {
    distributionMode?: "double" | "triple" | "random";
    allowTestLeadingZero?: boolean;
  } = {},
): string {
  const mode =
    options.distributionMode === "random" || !options.distributionMode
      ? Math.random() < 0.5
        ? "double"
        : "triple"
      : options.distributionMode;

  for (let attempt = 0; attempt < 500; attempt++) {
    const all = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const present = [...all];
    // remove "missing" digits
    const missingCount = mode === "double" ? 1 : 2;
    for (let i = 0; i < missingCount; i++) {
      const idx = Math.floor(Math.random() * present.length);
      present.splice(idx, 1);
    }
    // pool: each present digit once, plus extras to reach 10
    const pool: string[] = [...present];
    if (mode === "double") {
      pool.push(pickRandom(present));
    } else {
      const triple = pickRandom(present);
      pool.push(triple, triple);
    }
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // leading zero rule
    if (!options.allowTestLeadingZero && pool[0] === "0") continue;
    const first10 = pool.join("");
    // adjacency check for triple
    if (mode === "triple") {
      let bad = false;
      for (let i = 0; i < 9; i++) if (first10[i] === first10[i + 1]) {
        // could be the tripled digit OR a coincidental double — only matters for triple
        const counts = new Map<string, number>();
        for (const ch of first10) counts.set(ch, (counts.get(ch) ?? 0) + 1);
        if (counts.get(first10[i]) === 3) { bad = true; break; }
      }
      if (bad) continue;
    }
    const cd = calculateGermanSteuerIdCheckDigit(first10);
    const value = first10 + String(cd);
    const v = validateGermanSteuerId(value, options);
    if (v.valid) return value;
  }
  throw new Error("Failed to generate synthetic Steuer-ID after 500 attempts.");
}

function formatSteuerId(value: string): string {
  if (value.length !== 11) return value;
  return `${value.slice(0, 2)} ${value.slice(2, 5)} ${value.slice(5, 8)} ${value.slice(8, 11)}`;
}

function SteuerIdTool() {
  const [input, setInput] = useState("");
  const [generated, setGenerated] = useState<string[]>([]);
  const [allowTestLeadingZero, setAllowTestLeadingZero] = useState(false);
  const [mode, setMode] = useState<"random" | "double" | "triple">("random");

  const result =
    normalizeGermanSteuerId(input).length > 0
      ? validateGermanSteuerId(input, { allowTestLeadingZero })
      : null;

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      try {
        out.push(generateSyntheticGermanSteuerId({ distributionMode: mode, allowTestLeadingZero }));
      } catch {}
    }
    setGenerated(out);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ToolPanel
        title="Validate"
        subtitle="German Steuer-ID — 11 digits, ELSTER check digit + distribution rules"
        accent={result?.valid ? "ok" : result ? "err" : "idle"}
      >
        <Field
          label="Steuer-ID"
          value={input}
          onChange={setInput}
          placeholder="86 095 742 719"
          maxLength={20}
          mono
          status={result ? (result.valid ? "ok" : "err") : null}
        />
        <label className="mt-3 inline-flex items-center gap-2 text-[11px] text-white/55 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allowTestLeadingZero}
            onChange={(e) => setAllowTestLeadingZero(e.target.checked)}
            className="accent-white/80"
          />
          Allow test leading zero
        </label>

        {result && (
          <div className="mt-3 space-y-1.5">
            {result.checks.map((c) => (
              <div
                key={c.name}
                className={`flex items-start gap-2 text-[11px] mono ${
                  c.passed ? "text-emerald-300/90" : "text-rose-300/90"
                }`}
              >
                {c.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" strokeWidth={2} />
                )}
                <span className="leading-snug">{c.details}</span>
              </div>
            ))}
            {result.valid && result.normalized && (
              <div className="mono text-[11px] text-white/55 mt-3">
                Normalized: <span className="text-white/85">{formatSteuerId(result.normalized)}</span>
              </div>
            )}
          </div>
        )}

      </ToolPanel>

      <ToolPanel
        title="Generate"
        subtitle="Synthetic Steuer-ID for software testing only"
      >
        <div className="flex flex-wrap gap-2 mb-3">
          {(["random", "double", "triple"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 h-7 rounded-full text-[10px] mono uppercase tracking-[0.16em] border transition-colors ${
                mode === m
                  ? "bg-white text-black border-white"
                  : "text-white/65 border-white/15 hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <PrimaryButton onClick={() => gen(1)}>
            <Shuffle className="w-4 h-4" strokeWidth={2} />
            One
          </PrimaryButton>
          <SecondaryButton onClick={() => gen(10)}>
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
        {generated.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {generated.map((g, i) => (
              <GeneratedRow key={i} value={formatSteuerId(g)} verdict="checksum ok" />
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
  );
}

function SignatureTool() {
  const handleUse = (file: File, _dataUrl: string) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <SignatureGenerator onUse={handleUse} />;
}

export function SuggestedToolsRow({
  country,
  docType,
  onPick,
}: {
  /** ISO country code (e.g. "NL", "DE") or "ALL" / "" for no filter. */
  country: string;
  /** DocTypeTag (e.g. "passport", "id-card") or "ALL" / "" for no filter. */
  docType: string;
  onPick: (id: string) => void;
}) {
  const countryFilter = (country || "ALL") as CountryTag | "ALL";
  const docTypeFilter = (docType || "ALL") as DocTypeTag | "ALL";
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Score each tool: exact country + doc-type match beats partial, which
  // beats catch-alls. Cap to top 10 so the row stays scannable.
  const ranked = TOOL_REGISTRY
    .map((t) => {
      let score = 0;
      const countryMatch =
        countryFilter !== "ALL" &&
        (t.countries.includes(countryFilter) || t.countries.includes("*"));
      const docTypeMatch =
        docTypeFilter !== "ALL" && t.docTypes.includes(docTypeFilter);
      if (countryFilter !== "ALL" && t.countries.includes(countryFilter)) score += 4;
      else if (t.countries.includes("*")) score += 1;
      if (docTypeFilter !== "ALL" && t.docTypes.includes(docTypeFilter)) score += 4;
      // Light tie-breaker so order is stable when nothing is filtered.
      score += t.countries.includes("*") ? 0.5 : 0;
      // Hide tools that explicitly don't apply when a filter is set.
      if (countryFilter !== "ALL" && !countryMatch) return null;
      if (docTypeFilter !== "ALL" && !docTypeMatch) return null;
      return { tool: t, score };
    })
    .filter((x): x is { tool: ToolDef; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.tool);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 2);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateArrows();
  }, [ranked.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // Scroll by ~one card-width-plus-gap so each tap reveals the next card.
    const step = Math.max(160, Math.round(el.clientWidth * 0.6));
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  if (ranked.length === 0) return null;

  return (
    <div className="glass p-4 sm:p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white/70 text-[11px] mono uppercase tracking-[0.16em]">
          <Sparkles className="w-3.5 h-3.5" />
          Suggested tools
          <span className="text-white/35 normal-case tracking-normal">
            · top {ranked.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            aria-label="Previous suggested tools"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/30 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-black/30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            aria-label="Next suggested tools"
            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/30 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-black/30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        onScroll={updateArrows}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 scroll-smooth"
        style={{ scrollbarWidth: "none" }}
      >
        {ranked.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className="snap-start shrink-0 w-[160px] aspect-square rounded-2xl border border-white/12 bg-black/30 hover:bg-white/[0.04] hover:border-white/25 text-left p-3.5 transition-all flex flex-col"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white/85">
                  <Icon className="w-5 h-5" strokeWidth={1.8} />
                </span>
                <span className="mono text-[9px] uppercase tracking-[0.14em] text-white/55 px-1.5 py-0.5 rounded-full border border-white/12">
                  {t.badge}
                </span>
              </div>
              <div className="mt-auto">
                <div className="text-white text-[15px] tracking-tight leading-snug line-clamp-2 min-h-[2.5em]">
                  {t.label}
                </div>
                <div className="text-white/55 text-[11px] mt-1 leading-snug line-clamp-2">
                  {t.blurb ?? t.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddressTool() {
  const [city, setCity] = useState<string>(SUPPORTED_ADDRESS_CITIES[0]);
  const [generated, setGenerated] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const gen = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(generateAddressForCity(city));
    setGenerated(out);
  };

  const result = input.trim() ? checkDutchAddress(input) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <ToolPanel
        title="Validate address"
        subtitle="Format + known street + postcode range per city"
        accent={result?.ok ? "ok" : result ? "err" : "idle"}
      >
        <Field
          label="Address"
          value={input}
          onChange={setInput}
          placeholder="Coolsingel 42, 3011 AD Rotterdam"
          maxLength={120}
        />
        {result && (
          <StatusRow
            tone={result.ok ? "ok" : "err"}
            icon={
              result.ok ? (
                <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
              ) : (
                <AlertCircle className="w-4 h-4" strokeWidth={2} />
              )
            }
          >
            {result.ok
              ? `Valid ${result.parts?.city} address.`
              : result.reason}
          </StatusRow>
        )}
      </ToolPanel>

      <ToolPanel
        title="Generate Dutch address"
        subtitle="Real street names + valid postcode range per city · synthetic house numbers"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="px-3 h-10 rounded-lg bg-black/40 border border-white/10 text-white text-sm focus:outline-none focus:border-white/30"
            style={{ colorScheme: "dark" }}
          >
            {SUPPORTED_ADDRESS_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => gen(1)}>
              <Shuffle className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Generate</span>
            </SecondaryButton>
            <SecondaryButton onClick={() => gen(5)}>
              <span>×5</span>
            </SecondaryButton>
          </div>
        </div>

        {generated.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {generated.map((g, i) => (
              <GeneratedRow key={i} value={g} verdict={city} />
            ))}
          </div>
        )}
      </ToolPanel>
    </div>
  );
}
