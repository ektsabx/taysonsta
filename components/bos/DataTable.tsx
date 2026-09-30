"use client";

import { useT, Tx, Opt } from "@/components/bos/I18n";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionState } from "@/lib/bos/action";

export interface DataColumn {
  key: string;
  label: string;
  sortable?: boolean;
  defaultHidden?: boolean;
  alwaysVisible?: boolean;
  primary?: boolean;
  align?: "end";
}

export interface DataRow {
  id: string;
  cells: Record<string, ReactNode>;
}

export interface BulkAction {
  key: string;
  label: string;
  action: (ids: string[], value?: string) => Promise<ActionState>;
  options?: { value: string; label: string }[];
  optionLabel?: string;
  confirm?: string;
  danger?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  query: string;
}

interface DataTableProps {
  tableId: string;
  columns: DataColumn[];
  rows: DataRow[];
  total: number;
  page: number;
  pageSize: number;
  bulkActions?: BulkAction[];
  exportHref?: string;
  empty?: ReactNode;
  toolbar?: ReactNode;
  savedViews?: SavedView[];
  onSaveView?: (name: string, query: string) => Promise<ActionState>;
  onDeleteView?: (id: string) => Promise<ActionState>;
}

function useQuery() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const hrefWith = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  };
  return { searchParams, hrefWith };
}

export function DataTable({
  tableId,
  columns,
  rows,
  total,
  page,
  pageSize,
  bulkActions,
  exportHref,
  empty,
  toolbar,
  savedViews,
  onSaveView,
  onDeleteView,
}: DataTableProps) {
  const { searchParams, hrefWith } = useQuery();
  const router = useRouter();
  const storageKey = `bos-cols:${tableId}`;
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<"columns" | "views" | null>(null);
  const [bulkValue, setBulkValue] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);

  // Column preferences live in localStorage (external system): read after mount.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
      } catch {
        // storage unavailable — keep defaults
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setSelected(new Set());
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const visibleColumns = useMemo(() => columns.filter((c) => c.alwaysVisible || !hidden.has(c.key)), [columns, hidden]);

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const sort = searchParams.get("sort");
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function runBulk(action: BulkAction) {
    const ids = [...selected];
    if (!ids.length) return;
    if (action.options && !bulkValue[action.key]) {
      setMessage({ ok: false, text: t("اختر {x} أولاً", { x: t(action.optionLabel ?? "قيمة") }) });
      return;
    }
    if (action.confirm && !window.confirm(action.confirm.replace("{n}", String(ids.length)))) return;
    startTransition(async () => {
      const result = await action.action(ids, bulkValue[action.key]);
      setMessage(result.ok ? { ok: true, text: t(result.message ?? "تم تنفيذ الإجراء على {n} عنصر", { n: ids.length }) } : { ok: false, text: t(result.error) });
      if (result.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const currentQuery = searchParams.toString();

  return (
    <div className="bos-table-wrap">
      <div className="bos-table-toolbar">
        <div className="bos-row">
          {selected.size > 0 && bulkActions?.length ? (
            <>
              <span className="bos-muted" style={{ fontSize: 12.5 }}>
                {t("{n} محدد", { n: selected.size })}
              </span>
              {bulkActions.map((action) => (
                <span key={action.key} className="bos-row" style={{ gap: 4 }}>
                  {action.options ? (
                    <select
                      aria-label={t(action.optionLabel ?? action.label)}
                      value={bulkValue[action.key] ?? ""}
                      onChange={(e) => setBulkValue((v) => ({ ...v, [action.key]: e.target.value }))}
                      style={{ height: 30, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 6, fontSize: 12.5 }}
                    >
                      <Opt value="">{t(action.optionLabel ?? "اختر")}</Opt>
                      {action.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {t(o.label)}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button type="button" className={`admin-btn small ${action.danger ? "danger" : "secondary"}`} disabled={pending} onClick={() => runBulk(action)}>
                    {t(action.label)}
                  </button>
                </span>
              ))}
            </>
          ) : (
            <span className="bos-muted" style={{ fontSize: 12.5 }}>
              {t("{n} نتيجة", { n: total.toLocaleString("en-US") })}
            </span>
          )}
          {toolbar}
        </div>
        <div className="bos-row" ref={menuRef}>
          {savedViews && onSaveView ? (
            <div className="bos-menu">
              <button type="button" className="admin-btn small ghost" onClick={() => setMenu(menu === "views" ? null : "views")}>
                {t("العروض المحفوظة")}
              </button>
              {menu === "views" ? (
                <div className="bos-menu-panel">
                  {savedViews.length === 0 ? <div className="bos-faint" style={{ padding: 8, fontSize: 12 }}>{t("لا توجد عروض محفوظة")}</div> : null}
                  {savedViews.map((view) => (
                    <div key={view.id} className="bos-row" style={{ flexWrap: "nowrap", gap: 2 }}>
                      <Link href={`?${view.query}`} onClick={() => setMenu(null)}>
                        {view.name}
                      </Link>
                      {onDeleteView ? (
                        <button
                          type="button"
                          aria-label={t("حذف العرض")}
                          style={{ width: "auto" }}
                          onClick={() =>
                            startTransition(async () => {
                              await onDeleteView(view.id);
                              router.refresh();
                            })
                          }
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <div className="bos-menu-sep" />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
                      if (!name) return;
                      startTransition(async () => {
                        const result = await onSaveView(name, currentQuery);
                        setMessage(result.ok ? { ok: true, text: t("تم حفظ العرض") } : { ok: false, text: t(result.error) });
                        setMenu(null);
                        router.refresh();
                      });
                    }}
                    style={{ padding: 4, display: "flex", gap: 4 }}
                  >
                    <input type="text" name="name" placeholder={t("اسم العرض الحالي")} />
                    <button type="submit" style={{ width: "auto" }}>
                      {t("حفظ")}
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="bos-menu">
            <button type="button" className="admin-btn small ghost" onClick={() => setMenu(menu === "columns" ? null : "columns")}>
              {t("الأعمدة")}
            </button>
            {menu === "columns" ? (
              <div className="bos-menu-panel">
                {columns
                  .filter((c) => !c.alwaysVisible)
                  .map((c) => (
                    <label key={c.key}>
                      <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleColumn(c.key)} />
                      {t(c.label)}
                    </label>
                  ))}
              </div>
            ) : null}
          </div>
          {exportHref ? (
            <a className="admin-btn small ghost" href={`${exportHref}${exportHref.includes("?") ? "&" : "?"}${currentQuery}`}>
              {t("تصدير CSV")}
            </a>
          ) : null}
        </div>
      </div>

      {message ? (
        <div className={message.ok ? "bos-form-success" : "bos-form-error"} style={{ margin: 10 }} role="status">
          <Tx>{message.text}</Tx>
        </div>
      ) : null}

      {rows.length === 0 ? (
        empty ?? <div className="bos-empty"><div className="bos-empty-title">{t("لا توجد نتائج")}</div></div>
      ) : (
        <div className="bos-table-scroll">
          <table className="bos-table responsive">
            <thead>
              <tr>
                {bulkActions?.length ? (
                  <th className="col-check">
                    <input
                      type="checkbox"
                      aria-label={t("تحديد الكل")}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </th>
                ) : null}
                {visibleColumns.map((col) => (
                  <th key={col.key} style={col.align === "end" ? { textAlign: "end" } : undefined}>
                    {col.sortable ? (
                      <Link href={hrefWith({ sort: col.key, dir: sort === col.key && dir === "desc" ? "asc" : "desc", page: null })} scroll={false}>
                        {t(col.label)}
                        {sort === col.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                      </Link>
                    ) : (
                      t(col.label)
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={selected.has(row.id) ? "selected" : undefined}>
                  {bulkActions?.length ? (
                    <td className="col-check">
                      <input
                        type="checkbox"
                        aria-label={t("تحديد")}
                        checked={selected.has(row.id)}
                        onChange={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })
                        }
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      data-label={t(col.label)}
                      className={col.primary ? "cell-primary cell-primary-mobile" : undefined}
                      style={col.align === "end" ? { textAlign: "end" } : undefined}
                    >
                      {(() => { const v = row.cells[col.key]; return typeof v === "string" ? t(v) : v ?? ""; })()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bos-table-footer">
        <span>
          {t("صفحة {page} من {total}", { page, total: totalPages })}
        </span>
        <Pagination page={page} totalPages={totalPages} hrefFor={(p) => hrefWith({ page: p === 1 ? null : String(p) })} />
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.push(p);
  return (
    <nav className="bos-pagination" aria-label="pagination">
      <Link href={hrefFor(page - 1)} className={page <= 1 ? "disabled" : undefined} aria-disabled={page <= 1} scroll={false}>
        ‹
      </Link>
      {pages.map((p) =>
        p === page ? (
          <span key={p} className="page current">
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} scroll={false}>
            {p}
          </Link>
        ),
      )}
      <Link href={hrefFor(page + 1)} className={page >= totalPages ? "disabled" : undefined} aria-disabled={page >= totalPages} scroll={false}>
        ›
      </Link>
    </nav>
  );
}
