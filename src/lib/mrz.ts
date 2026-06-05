/* MRZ — ICAO 9303 TD1/TD3 builders + supporting helpers.
 * Extracted from App.tsx to keep that file under Figma Make's editor size limit.
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

export const charValue = (c: string) => {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c >= "A" && c <= "Z") return c.charCodeAt(0) - 55;
  return 0;
};

export const checkDigit = (v: string) => {
  const w = [7, 3, 1];
  const total = Array.from(v).reduce((s, c, i) => s + charValue(c) * w[i % 3], 0);
  return String(total % 10);
};

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
  // BSN encoding in the MRZ depends on the NL card model: the 2014 NIK keeps
  // BSN in line 1 optional data (positions 16-24 with its own check digit at
  // position 30). The 2021+ NIK redesign removed BSN from the MRZ. Callers
  // should route BSN into `optional1` only when the issue date is pre-2021.
  bsn?: string;
  // Custom-card (business badge) metadata — only used in the custom flow.
  company?: string;
  department?: string;
  employeeId?: string;
  photoDataUrl?: string;     // employee photo (data URL)
  psdDataUrl?: string;       // baked PNG from the uploaded PSD background
  country?: string;          // country of birth
  cityBirth?: string;
  location?: string;         // company location
  height?: string;
  issueDate?: string;        // VALID — issue date (ISO yyyy-mm-dd)
};

export const emptyData: FormData = {
  documentCode: "P<", issuer: "UTO", number: "", surname: "", given: "",
  nationality: "UTO", birth: "", sex: "F", expiry: "", personal: "",
  optional1: "", optional2: "", bsn: "",
};

/* BSN (Burgerservicenummer) — Dutch citizen service number.
 * 9 digits, validated by the "elfproef" (11-test):
 *   (9·d1 + 8·d2 + 7·d3 + 6·d4 + 5·d5 + 4·d6 + 3·d7 + 2·d8 + -1·d9) mod 11 == 0
 * Printed on every NL paspoort (data page) and NIK (back). NOT in the MRZ.
 */
export function isValidBSN(s: string): boolean {
  const d = (s || "").replace(/\D/g, "");
  if (d.length !== 9) return false;
  const w = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  const sum = w.reduce((acc, weight, i) => acc + weight * parseInt(d[i], 10), 0);
  return sum % 11 === 0;
}

export type BuildResult = {
  label: "TD3" | "TD1";
  lines: string[];
  expected: number;
  checks: { label: string; digit: string }[];
};

export function buildTD3(d: FormData): BuildResult {
  const documentCode = codeOf(d.documentCode, 2, "P<");
  const issuer = codeOf(d.issuer, 3, "UTO");
  const names = nameField(d.surname, d.given, 39);
  const number = fixed(d.number, 9);
  const nc = checkDigit(number);
  const nationality = codeOf(d.nationality, 3, issuer);
  const birth = dateToYYMMDD(d.birth);
  const bc = checkDigit(birth);
  const sex = cleanSex(d.sex);
  const expiry = dateToYYMMDD(d.expiry);
  const ec = checkDigit(expiry);
  const personal = fixed(d.personal, 14);
  // ICAO 9303 §4.2.2.2: if optional data is entirely unused (all filler),
  // its check digit MUST also be filler '<' rather than the computed '0'.
  const personalEmpty = personal === "<<<<<<<<<<<<<<";
  const pc = personalEmpty ? "<" : checkDigit(personal);
  const composite = checkDigit(number + nc + birth + bc + expiry + ec + personal + pc);
  return {
    label: "TD3",
    expected: 44,
    lines: [
      documentCode + issuer + names,
      number + nc + nationality + birth + bc + sex + expiry + ec + personal + pc + composite,
    ],
    checks: [
      { label: "Document number", digit: nc },
      { label: "Date of birth", digit: bc },
      { label: "Date of expiry", digit: ec },
      { label: personalEmpty ? "Personal (unused)" : "Personal data", digit: pc },
      { label: "Composite", digit: composite },
    ],
  };
}

export function buildTD1(d: FormData): BuildResult {
  const documentCode = codeOf(d.documentCode, 2, "I<");
  const issuer = codeOf(d.issuer, 3, "UTO");
  const raw = cleanField(d.number);
  const long = raw.length > 9;
  const number = fixed(raw, 9);
  let nc = checkDigit(number);
  let opt1 = fixed(d.optional1, 15);
  let opt1Check = ""; // empty when opt1 is fully filler; otherwise the digit at line-1 position 30
  if (long) {
    // Long-document-number continuation case (ICAO §6.7 TD1):
    // doc-number check at position 15 becomes '<', the remainder of the number
    // continues in optional data, then its check digit, then a single filler.
    const rem = raw.slice(9, 22);
    nc = checkDigit(number + rem);
    opt1 = (rem + nc + "<").padEnd(15, "<").slice(0, 15);
  } else {
    // Standard case: optional data (e.g. NL BSN on pre-2021 NIK) occupies line 1
    // positions 16-29 (14 chars), and position 30 carries its check digit.
    // When optional data is fully filler, position 30 stays filler (§4.2.2.2).
    const opt1Data = fixed(d.optional1, 14);
    const opt1Empty = opt1Data === "<<<<<<<<<<<<<<";
    opt1Check = opt1Empty ? "<" : checkDigit(opt1Data);
    opt1 = opt1Data + opt1Check;
  }
  const birth = dateToYYMMDD(d.birth);
  const bc = checkDigit(birth);
  const sex = cleanSex(d.sex);
  const expiry = dateToYYMMDD(d.expiry);
  const ec = checkDigit(expiry);
  const nationality = codeOf(d.nationality, 3, issuer);
  const opt2 = fixed(d.optional2, 11);
  const names = nameField(d.surname, d.given, 30);
  const line1 = documentCode + issuer + number + (long ? "<" : nc) + opt1;
  // Composite per ICAO TD1: line1 pos 6-30 + line2 pos 1-7 + 9-15 + 19-29.
  const composite = checkDigit(line1.slice(5) + birth + bc + expiry + ec + opt2);
  const line2 = birth + bc + sex + expiry + ec + nationality + opt2 + composite;
  const checks: { label: string; digit: string }[] = [
    { label: long ? "Long doc number" : "Document number", digit: nc },
  ];
  if (!long && opt1Check && opt1Check !== "<") {
    checks.push({ label: "Optional data (line 1)", digit: opt1Check });
  }
  checks.push(
    { label: "Date of birth", digit: bc },
    { label: "Date of expiry", digit: ec },
    { label: "Composite", digit: composite },
  );
  return {
    label: "TD1",
    expected: 30,
    lines: [line1, line2, names],
    checks,
  };
}
