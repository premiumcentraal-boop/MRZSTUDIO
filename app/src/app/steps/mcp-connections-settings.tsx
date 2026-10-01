import { useEffect, useRef, useState, type ReactNode } from "react";
import { useBlocker } from "react-router";
import { Check, Copy, Loader2, Plus, Plug, Save, Trash2 } from "lucide-react";
import { Field } from "../components/field";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { endpoint, getMcpConnections, glassRecipe, putMcpConnections, testStudioHealth, type McpConnector, type McpSettings, type SavedSettings } from "../../lib/mcpConnections";
import type { LocalHealth } from "../../lib/localApi";

type Draft = Omit<McpSettings, "connectors"> & { connectors: (McpConnector & { key: string; argsText: string })[] };
const draftOf = (data: McpSettings): Draft => ({ ...data, studio: { ...data.studio }, connectors: data.connectors.map(c => ({ ...c, key: crypto.randomUUID(), argsText: JSON.stringify(c.args, null, 2) })) });
function configOf(draft: Draft): McpSettings {
  const ids = new Set<string>();
  return {
    version: 1, studio: { api_base: endpoint(draft.studio.api_base, "Studio API"), ui_base: endpoint(draft.studio.ui_base, "Studio UI") },
    connectors: draft.connectors.map(({ key, argsText, ...c }) => {
      const id = c.id.trim();
      if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id) || ids.has(id)) throw new Error("Use unique connector IDs: lowercase letters, numbers, - or _.");
      ids.add(id);
      if (!c.display_name.trim()) throw new Error(`Give ${id} a display name.`);
      let args;
      try { args = JSON.parse(argsText); } catch { throw new Error(`${c.display_name}: arguments must be a JSON array of strings. Backslashes in JSON paths must be doubled.`); }
      if (!Array.isArray(args) || args.some(a => typeof a !== "string")) throw new Error(`${c.display_name}: arguments must be a JSON array of strings.`);
      if (args.some(a => /[\x00-\x1f\x7f]/.test(a))) throw new Error(`${c.display_name}: arguments cannot contain control characters. Double backslashes in JSON paths.`);
      if (c.glass_kind === "local_stdio" && !c.command.trim()) throw new Error(`${c.display_name}: enter the program command.`);
      return { ...c, id, display_name: c.display_name.trim(), command: c.command.trim(), args, http_url: c.http_url.trim() || c.glass_kind === "remote_http" ? endpoint(c.http_url, `${c.display_name} MCP URL`) : "" };
    }),
  };
}
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40 disabled:cursor-not-allowed";
function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="glass min-w-0 p-6 sm:p-8"><h2 className="text-xl text-white tracking-tight">{title}</h2>{description && <p className="mt-2 text-sm text-white/65 leading-relaxed">{description}</p>}<div className="mt-6 space-y-5">{children}</div></section>;
}
function StateChip({ good, children }: { good: boolean; children: ReactNode }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs ${good ? "border-emerald-300/30 text-emerald-200 bg-emerald-300/10" : "border-amber-300/30 text-amber-200 bg-amber-300/10"}`}>{children}</span>;
}

export default function McpConnectionsSettings() {
  const [saved, setSaved] = useState<SavedSettings | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [health, setHealth] = useState<{ data?: LocalHealth; error?: string; url: string; at: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const healthRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  function accept(value: SavedSettings) {
    const next = draftOf(value.data); setSaved(value); setDraft(next); setBaseline(JSON.stringify(next));
  }
  async function load() {
    setLoading(true); setError(""); setNotice("");
    try { const value = await getMcpConnections(); if (mounted.current) accept(value); }
    catch (err) { if (mounted.current) setError((err as Error).message); }
    finally { if (mounted.current) setLoading(false); }
  }
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; healthRequest.current?.abort(); }; }, []);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", leave); return () => window.removeEventListener("beforeunload", leave);
  }, [dirty]);
  function editConnector(key: string, values: Partial<Draft["connectors"][number]>) {
    setDraft(d => d && ({ ...d, connectors: d.connectors.map(c => c.key === key ? { ...c, ...values } : c) })); setNotice("");
  }
  async function save() {
    if (!draft || !saved) return;
    setBusy(true); setError(""); setNotice("");
    try { const result = await putMcpConnections({ data: configOf(draft), etag: saved.etag }); accept(result); setNotice("Settings saved on this PC."); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function checkHealth() {
    if (!draft) return;
    healthRequest.current?.abort();
    const controller = new AbortController(); healthRequest.current = controller;
    const url = draft.studio.api_base;
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    setChecking(true); setHealth(null);
    try { const data = await testStudioHealth(url, controller.signal); if (mounted.current && healthRequest.current === controller) setHealth({ data, url, at: new Date().toLocaleTimeString() }); }
    catch (err) {
      if (mounted.current && healthRequest.current === controller) setHealth({ url, at: new Date().toLocaleTimeString(), error: controller.signal.aborted ? "No response within 5 seconds." : err instanceof TypeError ? "Cannot reach this address from your browser. Check that the API is running and permits the local Studio UI." : (err as Error).message });
    } finally { window.clearTimeout(timeout); if (mounted.current && healthRequest.current === controller) setChecking(false); }
  }
  async function copy(value: string) {
    setError("");
    try { await navigator.clipboard.writeText(value); setNotice("Copied to clipboard."); }
    catch { setError("Clipboard access was unavailable. Select the recipe below and copy it manually."); }
  }
  function discard() { if (saved) accept(saved); setError(""); setNotice("Unsaved edits discarded."); }

  return <div className="space-y-6 pb-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="flex items-center gap-3"><Plug className="h-6 w-6 text-white/70" /><h1 className="text-3xl sm:text-4xl tracking-tight text-white">MCP connections</h1></div><p className="mt-3 max-w-2xl text-white/60 leading-relaxed">Manage this Studio’s connection details and prepare them for Cyclone Glass.</p></div>
      <span className="glass-sm px-3 py-2 text-xs text-white/65">Stored on this PC</span>
    </div>
    {error && <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-950/40 p-4 text-sm text-rose-100">{error}<button className={`${button} ml-3 mt-2`} onClick={() => { if (!dirty || window.confirm("Discard your edits and reload the saved settings?")) void load(); }}>Reload saved settings</button></div>}
    {notice && <p role="status" className="text-sm text-emerald-200 flex gap-2 items-center"><Check className="w-4 h-4" />{notice}</p>}
    {loading && <p role="status" className="text-white/70 flex gap-2 items-center"><Loader2 className="animate-spin w-4 h-4" />Loading settings…</p>}
    {draft && saved && <>
      <fieldset disabled={busy || loading} className="space-y-6 min-w-0">
        <Panel title="Studio endpoint" description="These are the addresses a connector should use. Saving them does not change the API’s port, move this website, or restart a program.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Studio API address" value={draft.studio.api_base} onChange={api_base => { healthRequest.current?.abort(); healthRequest.current = null; setChecking(false); setHealth(null); setDraft({ ...draft, studio: { ...draft.studio, api_base } }); setNotice(""); }} />
            <Field label="Studio UI address" value={draft.studio.ui_base} onChange={ui_base => { setDraft({ ...draft, studio: { ...draft.studio, ui_base } }); setNotice(""); }} />
          </div>
          <div className="flex flex-wrap items-center gap-3"><button type="button" className={button} onClick={() => void checkHealth()} disabled={checking}>{checking && <Loader2 className="w-4 h-4 animate-spin" />}{checking ? "Checking…" : "Check health"}</button><span className="text-xs text-white/55">Tests the address entered above, including unsaved changes.</span></div>
          {health && <div role="status" className="rounded-2xl bg-black/25 border border-white/10 p-4 space-y-3">
            <p className="text-xs text-white/55 break-all">{health.url} · checked {health.at}</p>
            {health.error ? <p className="text-amber-200 text-sm">{health.error}</p> : health.data && <>
              <div className="flex flex-wrap gap-2">
                <StateChip good={health.data.ok}>API {health.data.ok ? "reachable" : "not ready"}</StateChip>
                <StateChip good={health.data.worker.online}>Worker {health.data.worker.online ? "online" : "offline"}</StateChip>
                <StateChip good={health.data.photoshop.found}>Photoshop {health.data.photoshop.found ? "found" : "missing"}</StateChip>
                <StateChip good={health.data.template.present}>Template {health.data.template.present ? "found" : "missing"}</StateChip>
                <StateChip good={!health.data.dryRun}>{health.data.dryRun ? "Dry run · placeholder output" : "Real render mode"}</StateChip>
              </div>
              <p className="text-sm text-white/75">{health.data.dryRun ? "Dry-run mode is active. This does not verify real badge generation." : health.data.ok && health.data.worker.online && health.data.photoshop.found && health.data.template.present ? "Generation prerequisites are available. No badge job was started." : "Generation prerequisites are incomplete. Check the statuses above."}</p>
            </>}
          </div>}
        </Panel>
        <Panel title="Connectors" description="Save recipes here, then import them into Glass. Enabling a recipe here does not start it or grant it permission in Glass.">
          {draft.connectors.length === 0 && <p className="text-white/60 text-sm">No connectors yet. Add a connection below.</p>}
          {draft.connectors.map((c, index) => <article key={c.key} aria-label={`Connector ${index + 1}`} className="rounded-2xl border border-white/15 bg-black/20 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg text-white">{c.display_name || "New connector"}</h3><div className="flex items-center gap-4"><label className="flex gap-2 items-center text-sm text-white/75"><input type="checkbox" className="accent-white" checked={c.enabled} onChange={e => editConnector(c.key, { enabled: e.target.checked })} />Enabled</label><button type="button" className={button} aria-label={`Remove ${c.display_name || "connector"}`} onClick={() => { setDraft({ ...draft, connectors: draft.connectors.filter(x => x.key !== c.key) }); setNotice("Connector removed from draft. Discard restores it until you save."); }}><Trash2 className="w-4 h-4" />Remove</button></div></div>
            <div className="grid gap-4 md:grid-cols-2"><Field label="Connector ID" value={c.id} maxLength={64} onChange={id => editConnector(c.key, { id })} /><Field label="Display name" value={c.display_name} maxLength={100} onChange={display_name => editConnector(c.key, { display_name })} /></div>
            <label className="block text-sm text-white/65">Connection type<select className="glass-input mt-2 w-full h-11 px-3" value={c.glass_kind} onChange={e => editConnector(c.key, { glass_kind: e.target.value as McpConnector["glass_kind"] })}><option value="local_stdio">Program on this PC (stdio)</option><option value="remote_http">MCP server address (HTTP)</option></select></label>
            {c.glass_kind === "local_stdio" ? <><Field label="Program command" value={c.command} maxLength={200} onChange={command => editConnector(c.key, { command })} /><label className="block text-sm text-white/65">Arguments (JSON array)<textarea spellCheck={false} className="glass-input mt-2 w-full min-h-28 p-3 font-mono text-xs leading-relaxed" value={c.argsText} onChange={e => editConnector(c.key, { argsText: e.target.value })} /><span className="mt-1 block text-xs text-white/50">Keep each argument in quotes. Use doubled backslashes in Windows paths. Nothing is executed by this page.</span></label></> : <Field label="MCP server URL" value={c.http_url} onChange={http_url => editConnector(c.key, { http_url })} />}
            <label className="block text-sm text-white/65">Notes<textarea className="glass-input mt-2 w-full min-h-20 p-3 text-sm" maxLength={2000} value={c.notes} onChange={e => editConnector(c.key, { notes: e.target.value })} /></label>
          </article>)}
          <button type="button" className={button} disabled={draft.connectors.length >= 20} onClick={() => { let n = 1; while (draft.connectors.some(c => c.id === `connector-${n}`)) n++; setDraft({ ...draft, connectors: [...draft.connectors, { key: crypto.randomUUID(), id: `connector-${n}`, display_name: "New connector", enabled: true, glass_kind: "local_stdio", command: "node", args: [], argsText: "[]", http_url: "", notes: "" }] }); setNotice(""); }}><Plus className="w-4 h-4" />Add connector</button>
        </Panel>
      </fieldset>
      <div className="glass-sm flex flex-wrap items-center justify-between gap-4 p-4" aria-label="Settings actions"><p className="text-sm text-white/65">{dirty ? "You have unsaved changes." : "All changes saved."}</p><div className="flex gap-2"><button type="button" className={button} disabled={!dirty || busy || loading} onClick={discard}>Discard</button><button type="button" className={`${button} bg-white/15 hover:bg-white/25`} disabled={!dirty || busy || loading} onClick={() => void save()}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{busy ? "Saving…" : "Save settings"}</button></div></div>
      <Panel title="Connect with Cyclone Glass" description="Recipes use your saved, enabled connectors. Importing and approving the program in Glass is a separate step.">
        {dirty && <p className="text-amber-200 text-sm">Save your changes before copying an updated recipe.</p>}
        {saved.data.connectors.some(c => c.enabled && c.glass_kind === "local_stdio") && <>
          <div className="flex flex-wrap justify-between items-center gap-3"><h3 className="text-white/85">Program on this PC</h3><button type="button" className={button} disabled={dirty || busy} onClick={() => void copy(glassRecipe(saved.data))}><Copy className="w-4 h-4" />Copy Glass JSON</button></div>
          <textarea aria-label="Glass paste JSON" readOnly spellCheck={false} className="glass-input w-full min-h-56 p-4 font-mono text-xs leading-relaxed" value={glassRecipe(saved.data)} onFocus={e => e.target.select()} />
          <p className="text-xs text-white/60 leading-relaxed">Glass → Command Center → Connections → Program on this PC. Glass asks you to approve the program’s SHA-256 pin. Updating its script requires a new approval.</p>
          {saved.data.connectors.filter(c => c.enabled && c.glass_kind === "local_stdio").map(c => <p key={c.id} className="text-xs text-white/55 break-all">{c.display_name} · script to pin: <code>{c.args[0] || "No script argument saved"}</code></p>)}
        </>}
        {saved.data.connectors.filter(c => c.enabled && c.glass_kind === "remote_http").map(c => <div key={c.id} className="space-y-2"><h3 className="text-white/85">{c.display_name} · Server address</h3><input aria-label={`${c.display_name} saved MCP URL`} className="glass-input w-full px-3 h-11 text-sm" readOnly value={c.http_url} onFocus={e => e.target.select()} /><button type="button" className={button} disabled={dirty || busy} onClick={() => void copy(c.http_url)}><Copy className="w-4 h-4" />Copy server address</button></div>)}
        {!saved.data.connectors.some(c => c.enabled) && <p className="text-white/60 text-sm">Enable and save a connector to prepare its recipe.</p>}
        <p className="text-xs text-white/50">The saved Studio endpoint is available to connector builders through GET /api/mcp-connections. Existing connectors must explicitly support reading it; saving here does not reconfigure an external program.</p>
      </Panel>
      <Panel title="Employee ID contract" description="Target contract for the dedicated connector. Saving these settings does not verify or change the installed connector’s implementation.">
        <dl className="grid gap-4 sm:grid-cols-2 text-sm"><div><dt className="text-white/50">Photo</dt><dd className="mt-1 text-white/90">Required</dd></div><div><dt className="text-white/50">Signature</dt><dd className="mt-1 text-white/90">Automatic · given name only · 420 × 123</dd></div><div><dt className="text-white/50">Caller signature inputs</dt><dd className="mt-1 text-white/90">None in the dedicated connector contract</dd></div><div><dt className="text-white/50">Tools</dt><dd className="mt-1 text-white/90 break-words">employee_id_health, employee_id_schema, employee_id_generate, employee_id_status</dd></div></dl>
      </Panel>
    </>}
    <Dialog open={blocker.state === "blocked"} onOpenChange={open => { if (!open && blocker.state === "blocked") blocker.reset(); }}>
      <DialogContent className="border-white/20 bg-[#17171b] text-white">
        <DialogTitle>Leave unsaved changes?</DialogTitle>
        <DialogDescription className="text-white/65">Your edits have not been saved on this PC.</DialogDescription>
        <div className="flex flex-wrap gap-2"><button className={button} onClick={() => { if (blocker.state === "blocked") blocker.reset(); }}>Keep editing</button><button className={button} onClick={() => { if (blocker.state === "blocked") blocker.proceed(); }}>Discard and leave</button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
