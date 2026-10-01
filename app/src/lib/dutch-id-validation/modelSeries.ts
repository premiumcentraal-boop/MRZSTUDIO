/* Resolve the Dutch model-series entry that applies to a given
 * (family, documentType, issueDate) tuple.
 *
 * Selection is driven by `issueDate` per RvIG's published model windows.
 * Expiry / validity dates are intentionally NOT used here — they affect
 * validity-period checks, not which physical model is in hand. */

import data from "../dutch-id-validation-data/model-series-2016-2026.json";
import type { ModelSeriesEntry, ResolveDutchModelSeriesInput } from "./types";
import type { DocumentNumberEra } from "./travelDocumentNumber";

const ENTRIES: ModelSeriesEntry[] = (data as any).entries;

function dateInRange(d: string, from: string, to: string | null): boolean {
  return d >= from && (to == null || d <= to);
}

/** Returns every model entry whose (family, documentType, issueDate) window
 * matches. Most queries return one entry, but where models overlap (e.g.
 * around the 2014→2021 cutover) all candidates are returned so the UI can
 * disambiguate. */
export function resolveDutchModelSeries(input: ResolveDutchModelSeriesInput): ModelSeriesEntry[] {
  const { family, documentType, issueDate } = input;
  return ENTRIES.filter((e) => {
    if (e.family !== family) return false;
    if (documentType && !e.documentTypes.includes(documentType)) return false;
    if (issueDate && !dateInRange(issueDate, e.issueDateFrom, e.issueDateTo)) return false;
    return true;
  });
}

/** Pick the most specific entry for the inputs given. When `issueDate` is
 * supplied this returns at most one entry; when omitted it returns the
 * most recent model for the family. */
export function pickPrimaryModelSeries(
  input: ResolveDutchModelSeriesInput,
): ModelSeriesEntry | undefined {
  const matches = resolveDutchModelSeries(input);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0 && input.issueDate) return undefined;
  // No issue date — fall back to the newest matching window.
  const family = input.family;
  return ENTRIES.filter((e) => e.family === family)
    .sort((a, b) => (b.issueDateFrom > a.issueDateFrom ? 1 : -1))[0];
}

/** Translate a resolved entry into the document-number era flag used by
 * `validateDutchTravelDocumentNumber`. */
export function eraForModel(entry: ModelSeriesEntry | undefined): DocumentNumberEra {
  if (!entry) return "post-2019";
  return entry.validationProfileId === "NL-PASSPORT-ID-VISIBLE-NUMBER-PRE-2019"
    ? "pre-2019"
    : "post-2019";
}

export const ALL_MODEL_ENTRIES: ModelSeriesEntry[] = ENTRIES;
