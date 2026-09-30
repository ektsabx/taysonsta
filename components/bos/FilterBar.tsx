"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { useT } from "@/components/bos/I18n";

export interface FilterDef {
  key: string;
  label: string;
  type: "select" | "date" | "text";
  options?: { value: string; label: string }[];
}

// URL-driven search + filters so lists are shareable and server-filtered (§70).
export function FilterBar({ filters = [], searchPlaceholder = "بحث...", children }: { filters?: FilterDef[]; searchPlaceholder?: string; children?: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  const urlQ = searchParams.get("q") ?? "";
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setQ(urlQ);
  }

  function push(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const active = filters.filter((f) => searchParams.get(f.key));

  return (
    <div className="bos-stack" style={{ gap: 6, marginBottom: 12 }}>
      <div className="bos-filterbar" style={{ marginBottom: 0 }} aria-busy={pending}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: q.trim() || null });
          }}
        >
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(searchPlaceholder)} aria-label={t("بحث")} />
        </form>
        {filters.map((f) =>
          f.type === "select" ? (
            <select key={f.key} aria-label={t(f.label)} value={searchParams.get(f.key) ?? ""} onChange={(e) => push({ [f.key]: e.target.value || null })}>
              <option value="">{t("{label}: الكل", { label: t(f.label) })}</option>
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)}
                </option>
              ))}
            </select>
          ) : f.type === "date" ? (
            <label key={f.key} className="bos-row" style={{ gap: 4, fontSize: 12, color: "rgba(var(--bos-fg-rgb), 0.5)" }}>
              {t(f.label)}
              <input type="date" value={searchParams.get(f.key) ?? ""} onChange={(e) => push({ [f.key]: e.target.value || null })} />
            </label>
          ) : (
            <input
              key={f.key}
              type="text"
              placeholder={t(f.label)}
              defaultValue={searchParams.get(f.key) ?? ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") push({ [f.key]: (e.target as HTMLInputElement).value || null });
              }}
            />
          ),
        )}
        {children}
      </div>
      {active.length > 0 || searchParams.get("q") ? (
        <div className="bos-row" style={{ gap: 6 }}>
          {searchParams.get("q") ? (
            <span className="bos-filter-chip">
              {t("بحث")}: {searchParams.get("q")}
              <button type="button" aria-label={t("إزالة")} onClick={() => push({ q: null })}>
                ×
              </button>
            </span>
          ) : null}
          {active.map((f) => {
            const value = searchParams.get(f.key)!;
            const label = f.options?.find((o) => o.value === value)?.label ?? value;
            return (
              <span key={f.key} className="bos-filter-chip">
                {t(f.label)}: {t(label)}
                <button type="button" aria-label={t("إزالة")} onClick={() => push({ [f.key]: null })}>
                  ×
                </button>
              </span>
            );
          })}
          <button type="button" className="admin-btn small ghost" onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}>
            {t("مسح الكل")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DateRangePicker({ fromKey = "from", toKey = "to" }: { fromKey?: string; toKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useT();

  function set(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <span className="bos-row" style={{ gap: 4 }}>
      <input type="date" aria-label={t("من")} value={searchParams.get(fromKey) ?? ""} onChange={(e) => set(fromKey, e.target.value)} />
      <span className="bos-faint">→</span>
      <input type="date" aria-label={t("إلى")} value={searchParams.get(toKey) ?? ""} onChange={(e) => set(toKey, e.target.value)} />
    </span>
  );
}
