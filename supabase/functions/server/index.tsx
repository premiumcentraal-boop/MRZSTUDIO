import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get("/make-server-11021192/health", (c) => c.json({ status: "ok" }));

/* ============================================================================
 * KVK lookup via OpenKvK / Overheid.io v3
 *
 * Spec: src/imports/pasted_text/kvk-validator-provider.ts
 * Key is read from Deno env (`openkvk_api_key`). Edge function code never
 * ships to the browser, so the secret stays server-side.
 * ========================================================================== */

const OPENKVK_BASE = "https://api.overheid.io/v3/openkvk";
const CACHE_FOUND_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_NOTFOUND_TTL_MS = 60 * 60 * 1000;
const PROVIDER_TIMEOUT_MS = 8000;

function normalizeKvk(raw: string): string {
  return (raw || "").replace(/[\s.\-_]/g, "");
}

function validateKvkFormat(value: string) {
  const normalized = normalizeKvk(value);
  const lengthOk = normalized.length === 8;
  const digitsOk = /^\d+$/.test(normalized);
  return {
    valid: lengthOk && digitsOk,
    normalized,
    checks: [
      {
        name: "length",
        passed: lengthOk,
        details: lengthOk
          ? "KVK number has 8 digits."
          : `KVK number must be 8 digits (got ${normalized.length}).`,
      },
      {
        name: "digits_only",
        passed: digitsOk,
        details: digitsOk
          ? "KVK number contains only digits."
          : "KVK number must contain only digits.",
      },
    ],
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function mapOpenKvkCompany(raw: any, detail: any | null) {
  const merged = { ...(raw || {}), ...(detail || {}) };
  const addr = merged?.adres ?? merged?.bezoekadres ?? null;
  const activities = Array.isArray(merged?.activiteiten)
    ? merged.activiteiten.map((a: any) => ({
        sbiCode: a?.sbi ?? a?.code ?? null,
        sbiDescription: a?.omschrijving ?? null,
        isMainActivity: a?.hoofdactiviteit ?? null,
      }))
    : [];
  return {
    kvkNumber: String(merged?.kvknummer ?? merged?.dossiernummer ?? ""),
    branchNumber: merged?.vestigingsnummer ?? null,
    name: merged?.handelsnaam ?? merged?.naam ?? null,
    statutoryName: merged?.statutaireNaam ?? null,
    tradeNames: merged?.handelsnamen ?? [],
    currentTradeNames: merged?.actueleHandelsnamen ?? [],
    legalForm: merged?.rechtsvorm ?? null,
    legalFormCode: merged?.rechtsvormCode ?? null,
    active: merged?.actief ?? null,
    registrationType: merged?.type ?? null,
    registrationDate: merged?.datumVestiging ?? merged?.datumInschrijving ?? null,
    website: merged?.internetadres ?? merged?.website ?? null,
    activities,
    address: addr
      ? {
          street: addr?.straat ?? null,
          houseNumber: addr?.huisnummer ?? null,
          houseNumberAddition: addr?.huisnummertoevoeging ?? null,
          postalCode: addr?.postcode ?? null,
          city: addr?.plaats ?? null,
          municipality: addr?.gemeente ?? null,
          province: addr?.provincie ?? null,
          country: addr?.land ?? "NL",
          fullAddress: [addr?.straat, addr?.huisnummer, addr?.postcode, addr?.plaats]
            .filter(Boolean)
            .join(" "),
          coordinates:
            addr?.latitude != null && addr?.longitude != null
              ? { lat: Number(addr.latitude), lon: Number(addr.longitude) }
              : null,
        }
      : null,
    mailingRestricted: merged?.nonMailingIndicatie ?? null,
    source: {
      provider: "openkvk" as const,
      sourceUrl: merged?._links?.self?.href ?? null,
      retrievedAt: new Date().toISOString(),
      updatedAt: merged?.dossierAfgesloten ?? null,
      confidence: "public-data-match" as const,
    },
  };
}

app.get("/make-server-11021192/kvk/lookup", async (c) => {
  const input = c.req.query("kvk") ?? "";
  const fmt = validateKvkFormat(input);

  if (!fmt.valid) {
    return c.json(
      {
        ok: false,
        input,
        normalized: null,
        formatValidation: { valid: false, checks: fmt.checks },
        error: "Invalid KVK number format.",
      },
      400,
    );
  }

  const apiKey = Deno.env.get("openkvk_api_key");
  if (!apiKey) {
    return c.json({
      ok: true,
      input,
      normalized: fmt.normalized,
      formatValidation: { valid: true, checks: fmt.checks },
      found: false,
      company: null,
      matches: [],
      source: { provider: "local_format_only", confidence: "format-valid-only" },
      message:
        "API credentials are not configured. Local validation is still available.",
    });
  }

  const cacheKey = `kvk:lookup:${fmt.normalized}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return c.json(cached.payload);
    }
  } catch (e) {
    console.log(`KVK cache read failed for ${fmt.normalized}: ${e}`);
  }

  try {
    const searchUrl = `${OPENKVK_BASE}?query=${encodeURIComponent(
      fmt.normalized,
    )}&queryfields[]=kvknummer`;
    const searchRes = await fetchWithTimeout(
      searchUrl,
      { headers: { "ovio-api-key": apiKey, Accept: "application/json" } },
      PROVIDER_TIMEOUT_MS,
    );

    if (searchRes.status === 401 || searchRes.status === 403) {
      console.log(`OpenKvK auth error ${searchRes.status} for ${fmt.normalized}`);
      return c.json(
        {
          ok: false,
          input,
          normalized: fmt.normalized,
          formatValidation: { valid: true, checks: fmt.checks },
          error: "The lookup provider rejected the configured API key.",
        },
        502,
      );
    }
    if (searchRes.status === 429) {
      return c.json(
        {
          ok: false,
          input,
          normalized: fmt.normalized,
          formatValidation: { valid: true, checks: fmt.checks },
          error: "Lookup provider rate limit reached. Try again shortly.",
        },
        429,
      );
    }
    if (!searchRes.ok) {
      console.log(`OpenKvK search failed ${searchRes.status} for ${fmt.normalized}`);
      return c.json(
        {
          ok: false,
          input,
          normalized: fmt.normalized,
          formatValidation: { valid: true, checks: fmt.checks },
          error: "The lookup provider is temporarily unavailable.",
        },
        502,
      );
    }

    const searchJson: any = await searchRes.json();
    const results: any[] = searchJson?._embedded?.bedrijf ?? searchJson?.bedrijf ?? [];

    if (!Array.isArray(results) || results.length === 0) {
      const payload = {
        ok: true,
        input,
        normalized: fmt.normalized,
        formatValidation: { valid: true, checks: fmt.checks },
        found: false,
        company: null,
        matches: [],
        source: { provider: "openkvk", confidence: "not-found" },
        message:
          "The KVK number format is valid, but no company was found in the configured lookup source.",
        disclaimer:
          "This lookup uses public/open company data and is not a legally certified KVK extract. For legally binding information, use KVK.nl.",
      };
      await kv.set(cacheKey, {
        expiresAt: Date.now() + CACHE_NOTFOUND_TTL_MS,
        payload,
      });
      return c.json(payload);
    }

    const exact = results.filter((r) => String(r?.kvknummer ?? "") === fmt.normalized);
    const pool = exact.length ? exact : results;
    const primary =
      pool.find((r) => r?.hoofdvestiging === true || r?.type === "hoofdvestiging") ??
      pool[0];

    let detail: any = null;
    const detailHref = primary?._links?.self?.href;
    if (detailHref) {
      try {
        const detailRes = await fetchWithTimeout(
          detailHref,
          { headers: { "ovio-api-key": apiKey, Accept: "application/json" } },
          PROVIDER_TIMEOUT_MS,
        );
        if (detailRes.ok) detail = await detailRes.json();
      } catch (e) {
        console.log(`OpenKvK detail fetch failed for ${fmt.normalized}: ${e}`);
      }
    }

    const company = mapOpenKvkCompany(primary, detail);
    const matches = pool.slice(0, 10).map((r) => ({
      kvkNumber: String(r?.kvknummer ?? ""),
      branchNumber: r?.vestigingsnummer ?? null,
      name: r?.handelsnaam ?? r?.naam ?? null,
      city: r?.adres?.plaats ?? null,
      isMain: r?.hoofdvestiging ?? null,
    }));

    const payload = {
      ok: true,
      input,
      normalized: fmt.normalized,
      formatValidation: { valid: true, checks: fmt.checks },
      found: true,
      company,
      matches,
      disclaimer:
        "This lookup uses public/open company data and is not a legally certified KVK extract. For legally binding information, use KVK.nl.",
    };
    await kv.set(cacheKey, {
      expiresAt: Date.now() + CACHE_FOUND_TTL_MS,
      payload,
    });
    return c.json(payload);
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    console.log(
      `KVK lookup error for ${fmt.normalized}: ${aborted ? "timeout" : e}`,
    );
    return c.json(
      {
        ok: false,
        input,
        normalized: fmt.normalized,
        formatValidation: { valid: true, checks: fmt.checks },
        error: aborted
          ? "The lookup provider timed out."
          : "The lookup provider is temporarily unavailable.",
      },
      502,
    );
  }
});

Deno.serve(app.fetch);
