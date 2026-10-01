/* MRZ shared core — ICAO 9303 algorithm + text formatters + types.
 * Used by every format builder (TD1, TD2, TD3) and every document module
 * (id-card, passport, driving-license).
 */

const transliteration: Record<string, string> = {
  "Ä": "AE", "Å": "AA", "Æ": "AE", "Ç": "C", "Ð": "D",
  "É": "E", "Ñ": "N", "Ö": "OE", "Ø": "OE", "Þ": "TH",
  "Ü": "UE", "ẞ": "SS", "ß": "SS", "Œ": "OE",
};

export const normalizeText = (v: string) =>
  Array.from(String(v || "").trim().toUpperCase())
    .map((c) => transliteration[c] || c)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const cleanField = (v: string) =>
  normalizeText(v).replace(/[\s\-.,'`/\\]+/g, "<").replace(/[^A-Z0-9<]/g, "<");

export const fixed = (v: string, len: number) =>
  cleanField(v).slice(0, len).padEnd(len, "<");

export const codeOf = (v: string, len: number, fb: string) =>
  fixed(v || fb, len);

export const dateToYYMMDD = (v: string) => {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1].slice(2)}${m[2]}${m[3]}` : "<<<<<<";
};

export const cleanSex = (v: string) => {
  const s = (v || "<").toUpperCase();
  return s === "F" || s === "M" ? s : "<";
};

export const cleanName = (v: string) =>
  normalizeText(v)
    .replace(/['`‘’]/g, "")
    .replace(/[-,\s‐-―]+/g, "<")
    .replace(/[^A-Z<]/g, "")
    .replace(/<+/g, "<")
    .replace(/^<|<$/g, "");

export const fitName = (body: string, len: number) => {
  if (body.length <= len) return body.padEnd(len, "<");
  const chars = body.split("");
  let guard = 0;
  while ((chars.length > len || chars[len - 1] === "<") && guard < 200) {
    const limit = Math.min(chars.length - 1, len - 1);
    let removable = -1;
    for (let i = limit; i >= 0; i--) {
      if (chars[i] === "<") { removable = i; break; }
    }
    if (removable === -1) break;
    chars.splice(removable, 1);
    guard++;
  }
  let fitted = chars.join("").slice(0, len);
  if (fitted.length < len) fitted = fitted.padEnd(len, "<");
  if (fitted[len - 1] === "<") fitted = body.replace(/</g, "").slice(0, len).padEnd(len, "<");
  return fitted;
};

export const nameField = (surname: string, given: string, len: number) => {
  const p = cleanName(surname) || "SPECIMEN";
  const s = cleanName(given);
  return fitName(s ? `${p}<<${s}` : p, len);
};

/** ICAO 9303 character value: digits 0-9 → 0-9, A-Z → 10-35, "<" → 0. */
export const charValue = (c: string) => {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0;
};

/** ICAO 9303 check digit: weighted sum (weights 7,3,1 repeating) mod 10.
 *  A calculated 0 always stays "0" — it is never replaced with the filler "<".
 */
export const checkDigit = (v: string) => {
  const w = [7, 3, 1];
  const total = Array.from(v).reduce((s, c, i) => s + charValue(c) * w[i % 3], 0);
  return String(total % 10);
};

export type MrzLabel = "TD1" | "TD2" | "TD3";

export type FormData = {
  documentCode: string;
  issuer: string;
  number: string;
  surname: string;
  given: string;
  nationality: string;
  birth: string;
  sex: string;
  expiry: string;
  personal: string;
  optional1: string;
  optional2: string;
  // Card metadata — printed on the physical document.
  // BSN encoding depends on the NL card model: the 2014 NIK keeps BSN in line 1
  // optional data (positions 16-24 with its own check digit at position 30).
  // The 2021+ NIK redesign removed BSN from the MRZ. Callers should route BSN
  // into `optional1` only when the issue date is pre-2021.
  bsn?: string;
  // Custom-card (business badge) metadata — only used in the custom flow.
  company?: string;
  department?: string;
  employeeId?: string;
  photoDataUrl?: string;
  psdDataUrl?: string;
  country?: string;
  cityBirth?: string;
  location?: string;
  height?: string;
  issueDate?: string;
};

export const emptyData: FormData = {
  documentCode: "P<", issuer: "UTO", number: "", surname: "", given: "",
  nationality: "UTO", birth: "", sex: "F", expiry: "", personal: "",
  optional1: "", optional2: "", bsn: "",
};

export type BuildResult = {
  label: MrzLabel;
  lines: string[];
  expected: number;
  checks: { label: string; digit: string }[];
};

/* BSN (Burgerservicenummer) — Dutch citizen service number.
 * 9 digits, validated by the "elfproef" (11-test).
 */
export function isValidBSN(s: string): boolean {
  const d = (s || "").replace(/\D/g, "");
  if (d.length !== 9) return false;
  const w = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  const sum = w.reduce((acc, weight, i) => acc + weight * parseInt(d[i], 10), 0);
  return sum % 11 === 0;
}
