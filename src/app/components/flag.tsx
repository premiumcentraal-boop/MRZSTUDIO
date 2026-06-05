import * as Flags from "country-flag-icons/react/3x2";

/* Map ISO-like tokens used across the app to ISO 3166-1 alpha-2 codes
 * recognized by country-flag-icons. */
const ALIASES: Record<string, string> = {
  D: "DE",
  UK: "GB",
  GBR: "GB",
  USA: "US",
  NLD: "NL",
  DEU: "DE",
  FRA: "FR",
  ESP: "ES",
  ITA: "IT",
  JPN: "JP",
  CAN: "CA",
  UTO: "", // specimen — no flag
  EU: "EU",
};

function resolveCode(input: string): string {
  if (!input) return "";
  const up = input.toUpperCase();
  if (ALIASES[up] !== undefined) return ALIASES[up];
  return up.length === 2 ? up : "";
}

export function Flag({
  code,
  title,
  className = "w-5 h-auto rounded-[2px] shrink-0",
  style,
}: {
  code: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const resolved = resolveCode(code);
  const Component = (Flags as Record<string, React.ComponentType<React.SVGProps<SVGSVGElement> & { title?: string }>>)[resolved];
  if (!Component) {
    return (
      <span
        className={className}
        style={{ display: "inline-block", aspectRatio: "3 / 2", background: "rgba(255,255,255,0.08)", ...style }}
        aria-label={title || "flag"}
      />
    );
  }
  return <Component title={title || resolved} className={className} style={style} />;
}
