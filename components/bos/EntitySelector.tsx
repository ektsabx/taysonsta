"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useEffect, useRef, useState, useTransition } from "react";

export interface EntityOption {
  id: string;
  label: string;
  sub?: string | null;
}

// Async search-select for linking existing records (select an existing
// client instead of creating a duplicate — §100). The search action is a
// server action that enforces permissions.
export function EntitySelector({
  name,
  search,
  initial,
  placeholder = "ابحث واختر...",
  required,
  onChange,
  allowClear = true,
  id,
}: {
  name: string;
  search: (q: string) => Promise<EntityOption[]>;
  initial?: EntityOption | null;
  placeholder?: string;
  required?: boolean;
  onChange?: (option: EntityOption | null) => void;
  allowClear?: boolean;
  id?: string;
}) {
  const t = useT();
  const [value, setValue] = useState<EntityOption | null>(initial ?? null);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function runSearch(q: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const results = await search(q);
        setOptions(results);
        setActive(0);
      });
    }, 200);
  }

  function choose(option: EntityOption | null) {
    setValue(option);
    setOpen(false);
    setQuery("");
    onChange?.(option);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="hidden" name={name} value={value?.id ?? ""} />
      {value ? (
        <div className="bos-row" style={{ minHeight: 36, background: "var(--bos-input)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 7, padding: "4px 8px", justifyContent: "space-between", flexWrap: "nowrap" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
            {value.label}
            {value.sub ? <span className="bos-faint"> · {value.sub}</span> : null}
          </span>
          {allowClear ? (
            <button type="button" className="bos-icon-btn" aria-label={t("إزالة الاختيار")} onClick={() => choose(null)}>
              ×
            </button>
          ) : null}
        </div>
      ) : (
        <input
          id={id}
          type="text"
          value={query}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setOpen(true);
            if (!options.length) runSearch(query);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            runSearch(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && options[active]) {
              e.preventDefault();
              choose(options[active]);
            }
          }}
        />
      )}
      {open && !value ? (
        <div className="bos-menu-panel" style={{ insetInlineStart: 0, insetInlineEnd: "auto", width: "100%", maxHeight: 260, overflowY: "auto" }}>
          {pending ? <div className="bos-faint" style={{ padding: 8, fontSize: 12 }}><Tx>جارٍ البحث...</Tx></div> : null}
          {!pending && options.length === 0 ? <div className="bos-faint" style={{ padding: 8, fontSize: 12 }}><Tx>لا توجد نتائج</Tx></div> : null}
          {options.map((o, i) => (
            <button
              key={o.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              style={i === active ? { background: "rgba(var(--bos-fg-rgb), 0.06)" } : undefined}
            >
              <span>
                {o.label}
                {o.sub ? <small className="bos-faint" style={{ display: "block", fontSize: 11 }}><Tx>{o.sub}</Tx></small> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
