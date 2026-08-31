"use client";

import { useEffect, useRef, useState } from "react";

// Themed, searchable timezone combobox. Opens on click or focus, filters as you
// type, and submits whatever is in the field (the server validates it). Native
// <datalist> could not be themed and would not open on click.
export function TimezoneSelect({
  zones,
  defaultValue,
  name = "timezone",
}: {
  zones: string[];
  defaultValue: string;
  name?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = zones.filter((z) => z.toLowerCase().includes(q)).slice(0, 200);

  return (
    <div ref={ref} className="relative w-56">
      <input type="hidden" name={name} value={query} />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        placeholder="search timezone"
        aria-label="Timezone"
        className="w-full border border-fg bg-transparent px-2 py-[7px] text-[14px]"
      />
      {open ? (
        <ul className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-auto border border-fg bg-bg">
          {filtered.length === 0 ? (
            <li className="px-2 py-[7px] text-[13px] text-muted">no match</li>
          ) : (
            filtered.map((z) => (
              <li key={z}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setQuery(z);
                    setOpen(false);
                  }}
                  className={
                    "block w-full px-2 py-[6px] text-left text-[13px] " +
                    (z === query ? "bg-fg text-bg" : "hover:bg-surface")
                  }
                >
                  {z}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
