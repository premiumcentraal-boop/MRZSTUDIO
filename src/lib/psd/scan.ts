/* PSD layer scanning + EmployeeID template detection.
 * Pure helpers; no DOM/canvas required except checkFontAvailable.
 * Extracted from App.tsx to keep that file under Figma Make's editor size limit.
 */

export const FIELD_LAYER_NAMES = [
  "CODE",
  "DOCNMBR",
  "VALID",
  "ENDVALID",
  "BIRTHDATE",
  "YEAR",
  "FIRST",
  "LAST",
  "FULLNAME",
  "GENDER",
  "COUNTRY",
  "CITYBIRTH",
  "LOCATION",
  "HEIGHT",
  "MRZ",
] as const;
export type FieldLayerName = (typeof FIELD_LAYER_NAMES)[number];

// Auto-mapping hints from the proven Card_Generator template
// (Example page.psb sample). When a PSD layer isn't named after one of our
// TARGETS, we fall back to matching its original text and approximate
// (left, top) position. This is how the working Node tool maps the sample
// layers ("999999999", "First name", "Burg. van Zoetermeer", …) onto fields.
export const SAMPLE_LAYER_HINTS: Record<FieldLayerName, { name: string; left: number; top: number }[]> = {
  LOCATION:  [{ name: "Burg. van Zoetermeer", left: 702, top: 111 }],
  MRZ:       [{ name: "MRZ", left: 723, top: 391 }],
  HEIGHT:    [{ name: "1,72 m", left: 1397, top: 114 }],
  CITYBIRTH: [{ name: "Zoetermeer", left: 702, top: 57 }],
  CODE:      [{ name: "999999999", left: 1395, top: 59 }],
  DOCNMBR:   [{ name: "999999999", left: 380, top: 97 }],
  FULLNAME:  [{ name: "Trump Donald John", left: 701, top: 0 }],
  YEAR:      [{ name: "1966", left: 216, top: 316 }],
  BIRTHDATE: [{ name: "02 AUG/AUG", left: 1, top: 315 }],
  VALID:     [{ name: "03 MAA/MAR 2020", left: 0, top: 373 }],
  ENDVALID:  [{ name: "03 MAA/MAR 2030", left: 0, top: 430 }],
  COUNTRY:   [{ name: "Nederlandse", left: 119, top: 260 }],
  GENDER:    [{ name: "M/M", left: 5, top: 261 }],
  LAST:      [{ name: "Last name", left: 4, top: 207 }],
  FIRST:     [{ name: "First name", left: 4, top: 151 }],
};

// English → Dutch month abbreviations, used in the card date format
// "DD MMM/MMM YYYY" (e.g. "14 JUN/JUN 2020", "03 MAA/MAR 2030").
export const NL_MONTHS: Record<number, { nl: string; en: string }> = {
  1:  { nl: "JAN", en: "JAN" },
  2:  { nl: "FEB", en: "FEB" },
  3:  { nl: "MAA", en: "MAR" },
  4:  { nl: "APR", en: "APR" },
  5:  { nl: "MEI", en: "MAY" },
  6:  { nl: "JUN", en: "JUN" },
  7:  { nl: "JUL", en: "JUL" },
  8:  { nl: "AUG", en: "AUG" },
  9:  { nl: "SEP", en: "SEP" },
  10: { nl: "OKT", en: "OCT" },
  11: { nl: "NOV", en: "NOV" },
  12: { nl: "DEC", en: "DEC" },
};

export function formatCardDate(iso: string, withYear: boolean): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  const months = NL_MONTHS[Number(mo)];
  if (!months) return "";
  const base = `${d} ${months.nl}/${months.en}`;
  return withYear ? `${base} ${y}` : base;
}

export function genderToCardFormat(sex: string): string {
  if (sex === "M") return "M/M";
  if (sex === "F") return "F/F";
  if (sex === "<" || sex === "X") return "X/X";
  return "";
}

export type PsdTextLayer = {
  name: FieldLayerName;
  left: number;
  top: number;
  right: number;
  bottom: number;
  family: string;        // CSS family
  weight: string;        // CSS weight (e.g. "400", "700")
  style: string;         // CSS font-style ("normal" | "italic")
  fontSize: number;      // px
  color: string;         // CSS color
  align: CanvasTextAlign;
  originalText: string;  // text in the PSD (used to mask/cover)
  psdName: string;       // the layer's current Photoshop name (e.g. "999999999")
  textIndex: number;     // index in the flat text-layer order (for Photopea findLayer)
};

export type PsdScan = {
  width: number;
  height: number;
  composite: string;     // data URL of merged composite
  layers: Map<FieldLayerName, PsdTextLayer>;
  autoMapped: Set<FieldLayerName>;
  detectedFonts: string[];
  missingFonts: string[];
  isEmployeeId: boolean;  // detected EmployeeID.psd nested smart-object template
  employeeId?: EmployeeIdScan;
};

// EmployeeID.psd template detection + deep scan. Names are taken verbatim
// from src/imports/pasted_text/employee-id-automation.md and matched
// case-insensitively so light template churn doesn't break recognition.
export const EMPLOYEE_ID_GROUPS = ["Signature", "DublePhoto", "Photo", "PERFO", "Text"];
export const EMPLOYEE_ID_SMART_LAYERS = [
  "Signature", "SMALLDATE", "SMALL_PHOTO", "BIG_PHOTO",
  "PERFO1", "PERFO2", "PERFO3", "Text Edit",
];
export const EMPLOYEE_ID_MAIN_TEXT = ["BIG_DATE_1", "BIG_DATE_2"];
export const EMPLOYEE_ID_NESTED = ["FIRST_2_DIGITS", "LAST_2_DIGITS", "SMALL_IMAGE_1", "BIG_IMAGE_1"];

export type EmployeeIdScan = {
  groups: string[];          // group names found (case-preserved)
  smartLayers: string[];     // top-of-tree smart-object layers found
  mainText: string[];        // BIG_DATE_1 / BIG_DATE_2 if present in main doc
  nested: string[];          // nested layer names we could see via ag-psd
  deep?: EmployeeIdDeepScan; // populated after a Photopea "deep scan" run
};

export type EmployeeIdDeepScan = {
  ranAt: number;
  // For each smart-object container we tried to open, the layer names we
  // found inside it (after Photopea actually opened the subdoc).
  subdocs: Record<string, { opened: boolean; layers: string[]; error?: string }>;
};

export function detectEmployeeIdTemplate(psd: { children?: RawLayer[] }):
  { ok: boolean; scan: EmployeeIdScan } {
  const found = new Map<string, string>(); // lower → original
  const root: RawLayer = { children: psd.children };
  walkLayers(root, (l) => {
    if (l.name) {
      const trimmed = l.name.trim();
      const key = trimmed.toLowerCase();
      if (!found.has(key)) found.set(key, trimmed);
    }
  });
  const pick = (list: string[]) =>
    list.map((n) => found.get(n.toLowerCase())).filter((v): v is string => Boolean(v));

  const scan: EmployeeIdScan = {
    groups: pick(EMPLOYEE_ID_GROUPS),
    smartLayers: pick(EMPLOYEE_ID_SMART_LAYERS),
    mainText: pick(EMPLOYEE_ID_MAIN_TEXT),
    nested: pick(EMPLOYEE_ID_NESTED),
  };
  // Lenient threshold: 3 groups and 3 smart layers is enough to be confident
  // — ag-psd can't always see *inside* linked smart objects, so we don't rely
  // on the nested list for the gate.
  const ok = scan.groups.length >= 3 && scan.smartLayers.length >= 3;
  return { ok, scan };
}

export function psFontToCss(psName: string | undefined): { family: string; weight: string; style: string } {
  if (!psName) return { family: "Arial", weight: "400", style: "normal" };
  // PostScript names look like "ArialMT", "Helvetica-Bold", "OpenSans-SemiBoldItalic".
  const cleaned = psName.replace(/MT$|PS$|PSMT$/i, "");
  const [fam, suffix = ""] = cleaned.split("-");
  const family = fam.replace(/([a-z])([A-Z])/g, "$1 $2").trim() || "Arial";
  let weight = "400";
  let style = "normal";
  const s = suffix.toLowerCase();
  if (/black|heavy/.test(s)) weight = "900";
  else if (/extrabold|ultrabold/.test(s)) weight = "800";
  else if (/bold/.test(s)) weight = "700";
  else if (/semibold|demibold/.test(s)) weight = "600";
  else if (/medium/.test(s)) weight = "500";
  else if (/light/.test(s)) weight = "300";
  else if (/thin|hairline/.test(s)) weight = "100";
  if (/italic|oblique/.test(s)) style = "italic";
  return { family, weight, style };
}

export function colorToCss(c: unknown): string {
  if (!c || typeof c !== "object") return "#000";
  const obj = c as Record<string, number>;
  if ("r" in obj && "g" in obj && "b" in obj) {
    const a = "a" in obj ? Math.max(0, Math.min(1, obj.a)) : 1;
    return `rgba(${Math.round(obj.r)},${Math.round(obj.g)},${Math.round(obj.b)},${a})`;
  }
  if ("k" in obj) {
    const v = 255 - Math.round(obj.k);
    return `rgb(${v},${v},${v})`;
  }
  return "#000";
}

export function justificationToAlign(j: unknown): CanvasTextAlign {
  const s = String(j || "left").toLowerCase();
  if (s.includes("right")) return "right";
  if (s.includes("center")) return "center";
  return "left";
}

export type RawTextStyle = {
  font?: { name?: string };
  fontSize?: number;
  fillColor?: unknown;
  fauxBold?: boolean;
  fauxItalic?: boolean;
};

export type RawLayer = {
  name?: string;
  hidden?: boolean;
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
  text?: {
    text?: string;
    transform?: number[];     // [a, b, c, d, e, f] affine matrix
    style?: RawTextStyle;
    styleRuns?: { style?: RawTextStyle; length?: number }[];
    paragraphStyle?: { justification?: unknown };
  };
  children?: RawLayer[];
};

export function walkLayers(layer: RawLayer, fn: (l: RawLayer) => void) {
  fn(layer);
  if (layer.children) for (const child of layer.children) walkLayers(child, fn);
}

export function buildPsdTextLayer(
  l: RawLayer,
  asName: FieldLayerName,
  fonts: Set<string>,
  textIndex: number,
): PsdTextLayer | null {
  if (!l.text || typeof l.text.text !== "string") return null;

  // ag-psd usually puts per-run styles in styleRuns; the top-level `style`
  // is often a partial default. Merge the first run over the base so we get
  // the actual font/size used in the PSD.
  const runStyle = l.text.styleRuns?.[0]?.style || {};
  const baseStyle = l.text.style || {};
  const style: RawTextStyle = { ...baseStyle, ...runStyle };

  let { family, weight, style: italicStyle } = psFontToCss(style.font?.name);
  if (style.fauxBold && weight === "400") weight = "700";
  if (style.fauxItalic) italicStyle = "italic";

  // The PSD text transform can scale the rendered glyphs even when the
  // declared fontSize stays the same. Multiply by the y-scale so our canvas
  // text matches Photoshop's visual size.
  const tf = l.text.transform;
  const scaleY = tf && tf.length >= 4 ? Math.abs(tf[3]) || 1 : 1;
  const rawSize = Number(style.fontSize) || 16;
  const fontSize = Math.max(6, Math.round(rawSize * scaleY));

  const color = colorToCss(style.fillColor);
  const align = justificationToAlign(l.text.paragraphStyle?.justification);

  fonts.add(family);

  return {
    name: asName,
    left: l.left || 0,
    top: l.top || 0,
    right: l.right || 0,
    bottom: l.bottom || 0,
    family,
    weight,
    style: italicStyle,
    fontSize,
    color,
    align,
    originalText: l.text.text || "",
    psdName: (l.name || "").trim(),
    textIndex,
  };
}

export function scanPsdForLayers(psd: {
  width: number;
  height: number;
  children?: RawLayer[];
  canvas?: HTMLCanvasElement;
}): { layers: Map<FieldLayerName, PsdTextLayer>; fonts: Set<string>; autoMapped: Set<FieldLayerName> } {
  const layers = new Map<FieldLayerName, PsdTextLayer>();
  const fonts = new Set<string>();
  const autoMapped = new Set<FieldLayerName>();
  const wantedSet = new Set<string>(FIELD_LAYER_NAMES);

  // Collect every text layer once so we can do both passes against it.
  const allText: RawLayer[] = [];
  const root: RawLayer = { children: psd.children };
  walkLayers(root, (l) => {
    if (l.text && typeof l.text.text === "string") allText.push(l);
  });

  const usedIndexes = new Set<number>();

  // Pass 1 — exact layer-name match (CODE, DOCNMBR, FIRST, …)
  allText.forEach((l, i) => {
    const upperName = (l.name || "").trim().toUpperCase();
    if (!wantedSet.has(upperName)) return;
    if (layers.has(upperName as FieldLayerName)) return;
    const built = buildPsdTextLayer(l, upperName as FieldLayerName, fonts, i);
    if (built) {
      layers.set(upperName as FieldLayerName, built);
      usedIndexes.add(i);
    }
  });

  // Pass 2 — hint-based auto-mapping (working logic from Card_Generator).
  // For any TARGET still unmapped, look for a text layer whose original
  // content matches the sample text and whose position is "close enough"
  // (within 12px) to the sample coordinates.
  const TOLERANCE = 12;
  for (const target of FIELD_LAYER_NAMES) {
    if (layers.has(target)) continue;
    const hints = SAMPLE_LAYER_HINTS[target] || [];
    for (const hint of hints) {
      const wanted = hint.name.toLowerCase().trim();
      const idx = allText.findIndex((l, i) => {
        if (usedIndexes.has(i)) return false;
        const text = String(l.text?.text || "").toLowerCase().trim();
        if (text !== wanted) return false;
        const dx = Math.abs((l.left || 0) - hint.left);
        const dy = Math.abs((l.top || 0) - hint.top);
        return dx <= TOLERANCE && dy <= TOLERANCE;
      });
      if (idx !== -1) {
        const built = buildPsdTextLayer(allText[idx], target, fonts, idx);
        if (built) {
          layers.set(target, built);
          usedIndexes.add(idx);
          autoMapped.add(target);
          break;
        }
      }
    }
  }

  // Pass 3 — looser hint match: same text, position ignored. Catches templates
  // where the sample layers were moved but their content was kept.
  for (const target of FIELD_LAYER_NAMES) {
    if (layers.has(target)) continue;
    const hints = SAMPLE_LAYER_HINTS[target] || [];
    for (const hint of hints) {
      const wanted = hint.name.toLowerCase().trim();
      const idx = allText.findIndex((l, i) => {
        if (usedIndexes.has(i)) return false;
        return String(l.text?.text || "").toLowerCase().trim() === wanted;
      });
      if (idx !== -1) {
        const built = buildPsdTextLayer(allText[idx], target, fonts, idx);
        if (built) {
          layers.set(target, built);
          usedIndexes.add(idx);
          autoMapped.add(target);
          break;
        }
      }
    }
  }

  return { layers, fonts, autoMapped };
}

export function checkFontAvailable(family: string): boolean {
  try {
    return document.fonts.check(`16px "${family}"`);
  } catch {
    return true;
  }
}

// Walk every text layer in a parsed PSD and yield (layerName, text, fontFamily).
// Pulls the family from each style/styleRun the layer actually uses, so a layer
// with mixed fonts contributes multiple entries.
export type FontUse = { layer: string; text: string; font: string };
export function collectFontUsesFromPsd(psd: { children?: RawLayer[] }): FontUse[] {
  const out: FontUse[] = [];
  const walk = (layers: RawLayer[] | undefined) => {
    if (!layers) return;
    for (const l of layers) {
      if (l.text && typeof l.text.text === "string") {
        const layerName = l.name || "(unnamed)";
        const txt = l.text.text;
        const seen = new Set<string>();
        const pushFont = (fam?: string) => {
          if (!fam) return;
          const f = String(fam).trim();
          if (!f || seen.has(f)) return;
          seen.add(f);
          out.push({ layer: layerName, text: txt, font: f });
        };
        const style: { font?: { name?: string } } | undefined = l.text.style;
        pushFont(style?.font?.name);
        const runs: Array<{ style?: { font?: { name?: string } } }> | undefined = l.text.styleRuns;
        if (Array.isArray(runs)) runs.forEach((r) => pushFont(r.style?.font?.name));
      }
      if (l.children) walk(l.children);
    }
  };
  walk(psd.children);
  return out;
}
