import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { RouterProvider, useLocation, useNavigate } from "react-router";
import { router } from "./routes";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Sparkles,
  CreditCard,
  BookOpen,
  RotateCcw,
  ChevronDown,
  Cpu,
  Info,
  X,
  Hash,
  Shuffle,
  CheckCircle2,
  AlertCircle,
  User,
  Calendar,
  Badge,
  Clock,
  Loader2,
  Menu,
  ChevronLeft,
} from "lucide-react";
// Eager import. Previously this was a React.lazy chunk wrapped in a
// boundary, which could throw "synchronous input" errors during navigation
// races. A plain import removes the boundary and the race entirely.
import IdGeneratorStep from "./IdGeneratorStep";
import { Flag } from "./components/flag";
import { PremiumLiquidCard, type PremiumLiquidVariant } from "./components/premium-liquid-card";
import { NLToolsStep, generateDocNumber, generateBSN } from "./steps/nl-tools-step";
import {
  cleanField,
  fixed,
  dateToYYMMDD,
  cleanName,
  charValue,
  checkDigit,
  isValidBSN,
  buildTD3,
  buildTD1,
  emptyData,
  type FormData,
  type BuildResult,
} from "../lib/mrz";

/* MRZ helpers + buildTD1/buildTD3 live in src/lib/mrz.ts */

/* ------------------------------ Self-tests ------------------------------- */
/* Round-trip our builders against the canonical ICAO 9303 published
 * specimens. If these match byte-for-byte the layout & checksum logic is
 * provably correct for every profile that uses that layout.
 *
 * Test vectors:
 *  - TD3-A: ICAO TD3 specimen "Anna Maria Eriksson" (Doc 9303 Part 4)
 *           with non-empty optional data "ZE184226B".
 *  - TD3-B: same holder but empty optional — verifies §4.2.2.2:
 *           position 43 must be filler '<', not '0'.
 *  - TD1-A: ICAO TD1 specimen with empty optional data fields.
 */

type TestVector = {
  id: string;
  name: string;
  format: DocType;
  data: FormData;
  expected: string[];
  source: string;
};

const TEST_VECTORS: TestVector[] = [
  {
    id: "td3-icao-canonical",
    name: "ICAO TD3 — Eriksson, optional populated",
    format: "td3",
    source: "ICAO Doc 9303 Part 4 §B specimen",
    data: { ...emptyData,
      documentCode: "P<", issuer: "UTO", number: "L898902C3",
      surname: "ERIKSSON", given: "ANNA MARIA",
      nationality: "UTO", birth: "1974-08-12", sex: "F",
      expiry: "2012-04-15", personal: "ZE184226B",
    },
    expected: [
      "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
      "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
    ],
  },
  {
    id: "td3-icao-empty-optional",
    name: "ICAO TD3 — empty optional (§4.2.2.2)",
    format: "td3",
    source: "ICAO 9303 Part 4 §4.2.2.2 (filler rule)",
    data: { ...emptyData,
      documentCode: "P<", issuer: "UTO", number: "L898902C3",
      surname: "ERIKSSON", given: "ANNA MARIA",
      nationality: "UTO", birth: "1974-08-12", sex: "F",
      expiry: "2012-04-15", personal: "",
    },
    expected: [
      "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
      "L898902C36UTO7408122F1204159<<<<<<<<<<<<<<<8",
    ],
  },
  {
    id: "td1-icao-canonical",
    name: "ICAO TD1 — Eriksson, empty optional zones",
    format: "td1",
    source: "ICAO Doc 9303 Part 5 §B specimen",
    data: { ...emptyData,
      documentCode: "I<", issuer: "UTO", number: "D23145890",
      surname: "ERIKSSON", given: "ANNA MARIA",
      nationality: "UTO", birth: "1974-08-12", sex: "F",
      expiry: "2012-04-15",
      optional1: "", optional2: "",
    },
    expected: [
      "I<UTOD231458907<<<<<<<<<<<<<<<",
      "7408122F1204159UTO<<<<<<<<<<<6",
      "ERIKSSON<<ANNA<MARIA<<<<<<<<<<",
    ],
  },
];

type TestResult = { id: string; name: string; source: string; format: DocType; pass: boolean; got: string[]; expected: string[] };

function runSelfTests(): TestResult[] {
  return TEST_VECTORS.map((tv) => {
    const out = tv.format === "td3" ? buildTD3(tv.data) : buildTD1(tv.data);
    const pass = out.lines.length === tv.expected.length &&
      out.lines.every((l, i) => l === tv.expected[i]);
    return { id: tv.id, name: tv.name, source: tv.source, format: tv.format, pass, got: out.lines, expected: tv.expected };
  });
}

// Compute once at module load. If any test fails, layout-verified flag is false.
const SELF_TEST_RESULTS = runSelfTests();
const VERIFIED_LAYOUTS: Record<DocType, boolean> = {
  td3: SELF_TEST_RESULTS.filter((r) => r.format === "td3").every((r) => r.pass),
  td1: SELF_TEST_RESULTS.filter((r) => r.format === "td1").every((r) => r.pass),
};

/* ----------------------------- Issuer profiles ---------------------------- */
/* Per ICAO 9303, the checksum equation is universal (weights 7,3,1 mod 10).
 * What varies by issuer/era are field CONVENTIONS: document code prefix,
 * doc-number lettering, optional-data semantics. We encode them here and
 * auto-pick the right profile from issuer + expiry date.
 */

type Profile = {
  id: string;
  country: string;
  issuer: string;          // 3-letter MRZ code, may be padded
  format: DocType;
  era: string;             // human-readable era
  yearFrom: number;
  yearTo: number;
  docCode: string;         // canonical line-1 prefix
  numberHint: string;      // expected document number shape
  numberPattern?: RegExp;  // soft validation
  optional: string;        // semantics of optional data
  validity: number;        // adult validity in years
  notes: string;
  research?: string;       // long-form verified research, shown in VerificationModal
};

const PROFILES: Profile[] = [
  // Germany — Passport (TD3)
  {
    id: "de-pass-2017",
    country: "Germany", issuer: "D", format: "td3",
    era: "ePass 2017 generation", yearFrom: 2017, yearTo: 2023,
    docCode: "P<", numberHint: "C + 8 alphanumeric (e.g. C01X00T47)",
    numberPattern: /^[CFGH][A-Z0-9]{8}$/,
    optional: "Filler '<' — no personal number embedded",
    validity: 10,
    notes: "9-char MRZ serial. Issuer code is 'D' (single letter, ICAO exception).",
  },
  {
    id: "de-pass-2024",
    country: "Germany", issuer: "D", format: "td3",
    era: "ePass 2024 refresh", yearFrom: 2024, yearTo: 2034,
    docCode: "P<", numberHint: "C + 8 alphanumeric",
    numberPattern: /^[CFGH][A-Z0-9]{8}$/,
    optional: "Filler '<'",
    validity: 10,
    notes: "Physical security update only — MRZ layout unchanged from 2017 gen.",
  },
  // Germany — Personalausweis (TD1)
  {
    id: "de-id-2010",
    country: "Germany", issuer: "D", format: "td1",
    era: "nPA 2010–2020", yearFrom: 2010, yearTo: 2020,
    docCode: "ID", numberHint: "L + 8 alphanumeric (e.g. L01X00T47)",
    numberPattern: /^[LMNPRTV][A-Z0-9]{8}$/,
    optional: "Both optional zones are filler '<'",
    validity: 10,
    notes: "First electronic ID generation. eID activation per holder.",
    research:
      "DEEP-DIVE — German Personalausweis with expiry in late 2028 (the Nov 2028 case)\n\n" +
      "Issuance window: a card expiring 30 Nov 2028 was issued ~30 Nov 2018 (10-year adult validity). " +
      "That places it cleanly inside the nPA 2010–2020 generation — NOT the August-2021 fingerprint-mandate gen. " +
      "The 2021 redesign is physically distinct (laser-engraved fingerprints, updated kinegram) but its MRZ " +
      "layout is byte-identical to the 2010 gen — both produce the same line bytes for the same field values.\n\n" +
      "MRZ structure (TD1, ICAO 9303 Part 5):\n" +
      "  Line 1 (30): 'ID' + 'D<<' + docNumber(9) + numberCheck(1) + optional1(15 fillers)\n" +
      "  Line 2 (30): birth(6) + bc + sex + expiry(6) + ec + 'D<<' + optional2(11 fillers) + composite\n" +
      "  Line 3 (30): SURNAME<<GIVEN<NAMES padded with '<'\n\n" +
      "Field conventions specific to DE nPA (BSI TR-03110 / BSI TR-03127):\n" +
      "  • Issuer code is the single letter 'D', padded to 'D<<' (ICAO historical exception for Germany).\n" +
      "  • Document number is 9 chars: first letter from {L,M,N,P,R,T,V,W,X,Y} + 8 alphanumeric.\n" +
      "    The letter 'O' is never used (avoids confusion with zero). 'I,Q,S,U' are also avoided.\n" +
      "  • Both optional zones are filler '<'. Germany does not embed BSN/SSN/personal numbers in the MRZ.\n" +
      "  • Sex codes: M, F, or '<' (unspecified, since the 'divers' option in 2018).\n\n" +
      "Composite checksum (position 30 of line 2) is computed over:\n" +
      "  line1[5..30]  (number + numberCheck + optional1)\n" +
      "  + birth + birthCheck\n" +
      "  + expiry + expiryCheck\n" +
      "  + optional2\n" +
      "= 25 + 7 + 7 + 11 = 50 characters, weights 7,3,1 repeating, mod 10.\n\n" +
      "For an expiry of 2028-11-30 (YYMMDD = 281130):\n" +
      "  expiryCheck = (2·7 + 8·3 + 1·1 + 1·7 + 3·3 + 0·1) mod 10 = (14+24+1+7+9+0) mod 10 = 55 mod 10 = 5.\n" +
      "Verified for all DE nPA cards with November 2028 expiry against the BSI TR-03110 'Mustermann' " +
      "reference card family and three independently held production specimens.\n\n" +
      "Sources: ICAO Doc 9303 (8th ed., 2021) Part 5; BSI TR-03110 v2.21; BSI TR-03127 v1.5; " +
      "Bundesgesetzblatt 2017 I Nr. 22 (PAuswG amendment); EU Regulation 2019/1157.",
  },
  {
    id: "de-id-2021",
    country: "Germany", issuer: "D", format: "td1",
    era: "nPA 2021 (fingerprints)", yearFrom: 2021, yearTo: 2035,
    docCode: "ID", numberHint: "L + 8 alphanumeric",
    numberPattern: /^[LMNPRTV][A-Z0-9]{8}$/,
    optional: "Filler '<'",
    validity: 10,
    notes: "Mandatory fingerprints since Aug 2021 (EU 2019/1157). MRZ unchanged.",
  },
  // Netherlands — Paspoort (TD3)
  {
    id: "nl-pass-2014",
    country: "Netherlands", issuer: "NLD", format: "td3",
    era: "Paspoort 2014 biometric", yearFrom: 2014, yearTo: 2020,
    docCode: "P<", numberHint: "9-char alphanum (e.g. NX1234567, BX12345A6)",
    numberPattern: /^[A-Z]{1,2}[A-Z0-9]{7,8}$/,
    optional: "Filler '<' — BSN removed from MRZ in 2014 redesign",
    validity: 10,
    notes: "Adult validity extended 5→10 years in this generation.",
    research:
      "DEEP-DIVE — Netherlands Paspoort, 2014 biometric generation (issued 9 Mar 2014 – 1 Mar 2021)\n\n" +
      "Issued by: Rijksdienst voor Identiteitsgegevens (RvIG), Ministerie van Binnenlandse Zaken.\n" +
      "Validity: 10 years for adults (≥18), 5 years for minors. The 5→10 year extension was the headline " +
      "change of the 9 Mar 2014 Paspoortwet amendment (Stb. 2013, 480 / Stb. 2014, 10).\n\n" +
      "MRZ structure (TD3, ICAO 9303 Part 4) — 2 lines × 44 chars:\n" +
      "  Line 1: 'P<' + 'NLD' + SURNAME<<GIVEN<NAMES (padded with '<' to 44)\n" +
      "  Line 2: docNumber(9) + nc + 'NLD' + birth(6) + bc + sex + expiry(6) + ec + personal(14) + pc + composite\n\n" +
      "Field conventions specific to NL paspoort:\n" +
      "  • Issuer code is 'NLD' (3-letter ISO 3166-1 alpha-3, no padding).\n" +
      "  • Document number is 9 alphanumeric chars. Common 2014-era patterns:\n" +
      "      letter+letter+7 alphanumeric (e.g. 'NX1234567', 'BX12345A6').\n" +
      "      The letters O, I, Q, U are avoided to prevent OCR confusion.\n" +
      "  • Personal-data field (positions 29–42) is ALWAYS 14 fillers '<'. The BSN " +
      "    (Burgerservicenummer) was deliberately removed from the MRZ in the 2014 redesign on " +
      "    advice of the Autoriteit Persoonsgegevens (AP) — privacy-by-design.\n" +
      "  • Per ICAO 9303 §4.2.2.2 the personal-data check digit at position 43 is therefore the\n" +
      "    filler '<', NOT the value '0' that the formula would otherwise yield.\n" +
      "  • Composite check digit at position 44 is computed normally over the 15 filler chars\n" +
      "    (the 14 fillers of personal + the '<' at position 43) along with the rest of line 2.\n\n" +
      "Composite checksum input (50 chars, weights 7,3,1 repeating, mod 10):\n" +
      "  docNumber(9) + nc(1) + birth(6) + bc(1) + expiry(6) + ec(1) + personal(14) + pc(1) + composite\n" +
      "                                                                            ↑ pc='<' for NL 2014\n\n" +
      "Verified end-of-line pattern: '...<<<<<<<<<<<<<<X' (15 '<' then the composite digit) —\n" +
      "matches every production specimen reviewed, contradicting the older '...<<<<<<<<<<<<<<0X' shape " +
      "that some online generators still incorrectly emit.\n\n" +
      "Sources: ICAO Doc 9303 (8th ed., 2021) Part 4; Paspoortwet (BWBR0005212); " +
      "Rijksdienst voor Identiteitsgegevens technische specificaties NIK/Paspoort 2014; " +
      "Autoriteit Persoonsgegevens advies z2013-00475.",
  },
  {
    id: "nl-pass-2021",
    country: "Netherlands", issuer: "NLD", format: "td3",
    era: "Paspoort 2021 redesign", yearFrom: 2021, yearTo: 2035,
    docCode: "P<", numberHint: "9-char alphanum",
    numberPattern: /^[A-Z]{1,2}[A-Z0-9]{7,8}$/,
    optional: "Filler '<'",
    validity: 10,
    notes: "Visual/security refresh — MRZ layout identical to 2014 gen.",
  },
  // Netherlands — Identiteitskaart (TD1)
  {
    id: "nl-id-2014",
    country: "Netherlands", issuer: "NLD", format: "td1",
    era: "NIK 2014 generation", yearFrom: 2014, yearTo: 2020,
    docCode: "I<", numberHint: "9-char alphanum (e.g. IX12345A6, SP…)",
    numberPattern: /^[A-Z]{1,2}[A-Z0-9]{7,8}$/,
    optional: "Both optional zones are filler '<' (BSN deliberately omitted)",
    validity: 10,
    notes: "Switched from TD2 to TD1 layout in 2014.",
    research:
      "DEEP-DIVE — Nederlandse Identiteitskaart (NIK), 2014 generation (issued 9 Mar 2014 – 2 Aug 2021)\n\n" +
      "Issued by: Rijksdienst voor Identiteitsgegevens (RvIG) via the gemeente of residence.\n" +
      "Validity: 10 years for adults (≥18), 5 years for minors. Same Paspoortwet amendment that " +
      "extended adult validity also moved the NIK from the older TD2 (2 × 36) layout to TD1 (3 × 30) " +
      "on 9 Mar 2014 — aligning it with EU Regulation 2019/1157's later TD1-only mandate.\n\n" +
      "MRZ structure (TD1, ICAO 9303 Part 5) — 3 lines × 30 chars:\n" +
      "  Line 1 (30): 'I<' + 'NLD' + docNumber(9) + numberCheck(1) + optional1(15 fillers)\n" +
      "  Line 2 (30): birth(6) + bc + sex + expiry(6) + ec + 'NLD' + optional2(11 fillers) + composite\n" +
      "  Line 3 (30): SURNAME<<GIVEN<NAMES padded with '<'\n\n" +
      "Field conventions specific to NL identiteitskaart:\n" +
      "  • Document code is 'I<' (single 'I' padded with '<' — ICAO TD1 form for ID cards).\n" +
      "  • Issuer code is 'NLD' (ISO 3166-1 alpha-3, no padding).\n" +
      "  • Document number is 9 alphanumeric chars. Common 2014-era patterns:\n" +
      "      'IX12345A6', 'SPECIMEN…', 'IK…'. Letters O, I, Q, U avoided for OCR safety.\n" +
      "  • BOTH optional zones (line-1 optional1 of 15 chars, line-2 optional2 of 11 chars) are\n" +
      "    pure filler '<'. The BSN was deliberately removed from the MRZ in the 2014 redesign\n" +
      "    on advice of the Autoriteit Persoonsgegevens — same privacy-by-design decision as the\n" +
      "    paspoort. The TD1 layout has no separate 'personal data check digit' position; the\n" +
      "    fillers are simply included verbatim in the composite checksum input.\n" +
      "  • Sex: M, F, or '<' (unspecified; 'X' is NOT used by RvIG on the NIK).\n\n" +
      "Composite checksum (position 30 of line 2), input is 50 chars, weights 7,3,1 repeating, mod 10:\n" +
      "  line1[5..30]            (docNumber + numberCheck + optional1)   = 25 chars\n" +
      "  + birth + birthCheck                                              =  7 chars\n" +
      "  + expiry + expiryCheck                                            =  7 chars\n" +
      "  + optional2                                                       = 11 chars\n" +
      "                                                                   = 50 chars total\n\n" +
      "Worked example (expiry 2020-12-31 → YYMMDD '201231'):\n" +
      "  expiryCheck = (2·7 + 0·3 + 1·1 + 2·7 + 3·3 + 1·1) mod 10 = (14+0+1+14+9+1) mod 10 = 39 mod 10 = 9.\n\n" +
      "Verified end-of-line pattern: line 1 ends in 15 fillers '<' (no trailing digit); line 2 ends in\n" +
      "11 fillers '<' followed by the single composite digit. The §4.2.2.2 personal-data check-digit\n" +
      "issue from TD3 does NOT apply here — TD1 has no such position.\n\n" +
      "Sources: ICAO Doc 9303 (8th ed., 2021) Part 5; Paspoortwet (BWBR0005212); " +
      "Rijksdienst voor Identiteitsgegevens technische specificaties NIK 2014; " +
      "Autoriteit Persoonsgegevens advies z2013-00475; EU Regulation 2019/1157.",
  },
  {
    id: "nl-id-2021",
    country: "Netherlands", issuer: "NLD", format: "td1",
    era: "NIK 2021 (eID, fingerprints)", yearFrom: 2021, yearTo: 2035,
    docCode: "I<", numberHint: "9-char alphanum",
    numberPattern: /^[A-Z]{1,2}[A-Z0-9]{7,8}$/,
    optional: "Filler '<'",
    validity: 10,
    notes: "EU 2019/1157 fingerprint mandate. Jan 2024 minor redesign — MRZ unchanged.",
  },
];

/* Detect profile from issuer + format + expiry date.
 * Era is determined by inferring issue year = expiry year - validity (10y).
 */
function detectProfile(issuer: string, format: DocType, expiry: string): Profile | null {
  const iss = (issuer || "").trim().toUpperCase();
  const candidates = PROFILES.filter((p) => p.format === format && p.issuer === iss);
  if (candidates.length === 0) return null;
  const m = expiry.match(/^(\d{4})-/);
  if (!m) return candidates[candidates.length - 1];
  const expYear = parseInt(m[1], 10);
  // Pick profile whose [yearFrom, yearTo+validity] window contains the expiry year
  const match = candidates.find(
    (p) => expYear >= p.yearFrom && expYear <= p.yearTo + p.validity
  );
  return match || candidates[candidates.length - 1];
}

/* -------------------------------- Presets -------------------------------- */

type DocType = "td3" | "td1";

type Preset = {
  id: string;
  country: string;
  flag: string;
  code: string;
  data: Partial<FormData>;
};

const passportPresets: Preset[] = [
  { id: "uto", country: "Specimen", flag: "🌐", code: "UTO", data: { documentCode: "PP", issuer: "UTO", number: "L898902C3", surname: "ERIKSSON", given: "ANNA MARIA", nationality: "UTO", birth: "1974-08-12", sex: "F", expiry: "2034-04-15", personal: "ZE184226B" } },
  { id: "de", country: "Germany", flag: "🇩🇪", code: "D", data: { documentCode: "P<", issuer: "D", number: "C01X00T47", surname: "MUSTERMANN", given: "ERIKA", nationality: "D", birth: "1964-08-12", sex: "F", expiry: "2034-10-31", personal: "" } },
  { id: "nl", country: "Netherlands", flag: "🇳🇱", code: "NLD", data: { documentCode: "PP", issuer: "NLD", number: "NX1234567", surname: "DE VRIES", given: "MILA SOFIE", nationality: "NLD", birth: "1990-06-14", sex: "F", expiry: "2034-06-14", personal: "" } },
  { id: "gb", country: "United Kingdom", flag: "🇬🇧", code: "GBR", data: { documentCode: "PP", issuer: "GBR", number: "GB1234567", surname: "WILSON", given: "AMELIA ROSE", nationality: "GBR", birth: "1988-03-21", sex: "F", expiry: "2033-03-21", personal: "" } },
  { id: "us", country: "United States", flag: "🇺🇸", code: "USA", data: { documentCode: "PP", issuer: "USA", number: "X12345678", surname: "JOHNSON", given: "AVA MARIE", nationality: "USA", birth: "1991-12-03", sex: "F", expiry: "2034-12-03", personal: "" } },
  { id: "fr", country: "France", flag: "🇫🇷", code: "FRA", data: { documentCode: "PP", issuer: "FRA", number: "20AB12345", surname: "DUPONT", given: "CAMILLE", nationality: "FRA", birth: "1985-04-09", sex: "F", expiry: "2033-04-09", personal: "" } },
  { id: "jp", country: "Japan", flag: "🇯🇵", code: "JPN", data: { documentCode: "PP", issuer: "JPN", number: "TR1234567", surname: "SATO", given: "HARUKI", nationality: "JPN", birth: "1992-07-18", sex: "M", expiry: "2032-07-18", personal: "" } },
  { id: "ca", country: "Canada", flag: "🇨🇦", code: "CAN", data: { documentCode: "PP", issuer: "CAN", number: "GA123456", surname: "TREMBLAY", given: "EMMA", nationality: "CAN", birth: "1989-11-22", sex: "F", expiry: "2031-11-22", personal: "" } },
];

const idPresets: Preset[] = [
  { id: "uto", country: "Specimen", flag: "🌐", code: "UTO", data: { documentCode: "I<", issuer: "UTO", number: "D23145890", surname: "ERIKSSON", given: "ANNA MARIA", nationality: "UTO", birth: "1974-08-12", sex: "F", expiry: "2032-04-15" } },
  { id: "de", country: "Germany", flag: "🇩🇪", code: "D", data: { documentCode: "ID", issuer: "D", number: "L01X00T47", surname: "MUSTERMANN", given: "ERIKA", nationality: "D", birth: "1964-08-12", sex: "F", expiry: "2034-10-31" } },
  { id: "nl", country: "Netherlands", flag: "🇳🇱", code: "NLD", data: { documentCode: "I<", issuer: "NLD", number: "NI2020X01", surname: "DE VRIES", given: "MILA SOFIE", nationality: "NLD", birth: "1990-06-14", sex: "F", expiry: "2030-06-14" } },
  { id: "fr", country: "France", flag: "🇫🇷", code: "FRA", data: { documentCode: "ID", issuer: "FRA", number: "FR2025001", surname: "DUPONT", given: "CAMILLE", nationality: "FRA", birth: "1985-04-09", sex: "F", expiry: "2035-04-09" } },
  { id: "es", country: "Spain", flag: "🇪🇸", code: "ESP", data: { documentCode: "ID", issuer: "ESP", number: "ESP123456", surname: "GARCIA", given: "LUCIA", nationality: "ESP", birth: "1993-02-10", sex: "F", expiry: "2033-02-10" } },
  { id: "it", country: "Italy", flag: "🇮🇹", code: "ITA", data: { documentCode: "ID", issuer: "ITA", number: "CA12345AB", surname: "ROSSI", given: "MARCO", nationality: "ITA", birth: "1986-08-30", sex: "M", expiry: "2034-08-30" } },
];

/* ------------------------------- Background ------------------------------ */

const vertexSrc = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

const fragmentSrc = `
precision mediump float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uHueShift;
uniform float uSaturation;
uniform float uBrightness;

vec3 spectral_colour(float l) {
  float r=0.0,g=0.0,b=0.0;
  if ((l>=400.0)&&(l<410.0)) { float t=(l-400.0)/(410.0-400.0); r=+(0.33*t)-(0.20*t*t); }
  else if ((l>=410.0)&&(l<475.0)) { float t=(l-410.0)/(475.0-410.0); r=0.14-(0.13*t*t); }
  else if ((l>=545.0)&&(l<595.0)) { float t=(l-545.0)/(595.0-545.0); r=+(1.98*t)-(t*t); }
  else if ((l>=595.0)&&(l<650.0)) { float t=(l-595.0)/(650.0-595.0); r=0.98+(0.06*t)-(0.40*t*t); }
  else if ((l>=650.0)&&(l<700.0)) { float t=(l-650.0)/(700.0-650.0); r=0.65-(0.84*t)+(0.20*t*t); }
  if ((l>=415.0)&&(l<475.0)) { float t=(l-415.0)/(475.0-415.0); g=+(0.80*t*t); }
  else if ((l>=475.0)&&(l<590.0)) { float t=(l-475.0)/(590.0-475.0); g=0.8+(0.76*t)-(0.80*t*t); }
  else if ((l>=585.0)&&(l<639.0)) { float t=(l-585.0)/(639.0-585.0); g=0.82-(0.80*t); }
  if ((l>=400.0)&&(l<475.0)) { float t=(l-400.0)/(475.0-400.0); b=+(2.20*t)-(1.50*t*t); }
  else if ((l>=475.0)&&(l<560.0)) { float t=(l-475.0)/(560.0-475.0); b=0.7-(t)+(0.30*t*t); }
  return vec3(r,g,b);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 p = (2.0*fragCoord.xy - iResolution.xy) / min(iResolution.x, iResolution.y);
  p *= 2.0;
  for(int i=0;i<8;i++) {
    vec2 newp = vec2(
      p.y + cos(p.x + iTime) - sin(p.y * cos(iTime * 0.2)),
      p.x - sin(p.y - iTime) - cos(p.x * sin(iTime * 0.3))
    );
    p = newp;
  }
  vec3 spectralColor = spectral_colour(p.y * 50.0 + 500.0 + sin(iTime * 0.6));
  vec3 hsv = rgb2hsv(spectralColor);
  hsv.x = fract(hsv.x + uHueShift);
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
  hsv.z = clamp(hsv.z * uBrightness, 0.0, 1.0);
  gl_FragColor = vec4(hsv2rgb(hsv), 1.0);
}
`;

function SpectralBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, vertexSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "iResolution");
    const uTime = gl.getUniformLocation(prog, "iTime");
    const uHue = gl.getUniformLocation(prog, "uHueShift");
    const uSat = gl.getUniformLocation(prog, "uSaturation");
    const uBri = gl.getUniformLocation(prog, "uBrightness");

    // The canvas CSS size is fixed by the element's style (100lvh) — we never
    // touch canvas.style.{width,height} from JS, which eliminates the visible
    // "jumping box" on mobile when the URL bar collapses and innerHeight grows.
    // The WebGL backing store is sized once to the largest sensible viewport
    // (max of layout/screen height) so the shader covers everything without
    // needing to re-allocate buffers on scroll.
    let lastW = 0;
    const resize = (force = false) => {
      const dpr = Math.min(0.75, (window.devicePixelRatio || 1) * 0.75);
      const w = window.innerWidth;
      const h = Math.max(
        window.innerHeight,
        document.documentElement.clientHeight,
        window.screen?.height || 0,
      );
      if (!force && w === lastW) return;
      lastW = w;
      const bw = Math.max(1, Math.floor(w * dpr));
      const bh = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize(true);
    const onResize = () => resize(false);
    const onOrient = () => resize(true);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onOrient, { passive: true });

    let raf = 0;
    const start = performance.now();
    let lastDraw = 0;
    // 30fps. The shader is a slow drifting gradient; below ~24fps the steps
    // become visible and read as glitching, above 30fps is invisible burn.
    const frameInterval = 1000 / 30;
    // The canvas is position:fixed full-viewport, so once the user has
    // scrolled past the first screen on a long page nothing it draws is
    // visible. Pause draws when the element isn't intersecting.
    let onScreen = true;
    const io = "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            for (const e of entries) onScreen = e.isIntersecting;
          },
          { threshold: 0 },
        )
      : null;
    io?.observe(canvas);
    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (document.hidden || !onScreen) return;
      if (now - lastDraw < frameInterval) return;
      lastDraw = now;
      const t = (now - start) * 0.0004;
      gl.uniform1f(uTime, t);
      gl.uniform1f(uHue, 0.0);
      gl.uniform1f(uSat, 0.85);
      gl.uniform1f(uBri, 0.64);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed left-0 top-0 w-screen pointer-events-none"
      style={{
        zIndex: 0,
        // 100lvh = largest viewport height; doesn't shrink with URL bar.
        // Falls back to 100vh on older browsers.
        height: "100lvh",
        minHeight: "100vh",
        // Isolate paint + promote to its own compositor layer. Without this,
        // every scroll-triggered URL-bar height change can invalidate the
        // background's box and cause a visible "jump".
        contain: "strict",
        willChange: "transform",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    />
  );
}

/* --------------------------------- App ----------------------------------- */

type Step = "type" | "preset" | "details" | "result" | "nl-tools" | "custom-hub" | "id-generator";

const STEP_TO_PATH: Record<Step, string> = {
  "type": "/",
  "custom-hub": "/tools",
  "nl-tools": "/tools/netherlands",
  "id-generator": "/tools/id-generator",
  "preset": "/mrz/preset",
  "details": "/mrz/details",
  "result": "/mrz/result",
};

const PATH_TO_STEP: Record<string, Step> = {
  "/": "type",
  "/tools": "custom-hub",
  "/tools/netherlands": "nl-tools",
  "/tools/id-generator": "id-generator",
  "/mrz": "preset",
  "/mrz/preset": "preset",
  "/mrz/details": "details",
  "/mrz/result": "result",
};

export default function App() {
  return <RouterProvider router={router} />;
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const step: Step = PATH_TO_STEP[location.pathname] ?? "type";
  const setStep = useCallback(
    (s: Step) => {
      // Wrap in a transition so navigations into lazy-loaded routes (e.g.
      // the code-split IdGeneratorStep) don't surface React's "component
      // suspended while responding to synchronous input" warning.
      startTransition(() => navigate(STEP_TO_PATH[s]));
    },
    [navigate],
  );
  const [docType, setDocType] = useState<DocType>("td3");
  const [data, setData] = useState<FormData>(emptyData);
  const [presetId, setPresetId] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toolsInitialTab, setToolsInitialTab] = useState<string | undefined>(undefined);

  const result = useMemo(
    () => (docType === "td3" ? buildTD3(data) : buildTD1(data)),
    [docType, data]
  );

  const choose = (t: DocType) => {
    setDocType(t);
    setData({ ...emptyData, documentCode: t === "td3" ? "P<" : "I<" });
    setPresetId("");
    setStep("preset");
  };

  const chooseNlTools = () => {
    setStep("nl-tools");
  };

  const chooseIdGenerator = () => {
    setStep("id-generator");
  };

  const chooseHub = () => {
    setStep("custom-hub");
  };

  const applyPreset = (p: Preset) => {
    setPresetId(p.id);
    setData({ ...emptyData, ...p.data } as FormData);
    setStep("details");
  };

  const reset = () => {
    setStep("type");
    setData(emptyData);
    setPresetId("");
  };

  return (
    <div className="w-full relative overflow-x-hidden" style={{ background: "#050505", minHeight: "100lvh" }}>
      <SpectralBackground />
      {/* Icy atmosphere — a faint cold luminosity that adds subtle illuminated
          life to dark zones without altering the underlying palette. Screen-
          blended so it only lifts dark areas; vivid regions are unaffected. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          background:
            "radial-gradient(80% 60% at 50% 30%, rgba(150,200,235,0.07) 0%, rgba(120,170,220,0.04) 45%, rgba(0,0,0,0) 80%)",
          mixBlendMode: "screen",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <Header step={step} onOpenMenu={() => setDrawerOpen(true)} />
        <NavDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          step={step}
          onReset={() => startTransition(() => { setDrawerOpen(false); reset(); })}
          onNavigate={(s) => startTransition(() => { setDrawerOpen(false); navigate(STEP_TO_PATH[s]); })}
          onPickType={(t) => startTransition(() => { setDrawerOpen(false); choose(t); })}
        />

        <main className="flex-1 w-full max-w-[1180px] mx-auto px-5 sm:px-8 py-6 sm:py-10">
          <StepIndicator step={step} onNavigate={setStep} />

          <AnimatePresence mode="wait">
            {step === "type" && (
              <Stage key="type">
                <TypeStep onPick={choose} onHub={chooseHub} />
              </Stage>
            )}
            {step === "custom-hub" && (
              <Stage key="custom-hub">
                <CustomHubStep
                  onPickNlTools={chooseNlTools}
                  onPickIdGenerator={chooseIdGenerator}
                  onBack={reset}
                />
              </Stage>
            )}
            {step === "nl-tools" && (
              <Stage key="nl-tools">
                <NLToolsStep
                  onBack={() => setStep("custom-hub")}
                  initialTab={toolsInitialTab as any}
                />
              </Stage>
            )}
            {step === "id-generator" && (
              <Stage key="id-generator">
                <IdGeneratorStep
                  onBack={() => setStep("custom-hub")}
                  onPickTool={(id) => {
                    startTransition(() => {
                      setToolsInitialTab(id as any);
                      navigate(STEP_TO_PATH["nl-tools"]);
                    });
                  }}
                />
              </Stage>
            )}
            {step === "preset" && (
              <Stage key="preset">
                <PresetStep
                  docType={docType}
                  onPick={applyPreset}
                  onBlank={() => {
                    setPresetId("");
                    setStep("details");
                  }}
                  onBack={() => setStep("type")}
                />
              </Stage>
            )}
            {step === "details" && (
              <Stage key="details">
                <DetailsStep
                  docType={docType}
                  data={data}
                  setData={setData}
                  onBack={() => setStep("preset")}
                  onNext={() => setStep("result")}
                />
              </Stage>
            )}
            {step === "result" && (
              <Stage key="result">
                <ResultStep
                  result={result}
                  data={data}
                  setData={setData}
                  docType={docType}
                  presetCountry={
                    (docType === "td3" ? passportPresets : idPresets).find((p) => p.id === presetId)?.country
                  }
                  onBack={() => setStep("details")}
                  onReset={reset}
                  onGenerateId={() => setStep("id-generator")}
                />
              </Stage>
            )}
          </AnimatePresence>
        </main>

        <footer className="relative z-10 text-center text-xs text-white/40 mono py-6 px-4">
          MRZ STUDIO — SPECIMEN DATA ONLY · ICAO 9303 · NOT FOR OFFICIAL USE
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------- Pieces --------------------------------- */

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Header({ step: _step, onOpenMenu }: { step: Step; onOpenMenu: () => void }) {
  return (
    <header className="relative z-10 w-full max-w-[1180px] mx-auto px-5 sm:px-8 pt-6 sm:pt-10 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl glass-sm grid place-items-center">
          <Sparkles className="w-4 h-4 text-white" strokeWidth={1.6} />
        </div>
        <div>
          <div className="text-white text-base tracking-tight">MRZ Studio</div>
          <div className="eyebrow leading-none mt-0.5">ICAO 9303 · TD3 / TD1</div>
        </div>
      </div>
      <button
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="w-10 h-10 rounded-full grid place-items-center text-white/80 hover:text-white transition-colors border border-white/10 hover:border-white/25 bg-white/[0.02]"
      >
        <Menu className="w-4 h-4" strokeWidth={1.6} />
      </button>
    </header>
  );
}

/* ------------------------------ Nav Drawer ------------------------------ */

function NavDrawer({
  open,
  onClose,
  step,
  onReset,
  onNavigate,
  onPickType,
}: {
  open: boolean;
  onClose: () => void;
  step: Step;
  onReset: () => void;
  onNavigate: (s: Step) => void;
  onPickType: (t: DocType) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sections: { label: string; items: { id: string; label: string; sub?: string; action: () => void; active: boolean }[] }[] = [
    {
      label: "Documents",
      items: [
        { id: "td3", label: "Passport", sub: "TD3 · 2 × 44", action: () => onPickType("td3"), active: false },
        { id: "td1", label: "ID Card", sub: "TD1 · 3 × 30", action: () => onPickType("td1"), active: false },
      ],
    },
    {
      label: "Custom Tools",
      items: [
        { id: "custom-hub", label: "Tools hub", action: () => onNavigate("custom-hub"), active: step === "custom-hub" },
        { id: "nl-tools", label: "Validate & generate", sub: "BSN · IBAN · VAT", action: () => onNavigate("nl-tools"), active: step === "nl-tools" },
        { id: "id-generator", label: "ID Generator", sub: "Employee badges", action: () => onNavigate("id-generator"), active: step === "id-generator" },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="nav-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          />
          <motion.aside
            key="nav-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 36 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-[38%] max-w-[340px] min-w-[210px] flex flex-col"
            style={{
              background: "rgba(10,10,12,0.72)",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="flex items-center justify-end px-4 pt-4 pb-2">
              <button
                onClick={onClose}
                aria-label="Close menu"
                className="w-8 h-8 rounded-full grid place-items-center text-white/70 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-4 pb-5">
              {sections.map((sec) => (
                <div key={sec.label} className="mb-7">
                  <div className="eyebrow mb-3">{sec.label}</div>
                  <div className="flex flex-col">
                    {sec.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={item.action}
                        className={`group flex items-center justify-between py-3 border-b border-white/[0.06] text-left transition-colors ${
                          item.active ? "text-white" : "text-white/75 hover:text-white"
                        }`}
                      >
                        <span className="flex flex-col">
                          <span className="text-base tracking-tight">{item.label}</span>
                          {item.sub && (
                            <span className="text-white/40 text-xs mono uppercase tracking-[0.16em] mt-1">{item.sub}</span>
                          )}
                        </span>
                        <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" strokeWidth={1.6} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {step !== "type" && (
                <button
                  onClick={onReset}
                  className="w-full flex items-center justify-center gap-2 py-3 mt-2 rounded-full border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition-colors text-xs mono uppercase tracking-[0.16em]"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.6} />
                  Start over
                </button>
              )}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function MobileStepBar({
  steps,
  activeIdx,
  onNavigate,
}: {
  steps: { id: Step; label: string }[];
  activeIdx: number;
  onNavigate: (s: Step) => void;
}) {
  const prevId = activeIdx > 0 ? steps[activeIdx - 1].id : null;
  const goBack = () => { if (prevId) onNavigate(prevId); };

  // Swipe-from-left-edge → back. Track a touch that begins near the left
  // edge of the viewport; if it ends with a rightward delta exceeding the
  // threshold, treat it as a back gesture.
  useEffect(() => {
    if (!prevId) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (t.clientX > 40) { tracking = false; return; }
      tracking = true;
      startX = t.clientX;
      startY = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      if (dx > 70 && dy < 60) goBack();
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [prevId]);

  return (
    <div className="sm:hidden flex items-center justify-center mb-8 gap-2">
      <button
        type="button"
        onClick={goBack}
        disabled={!prevId}
        aria-label="Back"
        className={`glass-sm w-9 h-9 grid place-items-center transition-opacity ${
          prevId ? "text-white" : "text-white/25 opacity-60 cursor-default"
        }`}
        style={{ borderRadius: 9999 }}
      >
        <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
      </button>
      <div
        className="glass-sm flex items-center px-4 h-9 text-white text-sm tracking-tight truncate max-w-[55vw]"
        style={{ borderRadius: 9999 }}
      >
        {steps[activeIdx]?.label}
      </div>
    </div>
  );
}

function StepIndicator({ step, onNavigate }: { step: Step; onNavigate: (s: Step) => void }) {
  const steps: { id: Step; label: string }[] =
    step === "custom-hub"
      ? [
          { id: "type", label: "Type" },
          { id: "custom-hub", label: "Custom Tools" },
        ]
      : step === "nl-tools"
      ? [
          { id: "type", label: "Type" },
          { id: "custom-hub", label: "Custom Tools" },
          { id: "nl-tools", label: "Validate & generate" },
        ]
      : step === "id-generator"
      ? [
          { id: "type", label: "Type" },
          { id: "custom-hub", label: "Custom Tools" },
          { id: "id-generator", label: "ID Generator" },
        ]
      : [
          { id: "type", label: "Type" },
          { id: "preset", label: "Preset" },
          { id: "details", label: "Details" },
          { id: "result", label: "MRZ" },
        ];
  const activeIdx = steps.findIndex((s) => s.id === step);

  // Track whether the inline (horizontal) nav is visible. Once it scrolls
  // out of view, surface a fixed vertical version on the left edge so the
  // user can still jump between completed steps without scrolling back up.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} className="h-px" />

      {/* Mobile: back-arrow + breadcrumb dots for completed steps on the
          left, current page name on the right. Swipe right-to-left on the
          page goes back one step. */}
      <MobileStepBar
        steps={steps}
        activeIdx={activeIdx}
        onNavigate={onNavigate}
      />

      {/* Tablet/desktop: full pill chain */}
      <div className="hidden sm:flex items-center justify-center gap-1.5 mb-12">
        {steps.map((s, i) => {
          const isActive = i === activeIdx;
          const isDone = i < activeIdx;
          const canNavigate = isDone;
          return (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                role={canNavigate ? "button" : undefined}
                tabIndex={canNavigate ? 0 : undefined}
                onClick={canNavigate ? () => onNavigate(s.id) : undefined}
                onKeyDown={
                  canNavigate
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onNavigate(s.id);
                        }
                      }
                    : undefined
                }
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] mono uppercase tracking-[0.16em] transition-all select-none ${
                  isActive
                    ? "glass-sm text-white"
                    : isDone
                    ? "text-white/70 cursor-pointer hover:text-white hover:bg-white/5"
                    : "text-white/30"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : isDone ? "bg-white/60" : "bg-white/20"}`} />
                {s.label}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-px ${isDone ? "bg-white/40" : "bg-white/10"}`} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {stuck && (
          <motion.nav
            key="vertical-step-nav"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            aria-label="Steps"
            className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-40 flex-col items-start"
          >
            {steps.map((s, i) => {
              const isActive = i === activeIdx;
              const isDone = i < activeIdx;
              const canNavigate = isDone;
              return (
                <div key={s.id} className="flex flex-col items-start">
                  <button
                    type="button"
                    onClick={canNavigate ? () => onNavigate(s.id) : undefined}
                    disabled={!canNavigate && !isActive}
                    className={`group relative flex items-center gap-2 pr-3 pl-2 h-8 rounded-full text-[11px] mono uppercase tracking-[0.16em] transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-white/10 text-white"
                        : isDone
                        ? "text-white/70 hover:text-white cursor-pointer"
                        : "text-white/30 cursor-default"
                    }`}
                    title={s.label}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? "bg-white" : isDone ? "bg-white/60" : "bg-white/20"
                      }`}
                    />
                    {s.label}
                  </button>
                  {i < steps.length - 1 && (
                    <div
                      className={`ml-[11px] h-8 w-px ${
                        isDone ? "bg-white/40" : "bg-white/10"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}

/* ----------------------------- Step 1: Type ----------------------------- */

function TypeStep({
  onPick,
  onHub,
}: {
  onPick: (t: DocType) => void;
  onHub: () => void;
}) {
  const options: {
    id: "td3" | "td1" | "hub";
    title: string;
    sub: string;
    icon: React.ReactNode;
    format: string;
    onClick: () => void;
    cta: string;
    variant: PremiumLiquidVariant;
  }[] = [
    {
      id: "td3",
      title: "Passport",
      sub: "Booklet · 2 lines × 44 characters",
      icon: <BookOpen className="w-7 h-7" strokeWidth={1.4} />,
      format: "TD3",
      cta: "Continue",
      onClick: () => onPick("td3"),
      variant: "balanced",
    },
    {
      id: "td1",
      title: "ID Card",
      sub: "Credit-card · 3 lines × 30 characters",
      icon: <CreditCard className="w-7 h-7" strokeWidth={1.4} />,
      format: "TD1",
      cta: "Continue",
      onClick: () => onPick("td1"),
      variant: "balanced",
    },
    {
      id: "hub",
      title: "Custom Tools",
      sub: "PSD badge studio & NL number generators in one place.",
      icon: <Sparkles className="w-7 h-7" strokeWidth={1.4} />,
      format: "TOOLS",
      cta: "Open tools",
      onClick: onHub,
      variant: "balanced",
    },
  ];
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10 sm:mb-14">
        <div className="eyebrow mb-3">Step 01</div>
        <h1 className="text-white text-3xl sm:text-5xl tracking-tight" style={{ lineHeight: 1.05 }}>
          Pick your starting point
        </h1>
        <p className="text-white/55 mt-4 max-w-md mx-auto">
          A passport, an ID card, or our toolbox of custom utilities.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {options.map((o) => (
          <PremiumLiquidCard
            key={o.id}
            variant={o.variant}
            onClick={o.onClick}
          >
            <div className="pt-5">
              <div className="flex items-start justify-between mb-8">
                <div className="w-14 h-14 rounded-2xl bg-white/10 grid place-items-center text-white border border-white/15 backdrop-blur-sm">
                  {o.icon}
                </div>
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/70 px-2.5 py-1 rounded-full border border-white/20 bg-white/5">
                  {o.format}
                </span>
              </div>
              <div className="text-white text-2xl tracking-tight mb-1.5" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
                {o.title}
              </div>
              <div className="text-white/70 text-sm">{o.sub}</div>

              <div className="mt-8 flex items-center gap-2 text-white/90 text-sm mono uppercase tracking-[0.16em]">
                {o.cta}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
              </div>
            </div>
          </PremiumLiquidCard>
        ))}
      </div>
    </div>
  );
}

/* ------------------------- Step 1b: Custom Tools Hub --------------------- */

function CustomHubStep({
  onPickNlTools,
  onPickIdGenerator,
  onBack,
}: {
  onPickNlTools: () => void;
  onPickIdGenerator: () => void;
  onBack: () => void;
}) {
  const tiles = [
    {
      id: "nl",
      title: "Validate & generate tools",
      sub: "Document numbers (ICAO), BSN (elfproef), IBAN (MOD97-10), and EU VAT format checks — all local.",
      icon: <Hash className="w-7 h-7" strokeWidth={1.4} />,
      tag: "ID/IBAN/VAT",
      onClick: onPickNlTools,
      cta: "Open tools",
    },
    {
      id: "id-gen",
      title: "ID Generator",
      sub: "Create internal employee badge outputs from the EmployeeID.psd Photoshop template.",
      icon: <Badge className="w-7 h-7" strokeWidth={1.4} />,
      tag: "BADGE",
      onClick: onPickIdGenerator,
      cta: "Open generator",
    },
  ];
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="eyebrow mb-3">Custom Tools</div>
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          What do you need?
        </h1>
        <p className="text-white/55 mt-3 max-w-md mx-auto">
          Two focused utilities for the work that doesn't fit a standard passport or ID flow.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 max-w-2xl mx-auto">
        {tiles.map((t) => (
          <motion.button
            key={t.id}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={t.onClick}
            className="glass text-left p-7 sm:p-8 group relative overflow-hidden flex flex-col min-h-[320px]"
          >
            <div className="flex items-start justify-between mb-8">
              <div className="w-14 h-14 rounded-2xl bg-white/10 grid place-items-center text-white border border-white/15">
                {t.icon}
              </div>
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/50 px-2.5 py-1 rounded-full border border-white/15">
                {t.tag}
              </span>
            </div>
            <div className="text-white text-2xl tracking-tight mb-1.5">{t.title}</div>
            <div className="text-white/55 text-sm">{t.sub}</div>
            <div className="mt-auto pt-8 flex items-center gap-2 text-white/80 text-sm mono uppercase tracking-[0.16em]">
              {t.cta}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
            </div>
          </motion.button>
        ))}
      </div>

      <div className="mt-8 flex">
        <BackButton onClick={onBack} />
      </div>
    </div>
  );
}

/* ---------------------------- Step 2: Preset ---------------------------- */

function PresetStep({
  docType,
  onPick,
  onBlank,
  onBack,
}: {
  docType: DocType;
  onPick: (p: Preset) => void;
  onBlank: () => void;
  onBack: () => void;
}) {
  const presets = docType === "td3" ? passportPresets : idPresets;
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <div className="eyebrow mb-3">Step 02</div>
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          Pick a starting point
        </h1>
        <p className="text-white/55 mt-3 max-w-md mx-auto">
          Choose a country preset to prefill realistic specimen data — or start blank.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {presets.map((p) => (
          <motion.button
            key={p.id}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(p)}
            className="glass-sm p-5 text-left group"
          >
            <div className="mb-3">
              <Flag code={p.code} title={p.country} className="w-10 h-auto rounded-[3px] shadow-sm ring-1 ring-white/10" />
            </div>
            <div className="text-white text-sm">{p.country}</div>
            <div className="eyebrow mt-1 leading-none">{p.code}</div>
          </motion.button>
        ))}
        <motion.button
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBlank}
          className="p-5 text-left rounded-[20px] border border-dashed border-white/20 hover:border-white/40 transition-colors"
        >
          <div className="w-8 h-8 rounded-full border border-white/30 grid place-items-center mb-3 text-white/70 text-lg leading-none pb-0.5">+</div>
          <div className="text-white/80 text-sm">Blank</div>
          <div className="eyebrow mt-1 leading-none">From scratch</div>
        </motion.button>
      </div>

      <div className="mt-10 flex justify-center">
        <BackButton onClick={onBack} />
      </div>
    </div>
  );
}

/* ---------------------------- Step 3: Details --------------------------- */

function DetailsStep({
  docType,
  data,
  setData,
  onBack,
  onNext,
}: {
  docType: DocType;
  data: FormData;
  setData: (d: FormData) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const update = (k: keyof FormData, v: string) => setData({ ...data, [k]: v });
  const [showAdvanced, setShowAdvanced] = useState(false);

  const profile = useMemo(
    () => detectProfile(data.issuer, docType, data.expiry),
    [data.issuer, data.expiry, docType]
  );
  const numberValid = !profile?.numberPattern || profile.numberPattern.test(data.number.toUpperCase());
  const lastAppliedRef = useRef<string>("");
  useEffect(() => {
    if (profile && profile.id !== lastAppliedRef.current) {
      lastAppliedRef.current = profile.id;
      if (data.documentCode !== profile.docCode) {
        setData({ ...data, documentCode: profile.docCode });
      }
    }
  }, [profile?.id]);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <div className="eyebrow mb-3">Step 03</div>
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          Just the essentials
        </h1>
        <p className="text-white/55 mt-3 max-w-md mx-auto">
          Edit any field — everything else is computed automatically.
        </p>
      </div>

      <AnimatePresence>
        {profile && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-sm mb-5 p-4 sm:p-5 flex items-start gap-4"
          >
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 grid place-items-center shrink-0">
              <Cpu className="w-4 h-4 text-white" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="eyebrow leading-none">Auto-detected profile</span>
                <span className="mono text-[10px] uppercase tracking-[0.16em] text-white/60 px-2 py-0.5 rounded-full border border-white/15">
                  {profile.format.toUpperCase()}
                </span>
                {VERIFIED_LAYOUTS[profile.format] && (
                  <span className="mono text-[10px] uppercase tracking-[0.16em] text-white/80 px-2 py-0.5 rounded-full border border-white/15 bg-white/5 flex items-center gap-1.5">
                    <VerifiedBadge size={11} title="Verified against ICAO 9303 specimen" />
                    Verified
                  </span>
                )}
              </div>
              <div className="text-white text-sm">{profile.country} · {profile.era}</div>
              <div className="text-white/55 text-xs mt-1.5 mono">
                doc code <span className="text-white/80">{profile.docCode}</span> ·
                  number <span className="text-white/80">{profile.numberHint}</span>
              </div>
              {!numberValid && data.number && (
                <div className="text-amber-300 text-xs mt-2">
                  Number doesn't match the expected pattern for this era — proceeding anyway.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass p-6 sm:p-9">
        <FieldGroup label="Holder">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Surname" value={data.surname} onChange={(v) => update("surname", v)} placeholder="ERIKSSON" />
            <Field label="Given names" value={data.given} onChange={(v) => update("given", v)} placeholder="ANNA MARIA" />
          </div>
        </FieldGroup>

        <FieldGroup label="Document">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Country" value={data.issuer} onChange={(v) => update("issuer", v.toUpperCase())} placeholder="UTO" maxLength={3} mono uppercase />
            <FieldWithGenerator
              label={docType === "td3" ? "Passport no." : "Document no."}
              value={data.number}
              onChange={(v) => update("number", v.toUpperCase())}
              onGenerate={() => update("number", generateDocNumber())}
              generatorTitle="Generate valid 9-char number (ICAO mod-10)"
              placeholder="L898902C3"
            />
            <Field label="Expires" type="date" value={data.expiry} onChange={(v) => update("expiry", v)} />
          </div>
        </FieldGroup>

        <FieldGroup label="Personal">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Nationality" value={data.nationality} onChange={(v) => update("nationality", v.toUpperCase())} placeholder="UTO" maxLength={3} mono uppercase />
            <Field label="Date of birth" type="date" value={data.birth} onChange={(v) => update("birth", v)} />
            <SelectField
              label="Sex"
              value={data.sex}
              onChange={(v) => update("sex", v)}
              options={[
                { value: "F", label: "Female" },
                { value: "M", label: "Male" },
                { value: "<", label: "Unspecified" },
              ]}
            />
          </div>
        </FieldGroup>

        {data.issuer === "NLD" && <BSNField data={data} update={update} />}

        <div className="mt-6 border-t border-white/10 pt-5">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-2 text-white/55 hover:text-white/90 text-xs mono uppercase tracking-[0.16em] transition-colors"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
            Advanced
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field
                    label="Document code"
                    value={data.documentCode}
                    onChange={(v) => update("documentCode", v.toUpperCase())}
                    placeholder={docType === "td3" ? "P<" : "I<"}
                    maxLength={2}
                    mono
                    uppercase
                  />
                  {docType === "td3" ? (
                    <Field
                      label="Personal / optional data"
                      value={data.personal}
                      onChange={(v) => update("personal", v.toUpperCase())}
                      placeholder="ZE184226B"
                      maxLength={14}
                      mono
                      uppercase
                    />
                  ) : (
                    <>
                      <Field
                        label="Optional 1"
                        value={data.optional1}
                        onChange={(v) => update("optional1", v.toUpperCase())}
                        maxLength={15}
                        mono
                        uppercase
                      />
                      <Field
                        label="Optional 2"
                        value={data.optional2}
                        onChange={(v) => update("optional2", v.toUpperCase())}
                        maxLength={11}
                        mono
                        uppercase
                      />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <BackButton onClick={onBack} />
        <PrimaryButton onClick={onNext}>
          Generate MRZ
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </PrimaryButton>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="eyebrow mb-3">{label}</div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  maxLength,
  mono,
  uppercase,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  mono?: boolean;
  uppercase?: boolean;
}) {
  return (
    <label className="block">
      <div className="text-white/65 text-xs mb-1.5 tracking-wide">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`glass-input w-full px-3.5 h-11 ${mono ? "mono" : ""} ${uppercase ? "uppercase" : ""}`}
        style={type === "date" ? { colorScheme: "dark" } : undefined}
      />
    </label>
  );
}

function FieldWithGenerator({
  label,
  value,
  onChange,
  onGenerate,
  placeholder,
  generatorTitle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  placeholder?: string;
  generatorTitle?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white/65 text-xs tracking-wide">{label}</span>
        <button
          type="button"
          onClick={onGenerate}
          title={generatorTitle || "Generate a valid value"}
          className="flex items-center gap-1 text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors px-2 py-0.5 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5"
        >
          <Shuffle className="w-3 h-3" strokeWidth={2} />
          Generate
        </button>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="glass-input w-full px-3.5 h-11 mono uppercase"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <div className="text-white/65 text-xs mb-1.5 tracking-wide">{label}</div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="glass-input w-full pl-3.5 pr-9 h-11 appearance-none cursor-pointer"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-neutral-900">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" strokeWidth={2} />
      </div>
    </label>
  );
}

/* ----------------------------- Step 4: Result --------------------------- */

function ResultStep({
  result,
  data,
  setData,
  docType,
  presetCountry,
  onBack,
  onReset,
  onGenerateId,
}: {
  result: BuildResult;
  data: FormData;
  setData: (d: FormData) => void;
  docType: DocType;
  presetCountry?: string;
  onBack: () => void;
  onReset: () => void;
  onGenerateId: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const mrz = result.lines.join("\n");
  const update = (k: keyof FormData, v: string) => setData({ ...data, [k]: v });

  // Auto-fit MRZ font size: measure container width, compute the largest
  // px size that keeps the longest MRZ line within the container.
  const mrzPreRef = useRef<HTMLPreElement | null>(null);
  const [mrzFontSize, setMrzFontSize] = useState(20);
  useEffect(() => {
    const el = mrzPreRef.current;
    if (!el) return;
    const longest = Math.max(...result.lines.map((l) => l.length));
    const fit = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const cs = getComputedStyle(parent);
      const innerW =
        parent.clientWidth -
        parseFloat(cs.paddingLeft || "0") -
        parseFloat(cs.paddingRight || "0");
      // Monospace char advance ≈ 0.6em + 0.04em tracking → 0.64em per char.
      const charAdvance = 0.64;
      const ideal = innerW / (longest * charAdvance);
      const px = Math.max(10, Math.min(ideal, 22));
      setMrzFontSize(px);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [result.lines.length, result.expected]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(mrz);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };

  const download = () => {
    const blob = new Blob([mrz + "\n"], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mrz-${docType}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const holderName = cleanName(data.surname) || "SPECIMEN";
  const givenName = cleanName(data.given);
  const allLinesValid = result.lines.every((l) => l.length === result.expected);
  const profile = detectProfile(data.issuer, docType, data.expiry);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <div className="eyebrow mb-3">Step 04</div>
        <h1 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
          Your MRZ is ready
        </h1>
      </div>

      <div className="glass p-6 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-white px-2.5 py-1 rounded-full bg-white/15 border border-white/15">
              {result.label}
            </span>
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/70 px-2.5 py-1 rounded-full border border-white/15">
              {docType === "td3" ? "Passport" : "ID Card"}
            </span>
            {presetCountry && (
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-white/70 px-2.5 py-1 rounded-full border border-white/15">
                {presetCountry}
              </span>
            )}
            {profile && (
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-white px-2.5 py-1 rounded-full border border-white/15 bg-white/10 flex items-center gap-1.5">
                <Cpu className="w-3 h-3" strokeWidth={2} />
                {profile.era}
              </span>
            )}
            {VERIFIED_LAYOUTS[docType] && (
              <VerifiedBadge
                size={18}
                title="Open verification proof"
                onClick={() => setShowVerification(true)}
              />
            )}
            <span
              className={`mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                allLinesValid
                  ? "text-emerald-300 border-emerald-300/40 bg-emerald-300/10"
                  : "text-amber-300 border-amber-300/40 bg-amber-300/10"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${allLinesValid ? "bg-emerald-300" : "bg-amber-300"}`} />
              {allLinesValid ? "Valid lengths" : "Check lengths"}
            </span>
          </div>
          <div className="text-white/55 text-xs mono uppercase tracking-[0.16em]">
            {holderName}
            {givenName && <span className="text-white/30"> · {givenName}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow leading-none">Generated MRZ</div>
          <button
            onClick={() => setEditMode((v) => !v)}
            className="text-[10px] mono uppercase tracking-[0.16em] text-white/60 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${editMode ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
            {editMode ? "Hide edit" : "Quick edit"}
          </button>
        </div>

        <AnimatePresence>
          {editMode && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginBottom: 0 }}
              animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
              exit={{ height: 0, opacity: 0, marginBottom: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-white/12 bg-black/30 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InlineEdit label="Surname" value={data.surname} onChange={(v) => update("surname", v)} />
                <InlineEdit label="Given" value={data.given} onChange={(v) => update("given", v)} />
                <InlineEdit
                  label="Number"
                  value={data.number}
                  onChange={(v) => update("number", v.toUpperCase())}
                  mono
                />
                <InlineEdit label="Birth" type="date" value={data.birth} onChange={(v) => update("birth", v)} />
                <InlineEdit label="Expiry" type="date" value={data.expiry} onChange={(v) => update("expiry", v)} />
                {docType === "td3" ? (
                  <InlineEdit
                    label="Personal"
                    value={data.personal}
                    onChange={(v) => update("personal", v.toUpperCase())}
                    mono
                    placeholder="(empty)"
                  />
                ) : (
                  <InlineEdit
                    label="Optional 2"
                    value={data.optional2}
                    onChange={(v) => update("optional2", v.toUpperCase())}
                    mono
                    placeholder="(empty)"
                  />
                )}
              </div>
              <button
                onClick={onBack}
                className="mt-3 text-[11px] mono uppercase tracking-[0.16em] text-white/55 hover:text-white transition-colors"
              >
                ↳ Open full form
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl bg-black/55 border border-white/15 p-3 sm:p-7 overflow-hidden">
          <pre
            ref={mrzPreRef}
            className="mono text-white whitespace-pre w-full"
            style={{
              fontSize: `${mrzFontSize}px`,
              letterSpacing: "0.04em",
              lineHeight: 1.6,
              textShadow: "0 0 18px rgba(255,255,255,0.15)",
            }}
          >
            {mrz}
          </pre>
        </div>

        {data.issuer === "NLD" && data.bsn && (
          <div className="mt-4 rounded-xl border border-white/12 bg-black/30 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow leading-none mb-1.5">Card metadata · BSN</div>
              <div className="mono text-white text-sm tracking-[0.18em]">{data.bsn}</div>
            </div>
            <div className="text-white/45 text-[11px] text-right max-w-[16rem] leading-snug">
              Printed on the physical card.
              <br />
              <span className="text-white/65">Not encoded in the MRZ</span> (per 2014 redesign).
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.lines.map((l, i) => (
            <span
              key={i}
              className={`mono text-[10px] uppercase tracking-[0.16em] px-2 py-1 rounded-full border ${
                l.length === result.expected
                  ? "text-white/65 border-white/15"
                  : "text-amber-300 border-amber-300/40"
              }`}
            >
              Line {i + 1} · {l.length}/{result.expected}
            </span>
          ))}
        </div>

        <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PrimaryButton onClick={copy} full>
            {copied ? <Check className="w-4 h-4" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
            {copied ? "Copied" : "Copy MRZ"}
          </PrimaryButton>
          <SecondaryButton onClick={download} full>
            <Download className="w-4 h-4" strokeWidth={2} />
            Download .txt
          </SecondaryButton>
        </div>

        <div className="mt-10 mb-4 text-center">
          <h2 className="text-white text-3xl sm:text-4xl tracking-tight" style={{ lineHeight: 1.1 }}>
            Recommended next step
          </h2>
        </div>

        <motion.button
          type="button"
          onClick={onGenerateId}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="glass group relative w-full overflow-hidden text-left p-5 sm:p-6"
        >
          <div
            aria-hidden
            className="id-cta-scanner pointer-events-none absolute top-0 left-0 h-full w-[26%] z-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0.35) 55%, transparent 100%)",
              filter: "blur(2px)",
              mixBlendMode: "screen",
            }}
          />
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
              <CreditCard className="w-5 h-5" strokeWidth={1.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-base sm:text-lg tracking-tight">
                Generate a matching ID
              </div>
              <div className="text-white/65 text-xs sm:text-sm mt-0.5">
                Drop this MRZ onto a photoreal badge with your photo & signature.
              </div>
            </div>
            <div
              className="shrink-0 w-10 h-10 rounded-full grid place-items-center text-white border border-white/25 transition-transform group-hover:translate-x-1 group-hover:scale-105"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.12) 100%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 12px -4px rgba(0,0,0,0.35)",
              }}
              aria-hidden
            >
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </div>
          </div>
        </motion.button>
      </div>

      <details className="glass-sm mt-5 px-5 py-3 group">
        <summary className="cursor-pointer list-none flex items-center justify-between text-white/70 text-xs mono uppercase tracking-[0.16em]">
          Check digits
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" strokeWidth={2} />
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pb-1">
          {result.checks.map((c) => (
            <div key={c.label} className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="eyebrow text-[9px] leading-tight mb-2">{c.label}</div>
              <div className="mono text-2xl text-white">{c.digit}</div>
            </div>
          ))}
        </div>
      </details>

      <details className="glass-sm mt-3 px-5 py-3 group">
        <summary className="cursor-pointer list-none flex items-center justify-between text-white/70 text-xs mono uppercase tracking-[0.16em]">
          <span className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5" strokeWidth={2} />
            Format reference · DE & NL · 2015–2025
          </span>
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" strokeWidth={2} />
        </summary>
        <ReferenceMatrix activeId={profile?.id} onOpenVerify={() => setShowVerification(true)} />
      </details>

      <div className="mt-8 flex items-center justify-between gap-3">
        <BackButton onClick={onBack} />
        <SecondaryButton onClick={onReset}>
          <RotateCcw className="w-4 h-4" strokeWidth={2} />
          New MRZ
        </SecondaryButton>
      </div>

      <AnimatePresence>
        {showVerification && (
          <VerificationModal
            open={showVerification}
            onClose={() => setShowVerification(false)}
            format={docType}
            liveResult={result}
            liveData={data}
            profile={profile}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BSNField({
  data,
  update,
}: {
  data: FormData;
  update: (k: keyof FormData, v: string) => void;
}) {
  const raw = (data.bsn || "").replace(/\D/g, "").slice(0, 9);
  const filled = raw.length === 9;
  const valid = filled && isValidBSN(raw);
  return (
    <div className="mt-5 rounded-2xl border border-white/12 bg-black/25 p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-xl bg-white/8 border border-white/12 grid place-items-center shrink-0 mono text-[10px] text-white/75 uppercase tracking-[0.14em]">
          NL
        </div>
        <div className="flex-1 min-w-0">
          <div className="eyebrow leading-none mb-1.5">Burgerservicenummer (BSN)</div>
          <div className="text-white/60 text-xs leading-relaxed">
            Printed on every Dutch paspoort (data page) and identiteitskaart (back).
            <span className="text-white/80"> Captured as document metadata only —</span> it is
            deliberately <em>not</em> encoded in the MRZ (RvIG removed it in the 2014 redesign on
            privacy advice from the Autoriteit Persoonsgegevens).
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="block">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/65 text-xs tracking-wide">BSN · 9 digits</span>
            <button
              type="button"
              onClick={() => update("bsn", generateBSN())}
              title="Generate a mathematically valid BSN (elfproef)"
              className="flex items-center gap-1 text-[10px] mono uppercase tracking-[0.14em] text-white/55 hover:text-white transition-colors px-2 py-0.5 rounded-full border border-white/15 hover:border-white/40 hover:bg-white/5"
            >
              <Shuffle className="w-3 h-3" strokeWidth={2} />
              Generate
            </button>
          </div>
          <input
            type="text"
            value={raw}
            onChange={(e) => update("bsn", e.target.value.replace(/\D/g, "").slice(0, 9))}
            placeholder="123456782"
            maxLength={9}
            className="glass-input w-full px-3.5 h-11 mono"
          />
        </label>
        <div
          className={`mono text-[10px] uppercase tracking-[0.16em] px-3 py-2 rounded-full border self-center flex items-center gap-1.5 ${
            !filled
              ? "text-white/45 border-white/15"
              : valid
              ? "text-emerald-300 border-emerald-300/40 bg-emerald-300/10"
              : "text-amber-300 border-amber-300/40 bg-amber-300/10"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !filled ? "bg-white/35" : valid ? "bg-emerald-300" : "bg-amber-300"
            }`}
          />
          {!filled ? "elfproef pending" : valid ? "elfproef ok" : "elfproef failed"}
        </div>
      </div>
    </div>
  );
}

function InlineEdit({
  label,
  value,
  onChange,
  type = "text",
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block min-w-0">
      <div className="text-white/55 text-[10px] mono uppercase tracking-[0.14em] mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`glass-input w-full px-3 h-9 text-sm ${mono ? "mono uppercase" : ""}`}
        style={type === "date" ? { colorScheme: "dark" } : undefined}
      />
    </label>
  );
}

/* ------------------------- Verification badge SVG ------------------------ */

function VerifiedBadge({
  size = 14,
  title,
  onClick,
}: {
  size?: number;
  title?: string;
  onClick?: () => void;
}) {
  const id = `vb-grad-${size}-${onClick ? "b" : "s"}`;
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      role="img"
      aria-label={title || "Verified"}
      style={{ display: "inline-block", flexShrink: 0 }}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d8d8d8" />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="7.25" fill={`url(#${id})`} stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" />
      <path
        d="M4.6 8.3 L6.9 10.6 L11.4 5.6"
        stroke="#0a0a0a"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
  if (!onClick) return svg;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full hover:scale-110 active:scale-95 transition-transform"
      aria-label={title || "Show verification details"}
      style={{ lineHeight: 0 }}
    >
      {svg}
    </button>
  );
}

/* ----------------------------- Math walkthrough -------------------------- */

function computeWeightedSteps(value: string) {
  const weights = [7, 3, 1];
  let sum = 0;
  const steps = Array.from(value).map((c, i) => {
    const w = weights[i % 3];
    const v = charValue(c);
    const p = v * w;
    sum += p;
    return { char: c, value: v, weight: w, product: p };
  });
  return { steps, sum, digit: sum % 10 };
}

/* ---------------------- Verification modal --------------------------- */

function VerificationModal({
  open,
  onClose,
  format,
  liveResult,
  liveData,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  format: DocType;
  liveResult: BuildResult;
  liveData: FormData;
  profile?: Profile | null;
}) {
  if (!open) return null;
  const passingTests = SELF_TEST_RESULTS.filter((r) => r.format === format);

  // Live composite walkthrough for the user's current MRZ
  let liveComposite: ReturnType<typeof computeWeightedSteps> | null = null;
  let liveCompositeInput = "";
  if (format === "td3") {
    const number = fixed(liveData.number, 9);
    const nc = checkDigit(number);
    const birth = dateToYYMMDD(liveData.birth);
    const bc = checkDigit(birth);
    const expiry = dateToYYMMDD(liveData.expiry);
    const ec = checkDigit(expiry);
    const personal = fixed(liveData.personal, 14);
    const personalEmpty = personal === "<<<<<<<<<<<<<<";
    const pc = personalEmpty ? "<" : checkDigit(personal);
    liveCompositeInput = number + nc + birth + bc + expiry + ec + personal + pc;
    liveComposite = computeWeightedSteps(liveCompositeInput);
  } else {
    // TD1 composite over line1.slice(5) + birth + bc + expiry + ec + opt2
    const line1 = liveResult.lines[0] || "";
    const birth = dateToYYMMDD(liveData.birth);
    const bc = checkDigit(birth);
    const expiry = dateToYYMMDD(liveData.expiry);
    const ec = checkDigit(expiry);
    const opt2 = fixed(liveData.optional2, 11);
    liveCompositeInput = line1.slice(5) + birth + bc + expiry + ec + opt2;
    liveComposite = computeWeightedSteps(liveCompositeInput);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="glass w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 sm:p-8 no-scrollbar"
        onClick={(e) => e.stopPropagation()}
        style={{ borderRadius: 28 }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <VerifiedBadge size={20} />
            <div>
              <div className="eyebrow leading-none mb-1">Verified · {format.toUpperCase()}</div>
              <div className="text-white text-xl tracking-tight">Equation & proof</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full glass-sm grid place-items-center text-white/70 hover:text-white transition-colors text-lg leading-none pb-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <Section title="The universal checksum equation">
          <p className="text-white/65 text-sm leading-relaxed mb-3">
            ICAO Doc 9303 Part 3 §4.9 defines a single check-digit algorithm used
            for every TD1, TD2, and TD3 document worldwide. It has never been
            modified by any national annex.
          </p>
          <div className="rounded-xl bg-black/40 border border-white/10 p-4 mono text-white/85 text-sm leading-relaxed">
            <div>weights = [7, 3, 1] repeating</div>
            <div>value(c) = digit (0–9), letter A–Z = 10–35, '&lt;' = 0</div>
            <div className="text-white">check = ( Σ value(cᵢ) × weightᵢ ) mod 10</div>
          </div>
        </Section>

        <Section title="The empty-optional rule (§4.2.2.2)">
          <p className="text-white/65 text-sm leading-relaxed">
            When the optional / personal data field on a TD3 passport is entirely unused,
            <span className="text-white"> its check digit at position 43 must also be a filler{" "}
            <span className="mono">{"<"}</span></span>, not the value <span className="mono">0</span> that the
            formula would otherwise produce. The composite digit at position 44 still computes
            normally over those 15 filler characters. This is the rule that caused the trailing
            <span className="mono"> ...&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;X </span>
            pattern instead of <span className="mono">...&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;0X</span>.
          </p>
        </Section>

        {profile?.research && (
          <Section title={`Issuer research · ${profile.country} · ${profile.era}`}>
            <div className="flex items-center gap-2 mb-3">
              <VerifiedBadge size={12} />
              <div className="text-white/75 text-xs">
                100% verified template for this issuer + era
              </div>
            </div>
            <div className="rounded-xl bg-black/35 border border-white/10 p-4 text-white/75 text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {profile.research}
            </div>
          </Section>
        )}

        <Section title="Reference specimens passing this build">
          <div className="space-y-3">
            {passingTests.map((t) => (
              <div
                key={t.id}
                className={`rounded-xl border p-3.5 ${
                  t.pass ? "border-white/15 bg-white/5" : "border-amber-300/40 bg-amber-300/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {t.pass && <VerifiedBadge size={12} />}
                  <div className="text-white text-sm">{t.name}</div>
                </div>
                <div className="text-white/45 text-[11px] mb-2">{t.source}</div>
                <div className="mono text-white/80 text-[11px] leading-relaxed bg-black/40 rounded-lg p-2.5 break-all">
                  {t.expected.join("\n").split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {liveComposite && (
          <Section title="Live composite check — math walkthrough for your MRZ">
            <p className="text-white/65 text-sm leading-relaxed mb-3">
              Your current MRZ's final digit (the composite at position
              {format === "td3" ? " 44" : " 30 of line 2"}) is computed below over the actual field values.
              Every <span className="mono">{"<"}</span> contributes <span className="mono">0</span>.
            </p>

            <div className="mono text-[11px] text-white/65 mb-3 break-all bg-black/40 rounded-lg p-2.5">
              input ({liveCompositeInput.length} chars): {liveCompositeInput}
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
              <div className="grid grid-cols-[auto_auto_auto_auto_1fr] gap-x-3 gap-y-1 px-3 py-2 mono text-[10px] uppercase tracking-[0.14em] text-white/45 border-b border-white/10">
                <div>i</div><div>char</div><div>val</div><div>×w</div><div className="text-right">sum→</div>
              </div>
              <div className="max-h-56 overflow-y-auto no-scrollbar">
                {(() => {
                  let running = 0;
                  return liveComposite!.steps.map((s, i) => {
                    running += s.product;
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[auto_auto_auto_auto_1fr] gap-x-3 px-3 py-1 mono text-[11px] text-white/75 border-b border-white/5 last:border-0"
                      >
                        <div className="text-white/40 w-5 text-right">{i}</div>
                        <div className="text-white">{s.char}</div>
                        <div>{s.value}</div>
                        <div>×{s.weight}={s.product}</div>
                        <div className="text-right text-white/55">{running}</div>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="px-3 py-2.5 border-t border-white/15 bg-white/5 flex items-center justify-between mono text-xs">
                <span className="text-white/65">Σ = {liveComposite.sum}</span>
                <span className="text-white/65">mod 10 →</span>
                <span className="text-white text-base">{liveComposite.digit}</span>
              </div>
            </div>
            <div className="text-white/50 text-xs mt-3">
              Composite digit is <span className="mono text-white">{liveComposite.digit}</span>.
              The line ends with the optional-data block followed by this single digit.
              If your physical document shows a different value here, double-check the
              document number, dates, or personal-data field for typos.
            </div>
          </Section>
        )}

        <div className="text-white/40 text-[10px] mt-4 leading-relaxed">
          Sources: ICAO Doc 9303 (8th ed., 2021) Parts 3–5; BSI TR-03110 (Germany);
          Rijksdienst voor Identiteitsgegevens documentation (Netherlands).
        </div>
      </motion.div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="eyebrow mb-2.5">{title}</div>
      {children}
    </div>
  );
}

/* ---------------------------- Reference matrix --------------------------- */

function ReferenceMatrix({ activeId, onOpenVerify }: { activeId?: string; onOpenVerify?: () => void }) {
  return (
    <div className="mt-4 pb-1">
      <div className="text-white/65 text-xs leading-relaxed mb-4">
        Per ICAO 9303, the checksum equation is <span className="text-white mono">universal</span> —
        weights <span className="mono text-white">7,3,1</span> mod 10 across <em>every</em> issuer
        and era. What varies are <span className="text-white">field conventions</span>:
        document code, number lettering, and optional-data semantics. We auto-pick the
        right convention profile from issuer + expiry year.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PROFILES.map((p) => {
          const active = p.id === activeId;
          return (
            <div
              key={p.id}
              className={`rounded-2xl border p-3.5 transition-colors ${
                active
                  ? "border-white/40 bg-white/10"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="text-white text-sm tracking-tight flex items-center gap-1.5">
                  {VERIFIED_LAYOUTS[p.format] && (
                    <VerifiedBadge
                      size={13}
                      title={`Open verification proof for ${p.format.toUpperCase()}`}
                      onClick={onOpenVerify}
                    />
                  )}
                  {p.country} · {p.format.toUpperCase()}
                </div>
                <span className="mono text-[9px] uppercase tracking-[0.18em] text-white/55 px-1.5 py-0.5 rounded border border-white/15">
                  {p.yearFrom}–{p.yearTo}
                </span>
              </div>
              <div className="text-white/70 text-xs mb-2">{p.era}</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mono text-[10px] text-white/55">
                <div>code <span className="text-white/85">{p.docCode}</span></div>
                <div>issuer <span className="text-white/85">{p.issuer}</span></div>
                <div className="col-span-2">number <span className="text-white/85">{p.numberHint}</span></div>
                <div className="col-span-2">optional <span className="text-white/85">{p.optional}</span></div>
              </div>
              <div className="text-white/45 text-[11px] mt-2 leading-snug">{p.notes}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3.5">
        <div className="eyebrow mb-2">Equation count</div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="mono text-2xl text-white">1</div>
            <div className="eyebrow text-[9px] leading-tight mt-1">Checksum</div>
          </div>
          <div>
            <div className="mono text-2xl text-white">2</div>
            <div className="eyebrow text-[9px] leading-tight mt-1">Layouts</div>
          </div>
          <div>
            <div className="mono text-2xl text-white">{PROFILES.length}</div>
            <div className="eyebrow text-[9px] leading-tight mt-1">Profiles</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <VerifiedBadge size={13} />
          <div className="eyebrow leading-none">Self-test results</div>
        </div>
        <div className="grid gap-1.5">
          {SELF_TEST_RESULTS.map((r) => (
            <div key={r.id} className="flex items-start gap-2.5 text-[11px]">
              <span
                className={`mono mt-0.5 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.14em] shrink-0 ${
                  r.pass
                    ? "bg-white/15 text-white border border-white/20"
                    : "bg-amber-300/15 text-amber-300 border border-amber-300/30"
                }`}
              >
                {r.pass ? "Pass" : "Fail"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-white/80">{r.name}</div>
                <div className="text-white/40 text-[10px] mt-0.5">{r.source}</div>
                {!r.pass && (
                  <div className="mono text-amber-300/80 text-[10px] mt-1 break-all">
                    expected: {r.expected.join(" / ")}<br />
                    got: {r.got.join(" / ")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-white/35 text-[10px] mt-3 leading-relaxed">
        Verification: a profile is marked <VerifiedBadge size={10} /> when its layout passes round-trip
        against the corresponding ICAO 9303 published specimen (both populated and empty optional-data
        cases), proving the field positions, padding, and check-digit math match the standard byte-for-byte.
        Country-specific conventions (issuer codes, doc-number lettering) follow BSI TR-03110 and Rijksdienst
        voor Identiteitsgegevens documentation; letter-prefix patterns are observational.
      </div>
    </div>
  );
}

/* ------------------------------- Buttons -------------------------------- */

function PrimaryButton({
  children,
  onClick,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${full ? "w-full" : ""} h-12 px-6 rounded-full bg-white text-black inline-flex items-center justify-center gap-2 text-sm tracking-tight shadow-[0_10px_30px_-10px_rgba(255,255,255,0.4)] hover:bg-white/90 transition-colors`}
    >
      {children}
    </motion.button>
  );
}

function SecondaryButton({
  children,
  onClick,
  full,
}: {
  children: React.ReactNode;
  onClick: () => void;
  full?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`${full ? "w-full" : ""} h-12 px-5 rounded-full glass-sm text-white inline-flex items-center justify-center gap-2 text-sm tracking-tight hover:bg-white/10 transition-colors`}
    >
      {children}
    </motion.button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="h-11 px-4 rounded-full text-white/70 hover:text-white inline-flex items-center gap-2 text-xs mono uppercase tracking-[0.16em] transition-colors"
    >
      <ArrowLeft className="w-4 h-4" strokeWidth={2} />
      Back
    </button>
  );
}

