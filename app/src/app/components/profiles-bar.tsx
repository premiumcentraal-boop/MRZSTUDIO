import { useEffect, useRef, useState } from "react";
import { UserRound, Plus, X, Check, Trash2, Pencil, Save, ChevronDown } from "lucide-react";
import { Flag } from "./flag";

/* ============================================================================
 * ProfilesBar
 *
 * Persists named snapshots of the badge form to localStorage so returning
 * users can load any previously-saved employee with one click. Photos and
 * signatures are not persisted (Files don't serialize), only the text fields.
 *
 * Rendered as a horizontally-scrollable strip of profile cards so a long
 * roster (20+) can be scanned without wrapping the whole page.
 * ========================================================================== */

const STORAGE_KEY = "idgen.profiles.v1";
const MAX_PROFILES = 50;

type Profile<T> = {
  id: string;
  name: string;
  savedAt: number;
  data: T;
};

function loadProfiles<T>(): Profile<T>[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveProfiles<T>(profiles: Profile<T>[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    /* quota or disabled */
  }
}

function docTypeShort(docType: string | undefined): string {
  if (docType === "passport") return "Passport";
  if (docType === "id_card") return "ID";
  return docType ? String(docType) : "";
}

function formatBirthShort(iso: string | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function ProfilesBar<
  T extends {
    first_name?: string;
    last_name?: string;
    country?: string;
    doc_type?: string;
    birth_date?: string;
  },
>({
  formData,
  onLoad,
}: {
  formData: T;
  onLoad: (data: T) => void;
}) {
  const [profiles, setProfiles] = useState<Profile<T>[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<T | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingSaveId, setPendingSaveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfiles(loadProfiles<T>());
  }, []);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const defaultName = () => {
    const first = (formData.first_name ?? "").trim();
    const last = (formData.last_name ?? "").trim();
    const joined = [first, last].filter(Boolean).join(" ");
    return joined || `Profile ${profiles.length + 1}`;
  };

  const commitSave = () => {
    const finalName = (name.trim() || defaultName()).slice(0, 40);
    const next: Profile<T> = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name: finalName,
      savedAt: Date.now(),
      data: formData,
    };
    const merged = [next, ...profiles].slice(0, MAX_PROFILES);
    setProfiles(merged);
    saveProfiles(merged);
    setActiveId(next.id);
    setAdding(false);
    setName("");
  };

  const commitRename = (id: string) => {
    const finalName = editName.trim().slice(0, 40);
    if (!finalName) {
      setEditingId(null);
      setEditName("");
      return;
    }
    const merged = profiles.map((p) => (p.id === id ? { ...p, name: finalName } : p));
    setProfiles(merged);
    saveProfiles(merged);
    setEditingId(null);
    setEditName("");
  };

  const confirmOverwrite = (id: string) => {
    const merged = profiles.map((p) =>
      p.id === id ? { ...p, data: formData, savedAt: Date.now() } : p,
    );
    setProfiles(merged);
    saveProfiles(merged);
    setPendingSaveId(null);
    // Loading the just-saved profile keeps the form in sync with disk; clear
    // the snapshot so the next deselect doesn't restore stale edits.
    setSnapshot(null);
    setActiveId(id);
  };

  const confirmRemove = (id: string) => {
    const merged = profiles.filter((p) => p.id !== id);
    setProfiles(merged);
    saveProfiles(merged);
    if (activeId === id) {
      setActiveId(null);
      setSnapshot(null);
    }
    setPendingDeleteId(null);
  };

  const load = (p: Profile<T>) => {
    if (activeId === p.id) {
      if (snapshot) onLoad(snapshot);
      setSnapshot(null);
      setActiveId(null);
      return;
    }
    setSnapshot(formData);
    onLoad(p.data);
    setActiveId(p.id);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-white/65 hover:text-white text-[10px] mono uppercase tracking-[0.16em] transition-colors"
        aria-expanded={open}
      >
        <UserRound className="w-3 h-3" strokeWidth={2} />
        Profiles
        <span className="text-white/30 normal-case tracking-normal">
          ({profiles.length}/{MAX_PROFILES})
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {!open ? null : (
      <div className="px-3 pb-3">
      <div
        className="flex gap-2.5 overflow-x-auto pb-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.18)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
        style={{ scrollSnapType: "x proximity" }}
      >
        {/* New profile card (always first) */}
        <div
          className="shrink-0 w-[140px] h-[78px] rounded-lg border border-dashed border-white/15 bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 hover:border-white/30 hover:bg-white/[0.04] transition-colors"
          style={{ scrollSnapAlign: "start" }}
        >
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                commitSave();
              }}
              className="flex flex-col items-center gap-2 px-2 w-full"
            >
              <input
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) setAdding(false);
                }}
                placeholder={defaultName()}
                maxLength={40}
                className="bg-black/40 border border-white/10 rounded px-2 py-1 outline-none text-white text-xs placeholder:text-white/30 w-full text-center focus:border-white/30"
              />
              <div className="flex items-center gap-1.5">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-emerald-300 hover:bg-white/10"
                  title="Save"
                >
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setName("");
                  }}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white/60 hover:text-white hover:bg-white/10"
                  title="Cancel"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex flex-col items-center gap-1.5 text-white/70 hover:text-white"
              title="Save the current form as a profile"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-white/20 bg-white/[0.04]">
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </span>
              <span className="text-xs">Save current</span>
            </button>
          )}
        </div>

        {profiles.map((p) => {
          const active = p.id === activeId;
          const pendingDelete = p.id === pendingDeleteId;
          const isEditing = p.id === editingId;

          const docLabel = docTypeShort(p.data?.doc_type);
          const birth = formatBirthShort(p.data?.birth_date);
          const pendingSave = p.id === pendingSaveId;

          const cardClickable = !pendingDelete && !pendingSave && !isEditing;

          return (
            <div
              key={p.id}
              className={`shrink-0 w-[190px] h-[78px] rounded-lg border flex items-stretch gap-2 pl-2.5 pr-1.5 py-1.5 transition-colors ${
                active
                  ? "border-emerald-300/40 bg-emerald-300/[0.06]"
                  : pendingDelete
                  ? "border-rose-400/40 bg-rose-500/[0.07]"
                  : pendingSave
                  ? "border-sky-400/40 bg-sky-500/[0.07]"
                  : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
              }`}
              style={{ scrollSnapAlign: "start" }}
            >
              {/* Left: name + meta — clicking toggles load/unload */}
              <div
                role={cardClickable ? "button" : undefined}
                tabIndex={cardClickable ? 0 : -1}
                onClick={() => {
                  if (cardClickable) load(p);
                }}
                onKeyDown={(e) => {
                  if (cardClickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    load(p);
                  }
                }}
                className={`flex flex-col justify-center grow min-w-0 gap-1 ${
                  cardClickable ? "cursor-pointer" : ""
                }`}
                title={
                  cardClickable
                    ? active
                      ? "Click to deselect and restore previous edits"
                      : "Click to load this profile"
                    : undefined
                }>
                {isEditing ? (
                  <input
                    ref={editRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitRename(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(p.id);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditName("");
                      }
                    }}
                    maxLength={40}
                    className="bg-black/40 border border-white/15 rounded px-1.5 py-0.5 outline-none text-white text-xs w-full focus:border-white/30"
                  />
                ) : (
                  <span
                    className={`inline-block max-w-full truncate text-xs px-1.5 py-0.5 rounded ${
                      active
                        ? "bg-emerald-300/15 text-emerald-50"
                        : "bg-white/[0.06] text-white"
                    }`}
                    title={p.name}
                  >
                    {p.name}
                  </span>
                )}
                <div className="flex items-center gap-1.5 text-[10px] text-white/55 mono truncate">
                  <Flag
                    code={p.data?.country || ""}
                    title={p.data?.country || ""}
                    className="w-4 h-auto rounded-[2px] ring-1 ring-black/30 shrink-0"
                  />

                  {docLabel && <span className="truncate">{docLabel}</span>}
                  {birth && (
                    <>
                      <span className="text-white/25">·</span>
                      <span className="truncate">{birth}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Right: action icons */}
              {pendingDelete ? (
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                  <span className="text-rose-200 text-[10px] mono">Delete?</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => confirmRemove(p.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-rose-200 hover:text-white hover:bg-rose-500/30 transition-colors"
                      title="Confirm delete"
                    >
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDeleteId(null)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ) : pendingSave ? (
                <div className="flex flex-col items-center justify-center gap-1 shrink-0">
                  <span className="text-sky-200 text-[10px] mono">Save?</span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => confirmOverwrite(p.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-sky-200 hover:text-white hover:bg-sky-500/30 transition-colors"
                      title="Save current form to this profile"
                    >
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingSaveId(null)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 border-l border-white/[0.06] pl-1.5">
                  <button
                    type="button"
                    onClick={() => setPendingSaveId(p.id)}
                    className="inline-flex items-center justify-center w-7 h-7 rounded text-white/55 hover:text-sky-300 hover:bg-white/[0.08] transition-colors"
                    title="Save current form changes to this profile"
                  >
                    <Save className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(p.id);
                      setEditName(p.name);
                    }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded text-white/55 hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Rename profile"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(p.id)}
                    className="inline-flex items-center justify-center w-7 h-7 rounded text-white/50 hover:text-rose-300 hover:bg-white/[0.08] transition-colors"
                    title="Delete profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {profiles.length === 0 && !adding && (
        <div className="text-white/35 text-[11px] mt-2">
          None yet — saved profiles live in this browser only.
        </div>
      )}
      </div>
      )}
    </div>
  );
}
