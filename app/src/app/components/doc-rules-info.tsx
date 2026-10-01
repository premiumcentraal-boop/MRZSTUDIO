import { useState } from "react";
import { Info, X } from "lucide-react";
import { pickPrimaryModelSeries, eraForModel } from "../../lib/dutch-id-validation";
import { pickPrimaryModelSeries as pickPrimaryGermanModelSeries } from "../../lib/german-id-validation";

type Family = "passport" | "identity_card" | "driving_licence";

export type DocRulesInfoProps = {
  country: string;
  family: Family;
  issueDate?: string;
};

function describe({ country, family, issueDate }: DocRulesInfoProps) {
  const nlModel = country === "NL" ? pickPrimaryModelSeries({ family, issueDate }) : undefined;
  const deModel = country === "DE" ? pickPrimaryGermanModelSeries({ family, issueDate }) : undefined;
  const model = nlModel ?? deModel;
  const era =
    country === "NL" && family !== "driving_licence"
      ? eraForModel(pickPrimaryModelSeries({ family, issueDate }))
      : null;
  const mrzKind =
    family === "driving_licence"
      ? "No MRZ (driving licence)"
      : family === "passport"
      ? "ICAO TD3 — 2 × 44"
      : "ICAO TD1 — 3 × 30";
  const docRule =
    country === "DE"
      ? "9 alphanum, no I/O, pos 1–8 free, pos 9 = ICAO mod-10 (weights 7,3,1)"
      : family === "driving_licence"
      ? "8–12 alphanumerics. No published checksum (structure-only)."
      : era === "pre-2019"
      ? "9 chars · pos 1–2 letters · no 'O' · digit 0 allowed · pos 9 = ICAO mod-10 (0–9)"
      : "9 chars · pos 1–2 letters · no 'O' · no '0' · pos 9 = ICAO mod-10 (1–9)";
  const source =
    country === "DE"
      ? "BMI / Bundesdruckerei / BMDV · ICAO 9303"
      : country === "NL"
      ? "RvIG · ICAO 9303"
      : "ICAO 9303";
  return { model, era, mrzKind, docRule, source };
}

export function DocRulesInfoButton(props: DocRulesInfoProps) {
  const [open, setOpen] = useState(false);
  const { model, era, mrzKind, docRule, source } = describe(props);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Show document number and MRZ calculation details"
        aria-expanded={open}
        title="Doc number & MRZ rules"
        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/15 bg-black/40 text-white/75 hover:text-white hover:border-white/35 hover:bg-black/55 transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20 sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed sm:absolute z-30 left-3 right-3 top-auto bottom-3 sm:left-0 sm:right-auto sm:bottom-auto sm:top-full sm:mt-2 sm:w-[340px] rounded-xl border border-white/15 bg-black/90 backdrop-blur-md px-3 py-2.5 shadow-2xl">
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/10">
              <div className="text-white/90 text-[11px] mono uppercase tracking-[0.14em]">
                Calculation rules
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-white/55 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <dl className="space-y-2 text-[11px]">
              <div>
                <dt className="text-white/45 mono uppercase tracking-[0.12em] text-[10px] mb-0.5">Model</dt>
                <dd className="text-white/90 leading-snug">
                  {model
                    ? `${model.modelName}`
                    : "No published model matches the issue date."}
                  {model && (
                    <span className="block text-white/45 text-[10px] mono mt-0.5">
                      {model.issueDateFrom} → {model.issueDateTo ?? "current"}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-white/45 mono uppercase tracking-[0.12em] text-[10px] mb-0.5">Doc №</dt>
                <dd className="text-white/85 leading-snug">{docRule}</dd>
              </div>
              <div>
                <dt className="text-white/45 mono uppercase tracking-[0.12em] text-[10px] mb-0.5">MRZ</dt>
                <dd className="text-white/85 leading-snug">
                  {mrzKind}
                  {props.family !== "driving_licence" && (
                    <span className="block text-white/55 text-[10px] mt-0.5">
                      check digit = Σ(value × [7,3,1]) mod 10 · '&lt;' = 0 · A–Z = 10–35
                    </span>
                  )}
                </dd>
              </div>
              {era && (
                <div>
                  <dt className="text-white/45 mono uppercase tracking-[0.12em] text-[10px] mb-0.5">Era</dt>
                  <dd className="text-white/85 leading-snug">
                    {era === "pre-2019" ? "Pre-1-Dec-2019 RvIG" : "Post-1-Dec-2019 RvIG"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-white/45 mono uppercase tracking-[0.12em] text-[10px] mb-0.5">Source</dt>
                <dd className="text-white/65 leading-snug">{source}</dd>
              </div>
            </dl>
          </div>
        </>
      )}
    </div>
  );
}
