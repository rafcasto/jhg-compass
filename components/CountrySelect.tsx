"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { COUNTRIES } from "@/lib/countries";

// Searchable country dropdown — type to filter, click to select. No external deps.
export default function CountrySelect({ value, onChange, placeholder = "Select country" }:
  { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? COUNTRIES.filter((c) => c.toLowerCase().includes(q)) : COUNTRIES;
  }, [query]);

  function choose(c: string) {
    onChange(c);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="field flex items-center justify-between text-left">
        <span className={value ? "text-jh-ink" : "text-jh-mute"}>{value || placeholder}</span>
        <ChevronDown className={`h-4 w-4 text-jh-mute shrink-0 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-[10px] border border-jh-line bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-jh-line px-3 py-2">
            <Search className="h-4 w-4 text-jh-mute shrink-0" />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="w-full bg-transparent text-sm text-jh-ink outline-none placeholder:text-jh-mute-2" />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {list.map((c) => (
              <li key={c}>
                <button type="button" onClick={() => choose(c)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm text-left hover:bg-jh-mist ${value === c ? "text-jh-red font-semibold" : "text-jh-ink"}`}>
                  {c} {value === c && <Check className="h-4 w-4" />}
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-3 text-sm text-jh-mute">No match</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
