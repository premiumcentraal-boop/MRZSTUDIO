/* Resolve the German model-series entry that applies to a given
 * (family, documentType, issueDate) tuple. Selection is driven by issue
 * date per BMI / BMDV published model windows. */

import data from "../german-id-validation-data/model-series-2016-2026.json";
import type { ModelSeriesEntry, ResolveGermanModelSeriesInput } from "./types";

const ENTRIES: ModelSeriesEntry[] = (data as any).entries;

function dateInRange(d: string, from: string, to: string | null): boolean {
  return d >= from && (to == null || d <= to);
}

export function resolveGermanModelSeries(input: ResolveGermanModelSeriesInput): ModelSeriesEntry[] {
  const { family, documentType, issueDate } = input;
  return ENTRIES.filter((e) => {
    if (e.family !== family) return false;
    if (documentType && !e.documentTypes.includes(documentType)) return false;
    if (issueDate && !dateInRange(issueDate, e.issueDateFrom, e.issueDateTo)) return false;
    return true;
  });
}

export function pickPrimaryModelSeries(
  input: ResolveGermanModelSeriesInput,
): ModelSeriesEntry | undefined {
  const matches = resolveGermanModelSeries(input);
  if (matches.length === 1) return matches[0];
  if (matches.length === 0 && input.issueDate) return undefined;
  const family = input.family;
  return ENTRIES.filter((e) => e.family === family)
    .sort((a, b) => (b.issueDateFrom > a.issueDateFrom ? 1 : -1))[0];
}

export const ALL_MODEL_ENTRIES: ModelSeriesEntry[] = ENTRIES;
