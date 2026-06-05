import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown } from "lucide-react";

export function SearchableDropdown<T extends { id: string }>({
  placeholder,
  icon,
  items,
  renderItem,
  filter,
  onPick,
}: {
  placeholder: string;
  icon: React.ReactNode;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  filter: (item: T, q: string) => boolean;
  onPick: (item: T) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((it) => filter(it, q)) : items;

  return (
    <div className="relative" ref={wrapRef}>
      <div
        className="flex items-center gap-2 h-12 px-4 rounded-2xl bg-white/5 border border-white/12 hover:border-white/25 focus-within:border-white/35 transition-colors cursor-text"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <span className="text-white/55">{icon}</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-white/40"
        />
        <ChevronDown
          className={`w-4 h-4 text-white/45 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 left-0 right-0 mt-2 rounded-2xl border border-white/12 bg-neutral-950/95 backdrop-blur-md shadow-2xl max-h-80 overflow-y-auto"
          >
            {filtered.length === 0 && (
              <div className="px-4 py-3 text-white/45 text-xs">No matches.</div>
            )}
            {filtered.map((it) => (
              <button
                key={it.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(it);
                  setOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/5 border-b border-white/5 last:border-b-0 transition-colors"
              >
                {renderItem(it)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
