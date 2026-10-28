"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, Send } from "lucide-react";

/** A dropdown that sets one URL parameter: the date range, or (param "campaign") the campaign on the Analytics page. */
export function RangePicker({ value, options, param = "range" }: { value: string; options: { key: string; label: string }[]; param?: "range" | "campaign" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [open]);

  return (
    <div ref={ref} className="range-picker" style={{ position: "relative" }}>
      <button className="btn-secondary" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {param === "campaign" ? <Send /> : <Calendar />} <span dir="auto">{current.label}</span>
      </button>
      {open && (
        <div className="dropdown-panel">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`menu-item${o.key === value ? " selected" : ""}`}
              onClick={() => {
                setOpen(false);
                // Keep the other parameters (e.g. the Partners tab); a new range starts at page 1.
                const next = new URLSearchParams(params.toString());
                if (o.key) next.set(param, o.key); else next.delete(param);
                next.delete("page");
                router.push(`${pathname}?${next.toString()}`);
              }}
            >
              <span dir="auto">{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
