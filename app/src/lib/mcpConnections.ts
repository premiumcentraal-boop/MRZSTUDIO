import { API_BASE, type LocalHealth } from "./localApi";

export type McpConnector = {
  id: string;
  display_name: string;
  enabled: boolean;
  glass_kind: "local_stdio" | "remote_http";
  command: string;
  args: string[];
  http_url: string;
  notes: string;
  auto_signature?: { mode: "first_name_only"; width: 420; height: 123 };
};
export type McpSettings = {
  version: 1;
  studio: { api_base: string; ui_base: string };
  connectors: McpConnector[];
};
export type SavedSettings = { data: McpSettings; etag: string };
export class SettingsRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}
async function settingsRequest(method: "GET" | "PUT", saved?: SavedSettings): Promise<SavedSettings> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    // This address stays independent of the editable connector target.
    const res = await fetch(`${API_BASE}/api/mcp-connections`, {
      method, signal: controller.signal, cache: "no-store",
      headers: saved ? { "Content-Type": "application/json", "If-Match": saved.etag } : undefined,
      body: saved ? JSON.stringify(saved.data) : undefined,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new SettingsRequestError(body?.error || `Settings request failed (${res.status}).`, res.status, body?.code);
    const etag = res.headers.get("etag");
    if (!etag || body?.version !== 1 || !body.studio || !Array.isArray(body.connectors)) throw new Error("The settings API returned an unexpected response. Check the local API version.");
    return { data: body, etag };
  } catch (err) {
    if (err instanceof SettingsRequestError) throw err;
    if (controller.signal.aborted) throw new Error("The local settings API did not respond within 8 seconds.");
    if (err instanceof TypeError) throw new Error("Cannot reach the local settings API. Start MRZ Studio Local and try again.");
    throw err;
  } finally { window.clearTimeout(timeout); }
}
export const getMcpConnections = () => settingsRequest("GET");
export const putMcpConnections = (saved: SavedSettings) => settingsRequest("PUT", saved);

export function endpoint(value: string, label: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error(`${label}: enter a complete http or https address.`); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(`${label}: use http or https without credentials, query parameters, or fragments.`);
  return url.href.replace(/\/$/, "");
}
export async function testStudioHealth(base: string, signal: AbortSignal): Promise<LocalHealth> {
  const url = endpoint(base, "Studio API address");
  const res = await fetch(`${url}/api/health`, { signal, cache: "no-store", credentials: "omit" });
  if (!res.ok) throw new Error(`Health request returned HTTP ${res.status}.`);
  const body = await res.json();
  if (body?.mode !== "local" || typeof body.ok !== "boolean" || typeof body.dryRun !== "boolean" || typeof body.worker?.online !== "boolean" || typeof body.photoshop?.found !== "boolean" || typeof body.template?.present !== "boolean") throw new Error("This address did not return a compatible MRZ Studio health response.");
  return body;
}
export function glassRecipe(config: McpSettings): string {
  return JSON.stringify({ mcpServers: Object.fromEntries(config.connectors.filter(c => c.enabled && c.glass_kind === "local_stdio").map(c => [c.id, { command: c.command, args: c.args }])) }, null, 2);
}
