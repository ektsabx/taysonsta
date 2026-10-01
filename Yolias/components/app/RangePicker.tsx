"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";

export function RangePicker({ value, options }: { value: string; options: { key: string; label: string }[] }) {
  const router = useRouter();
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
    <div ref={ref} style={{ position: "relative" }}>
      <button className="btn-secondary" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Calendar /> {current.label}
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
                router.push(`?range=${o.key}`);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
