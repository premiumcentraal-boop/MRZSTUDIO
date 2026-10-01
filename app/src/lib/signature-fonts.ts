/* Signature-font loader.
 *
 * The actual base64 font payloads live in `signature-fonts-data.ts` and are
 * dynamic-imported on first use. That keeps the heavy bytes (~885KB across 9
 * fonts) out of the initial bundle — the landing route never has to download
 * them, and the import is fired lazily when the signature generator mounts.
 *
 * Font activation is still async even though the bytes are bundled (data
 * URI -> FontFace.load()), so callers must await `waitForFontReady` before
 * drawing canvas text. */

export type BundledFont = {
  family: string;
  url: string;
  format: "truetype" | "opentype";
};

let injected = false;
let loadPromise: Promise<void> | null = null;
let dataPromise: Promise<{ bundledSignatureFonts: BundledFont[] }> | null = null;

function getData() {
  if (!dataPromise) {
    dataPromise = import("./signature-fonts-data");
  }
  return dataPromise;
}

async function injectAndLoad(): Promise<void> {
  if (typeof document === "undefined") return;
  const { bundledSignatureFonts } = await getData();

  const css = bundledSignatureFonts
    .map(
      (f) =>
        `@font-face { font-family: '${f.family}'; src: url('${f.url}') format('${f.format}'); font-display: swap; }`,
    )
    .join("\n");
  const style = document.createElement("style");
  style.setAttribute("data-bundled-signature-fonts", "true");
  style.textContent = css;
  document.head.appendChild(style);

  const fonts = (document as any).fonts;
  const faceLoads: Promise<unknown>[] = [];

  if (fonts && typeof FontFace !== "undefined") {
    bundledSignatureFonts.forEach((f) => {
      try {
        const face = new FontFace(
          f.family,
          `url(${f.url}) format('${f.format}')`,
          { display: "swap" },
        );
        fonts.add(face);
        const p = face.load().then(
          () => {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.log(
                `[signature-fonts] ${f.family} loaded (status=${face.status})`,
              );
            }
          },
          (err) => {
            if (import.meta.env?.DEV) {
              // eslint-disable-next-line no-console
              console.warn(
                `[signature-fonts] failed to load ${f.family}`,
                err,
              );
            }
          },
        );
        faceLoads.push(p);
      } catch (err) {
        if (import.meta.env?.DEV) {
          // eslint-disable-next-line no-console
          console.warn(`[signature-fonts] FontFace ctor threw for ${f.family}`, err);
        }
      }
    });
  }

  await Promise.all(faceLoads);
  if (fonts?.ready) await fonts.ready;
}

export function ensureBundledFontsLoaded(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!injected) {
    injected = true;
    loadPromise = injectAndLoad();
  }
  return loadPromise ?? Promise.resolve();
}

/** Wait for one specific bundled font to be usable at the given px size. */
export async function waitForFontReady(family: string, sizePx = 96): Promise<void> {
  if (typeof document === "undefined") return;
  await ensureBundledFontsLoaded();
  const fonts = (document as any).fonts;
  if (fonts?.load) {
    try {
      await fonts.load(`${sizePx}px "${family}"`);
      await fonts.ready;
    } catch {
      // fall through
    }
  }
}
