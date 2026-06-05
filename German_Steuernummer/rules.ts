import {
  ELSTER_STEUERNUMMER_SOURCE,
  type BerlinVariantRequest,
  type Bundesland,
  type SteuernummerMethod,
  type SteuernummerRule,
} from "./types.ts";

export const BUNDESLANDS: readonly Bundesland[] = [
  "baden_wuerttemberg",
  "bayern",
  "berlin",
  "brandenburg",
  "bremen",
  "hamburg",
  "hessen",
  "mecklenburg_vorpommern",
  "niedersachsen",
  "nordrhein_westfalen",
  "rheinland_pfalz",
  "saarland",
  "sachsen",
  "sachsen_anhalt",
  "schleswig_holstein",
  "thueringen",
] as const;

export const TWOER_SUMMANDS = [0, 0, 9, 8, 0, 7, 6, 5, 4, 3, 2, 1] as const;
export const TWOER_FACTORS = [0, 0, 512, 256, 0, 128, 64, 32, 16, 8, 4, 2] as const;
export const RHEINLAND_PFALZ_FACTORS = [0, 0, 1, 2, 0, 1, 2, 1, 2, 1, 2, 1] as const;
export const FACTORS_11ER_BAYERN_STYLE = [0, 5, 4, 3, 0, 2, 7, 6, 5, 4, 3, 2] as const;
export const FACTORS_11ER_BREMEN_HAMBURG = [0, 0, 4, 3, 0, 2, 7, 6, 5, 4, 3, 2] as const;
export const FACTORS_11ER_NIEDERSACHSEN = [0, 0, 2, 9, 0, 8, 7, 6, 5, 4, 3, 2] as const;
export const FACTORS_BERLIN_A = [0, 0, 0, 0, 0, 7, 6, 5, 8, 4, 3, 2] as const;
export const FACTORS_BERLIN_B = [0, 0, 2, 9, 0, 8, 7, 6, 5, 4, 3, 2] as const;
export const FACTORS_NRW = [0, 3, 2, 1, 0, 7, 6, 5, 4, 3, 2, 1] as const;

const SOURCE_REFS = [ELSTER_STEUERNUMMER_SOURCE] as const;

export const STEUERNUMMER_RULES: readonly SteuernummerRule[] = [
  { bundesland: "baden_wuerttemberg", displayName: "Baden-Wuerttemberg", localFormat: "FFBBB/UUUUP", elsterPattern: "28FF0BBBUUUUP", bufaPrefix: "28", method: "2er", sourceRefs: SOURCE_REFS },
  { bundesland: "bayern", displayName: "Bayern", localFormat: "FFF/BBB/UUUUP", elsterPattern: "9FFF0BBBUUUUP", bufaPrefix: "9", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
  { bundesland: "berlin", displayName: "Berlin", localFormat: "FF/BBB/UUUUP", elsterPattern: "11FF0BBBUUUUP", bufaPrefix: "11", method: "berlin", sourceRefs: SOURCE_REFS },
  { bundesland: "brandenburg", displayName: "Brandenburg", localFormat: "FFF/BBB/UUUUP", elsterPattern: "3FFF0BBBUUUUP", bufaPrefix: "3", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
  { bundesland: "bremen", displayName: "Bremen", localFormat: "FF BBB UUUUP", elsterPattern: "24FF0BBBUUUUP", bufaPrefix: "24", method: "11er", factors: FACTORS_11ER_BREMEN_HAMBURG, sourceRefs: SOURCE_REFS },
  { bundesland: "hamburg", displayName: "Hamburg", localFormat: "FF/BBB/UUUUP", elsterPattern: "22FF0BBBUUUUP", bufaPrefix: "22", method: "11er", factors: FACTORS_11ER_BREMEN_HAMBURG, sourceRefs: SOURCE_REFS },
  { bundesland: "hessen", displayName: "Hessen", localFormat: "0FF BBB UUUUP", elsterPattern: "26FF0BBBUUUUP", bufaPrefix: "26", method: "2er", sourceRefs: SOURCE_REFS },
  { bundesland: "mecklenburg_vorpommern", displayName: "Mecklenburg-Vorpommern", localFormat: "FFF/BBB/UUUUP", elsterPattern: "4FFF0BBBUUUUP", bufaPrefix: "4", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
  { bundesland: "niedersachsen", displayName: "Niedersachsen", localFormat: "FF/BBB/UUUUP", elsterPattern: "23FF0BBBUUUUP", bufaPrefix: "23", method: "11er", factors: FACTORS_11ER_NIEDERSACHSEN, sourceRefs: SOURCE_REFS },
  { bundesland: "nordrhein_westfalen", displayName: "Nordrhein-Westfalen", localFormat: "FFF/BBBB/UUUP", elsterPattern: "5FFF0BBBBUUUP", bufaPrefix: "5", method: "11er_nrw_remainder", factors: FACTORS_NRW, sourceRefs: SOURCE_REFS },
  { bundesland: "rheinland_pfalz", displayName: "Rheinland-Pfalz", localFormat: "FF/BBB/UUUUP", elsterPattern: "27FF0BBBUUUUP", bufaPrefix: "27", method: "11er_modified_rheinland_pfalz", factors: RHEINLAND_PFALZ_FACTORS, sourceRefs: SOURCE_REFS },
  { bundesland: "saarland", displayName: "Saarland", localFormat: "FFF/BBB/UUUUP", elsterPattern: "1FFF0BBBUUUUP", bufaPrefix: "1", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
  { bundesland: "sachsen", displayName: "Sachsen", localFormat: "FFF/BBB/UUUUP", elsterPattern: "3FFF0BBBUUUUP", bufaPrefix: "3", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
  { bundesland: "sachsen_anhalt", displayName: "Sachsen-Anhalt", localFormat: "FFF/BBB/UUUUP", elsterPattern: "3FFF0BBBUUUUP", bufaPrefix: "3", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
  { bundesland: "schleswig_holstein", displayName: "Schleswig-Holstein", localFormat: "FF/BBB/UUUUP", elsterPattern: "21FF0BBBUUUUP", bufaPrefix: "21", method: "2er", sourceRefs: SOURCE_REFS },
  { bundesland: "thueringen", displayName: "Thueringen", localFormat: "FFF/BBB/UUUUP", elsterPattern: "4FFF0BBBUUUUP", bufaPrefix: "4", method: "11er", factors: FACTORS_11ER_BAYERN_STYLE, minBezirk: 100, sourceRefs: SOURCE_REFS },
] as const;

export const RULE_BY_BUNDESLAND: Record<Bundesland, SteuernummerRule> = Object.fromEntries(
  STEUERNUMMER_RULES.map((rule) => [rule.bundesland, rule]),
) as Record<Bundesland, SteuernummerRule>;

export const SYNTHETIC_DEFAULT_BUFA: Record<Bundesland, string> = {
  baden_wuerttemberg: "2801",
  bayern: "9001",
  berlin: "1113",
  brandenburg: "3001",
  bremen: "2401",
  hamburg: "2201",
  hessen: "2601",
  mecklenburg_vorpommern: "4001",
  niedersachsen: "2301",
  nordrhein_westfalen: "5001",
  rheinland_pfalz: "2701",
  saarland: "1001",
  sachsen: "3201",
  sachsen_anhalt: "3101",
  schleswig_holstein: "2101",
  thueringen: "4101",
};

const SYNTHETIC_BUFA_TO_BUNDESLAND = Object.fromEntries(
  Object.entries(SYNTHETIC_DEFAULT_BUFA).map(([bundesland, bufa]) => [bufa, bundesland]),
) as Record<string, Bundesland>;

function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

function berlinBException(bufa: string, bezirk: number): boolean {
  if (["1113", "1114", "1117", "1120", "1121", "1123", "1124", "1125"].includes(bufa)) {
    return inRange(bezirk, 201, 693);
  }
  if (bufa === "1116") {
    return inRange(bezirk, 1, 29) || inRange(bezirk, 201, 693) || inRange(bezirk, 875, 899);
  }
  if (bufa === "1119") {
    return inRange(bezirk, 201, 639) || bezirk === 680 || bezirk === 684;
  }
  return false;
}

const BERLIN_A_DEFAULT = new Set(["1113", "1114", "1116", "1117", "1119", "1120", "1121", "1123", "1124", "1125", "1127", "1129", "1130"]);
const BERLIN_B_DEFAULT = new Set(["1115", "1118", "1131", "1132", "1133", "1134", "1135", "1136", "1137", "1138", "1194", "1195", "1196", "1197", "1198"]);

export function getRule(bundesland: Bundesland): SteuernummerRule {
  return RULE_BY_BUNDESLAND[bundesland];
}

export function isKnownBundesland(value: string): value is Bundesland {
  return BUNDESLANDS.includes(value as Bundesland);
}

export function detectBerlinMethod(bufa: string, bezirk: string): Extract<SteuernummerMethod, "berlin_a" | "berlin_b"> {
  const bezirkNumber = Number(bezirk);
  if (berlinBException(bufa, bezirkNumber)) return "berlin_b";
  if (BERLIN_A_DEFAULT.has(bufa)) return "berlin_a";
  if (BERLIN_B_DEFAULT.has(bufa)) return "berlin_b";
  return "berlin_b";
}

export function berlinGenerationBezirk(variant?: BerlinVariantRequest): string {
  return variant === "B" ? "201" : "101";
}

export function detectBundeslandCandidatesFromBufa(bufa: string): Bundesland[] {
  if (SYNTHETIC_BUFA_TO_BUNDESLAND[bufa]) return [SYNTHETIC_BUFA_TO_BUNDESLAND[bufa]];
  if (bufa.startsWith("28")) return ["baden_wuerttemberg"];
  if (bufa.startsWith("9")) return ["bayern"];
  if (bufa.startsWith("11")) return ["berlin"];
  if (bufa.startsWith("24")) return ["bremen"];
  if (bufa.startsWith("22")) return ["hamburg"];
  if (bufa.startsWith("26")) return ["hessen"];
  if (bufa.startsWith("23")) return ["niedersachsen"];
  if (bufa.startsWith("5")) return ["nordrhein_westfalen"];
  if (bufa.startsWith("27")) return ["rheinland_pfalz"];
  if (bufa.startsWith("21")) return ["schleswig_holstein"];
  if (bufa.startsWith("3")) return ["brandenburg", "sachsen", "sachsen_anhalt"];
  if (bufa.startsWith("4")) return ["mecklenburg_vorpommern", "thueringen"];
  if (bufa.startsWith("1")) return ["saarland"];
  return [];
}

