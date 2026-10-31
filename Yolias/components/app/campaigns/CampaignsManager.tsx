"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, ChevronRight, Columns3, Download, Filter, MoreHorizontal, Pin, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { METRICS, DEFAULT_COLUMNS, RANGE_PRESETS, cleanColumns, formatMetric, metric, type Counts, type RangePreset } from "@/lib/campaigns/metrics";
import { channelSpec } from "@/lib/campaigns/channels";
import { countryLabel } from "@/lib/format";
import { bulkCampaigns, bulkEdit, deleteView, renameCampaign, saveView } from "@/app/(app)/outreach/manager-actions";
import type { CampaignLine } from "@/services/campaign-table";

// Campaigns as an ads manager (owner, 2026-10-31, D-272), after Meta / TikTok
// Ads Manager: a toolbar (create, search, filters, date range, refresh,
// columns, breakdown, export, saved views), a table whose metric columns come
// from the metric registry, selection with bulk actions, a row menu, totals,
// and a breakdown by audience group. The date range and refresh go to the
// server (real counts for that period); everything else filters what came back.

type Filters = {
  status: string[]; objective: string[]; channel: string[]; country: string[]; owner: string[];
  createdFrom?: string; createdTo?: string;
  spendMin?: number; spendMax?: number; contactedMin?: number; contactedMax?: number; meetingsMin?: number; meetingsMax?: number;
};
const noFilters = (): Filters => ({ status: [], objective: [], channel: [], country: [], owner: [] });
const STATUSES = ["draft", "scheduled", "active", "paused", "completed", "failed", "archived"] as const;
const OBJECTIVES = ["leads", "meetings", "opportunities", "new_customers", "reactivate", "promote", "custom"] as const;
const PREF_KEY = "yolias:campaign-columns";

interface View { id: string; name: string; config: { columns?: string[]; pinned?: string[]; filters?: Partial<Filters>; range?: string; from?: string; to?: string; breakdown?: "none" | "audience"; sort?: string } }

export function CampaignsManager({ lines, members, views, range, from, to, refreshedAt }: {
  lines: CampaignLine[]; members: { id: string; name: string }[]; views: View[]; range: RangePreset; from: string; to: string; refreshedAt: string;
}) {
  const { t, locale } = useI18n();
  const m = t.camp.manager;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters());
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [pinned, setPinned] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [breakdown, setBreakdown] = useState<"none" | "audience">("none");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [open, setOpen] = useState<"filters" | "columns" | "views" | "range" | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState({ from, to });
  const bar = useRef<HTMLDivElement>(null);

  // The member's own column choice is remembered in this browser (a convenience; saved views are the shared way).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null") as { columns?: string[]; pinned?: string[] } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.columns) setColumns(cleanColumns(saved.columns));
      if (saved?.pinned) setPinned(cleanColumns(saved.pinned));
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ columns, pinned })); } catch { /* ignore */ } }, [columns, pinned]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".cm-pop, .cm-menu, .cm-toggle")) { setOpen(null); setMenu(null); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const lang = locale === "ar" ? "ar" : "en";
  const ordered = [...columns.filter((c) => pinned.includes(c)), ...columns.filter((c) => !pinned.includes(c))].map((id) => metric(id)!).filter(Boolean);
  const memberName = (id: string | null) => members.find((x) => x.id === id)?.name ?? "";
  const countries = useMemo(() => [...new Set(lines.flatMap((l) => l.countries))].sort(), [lines]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const between = (v: number, a?: number, b?: number) => (a == null || v >= a) && (b == null || v <= b);
    const rows = lines.filter((l) =>
      (!onlySelected || selected.has(l.id)) &&
      (!s || l.name.toLowerCase().includes(s)) &&
      (!filters.status.length ? l.status !== "archived" : filters.status.includes(l.status)) &&
      (!filters.objective.length || filters.objective.includes(l.objective)) &&
      (!filters.channel.length || l.channels.some((c) => filters.channel.includes(c))) &&
      (!filters.country.length || l.countries.some((c) => filters.country.includes(c))) &&
      (!filters.owner.length || filters.owner.includes(l.ownerId ?? "")) &&
      (!filters.createdFrom || l.createdAt.slice(0, 10) >= filters.createdFrom) &&
      (!filters.createdTo || l.createdAt.slice(0, 10) <= filters.createdTo) &&
      between(l.counts.spendUsd, filters.spendMin, filters.spendMax) &&
      between(l.counts.contacted, filters.contactedMin, filters.contactedMax) &&
      between(l.counts.meetings, filters.meetingsMin, filters.meetingsMax));
    const val = (l: CampaignLine) => sort.key === "name" ? l.name.toLowerCase() : sort.key === "status" ? l.status : sort.key === "created" ? l.createdAt : metric(sort.key)?.compute(l.counts) ?? -Infinity;
    return [...rows].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [lines, q, filters, sort, onlySelected, selected]);

  const totals = useMemo(() => shown.reduce<Counts>((s, l) => Object.fromEntries(Object.keys(s).map((k) => [k, s[k as keyof Counts] + l.counts[k as keyof Counts]])) as unknown as Counts,
    { found: 0, contacted: 0, sent: 0, delivered: 0, bounced: 0, replies: 0, interested: 0, meetingRequests: 0, meetings: 0, held: 0, qualified: 0, customers: 0, revenueUsd: 0, spendUsd: 0, prospectsUsed: 0 }), [shown]);
  const activeFilters = filters.status.length + filters.objective.length + filters.channel.length + filters.country.length + filters.owner.length
    + [filters.createdFrom, filters.createdTo, filters.spendMin, filters.spendMax, filters.contactedMin, filters.contactedMax, filters.meetingsMin, filters.meetingsMax].filter((x) => x != null && x !== "").length;

  const setRange = (preset: RangePreset, f = "", tt = "") => {
    const p = new URLSearchParams(sp.toString());
    if (preset === "lifetime") p.delete("range"); else p.set("range", preset);
    if (preset === "custom") { p.set("from", f); p.set("to", tt); } else { p.delete("from"); p.delete("to"); }
    start(() => router.push(`${pathname}${p.size ? `?${p}` : ""}`));
    setOpen(null);
  };
  const run = <R extends { ok: boolean; message?: string }>(fn: () => Promise<R>, after?: (r: R) => void) => start(async () => {
    const r = await callAction(fn);
    if (isNetworkFailure(r)) { toast(t.feedback.errors.network, "error"); return; }
    if (!r.ok) { toast((r as unknown as { error: string }).error, "error"); return; }
    if (r.message) toast(r.message);
    after?.(r);
    router.refresh();
  });
  const bulk = (action: "pause" | "resume" | "archive" | "delete" | "duplicate", only?: string[]) => {
    const list = only ?? [...selected];
    if (!list.length) return;
    const n = String(list.length);
    if (action === "pause" && list.length > 1 && !confirm(fmt(m.confirmPause, { n }))) return;
    if (action === "archive" && !confirm(fmt(m.confirmArchive, { n }))) return;
    if (action === "delete" && !confirm(fmt(m.confirmDelete, { n }))) return;
    run(() => bulkCampaigns(list, action), () => { setSelected(new Set()); setMenu(null); });
  };
  const exportCsv = (rows: CampaignLine[]) => {
    const head = [m.colName, m.colStatus, m.colChannel, ...ordered.map((c) => c.label[lang])];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = rows.map((l) => [l.name, t.camp.status[l.status], l.channels.map((c) => channelSpec(c)?.label[lang] ?? c).join(" + "), ...ordered.map((c) => formatMetric(c.compute(l.counts), c.format, lang))].map(esc).join(","));
    const blob = new Blob([`﻿${[head.map(esc).join(","), ...body].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `yolias-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyView = (v: View) => {
    const c = v.config;
    setColumns(cleanColumns(c.columns ?? DEFAULT_COLUMNS)); setPinned(cleanColumns(c.pinned ?? []));
    setFilters({ ...noFilters(), ...(c.filters ?? {}) }); setBreakdown(c.breakdown ?? "none");
    if (c.sort) { const [key, dir] = c.sort.split(":"); setSort({ key, dir: dir === "asc" ? 1 : -1 }); }
    setRange((c.range as RangePreset) ?? "lifetime", c.from ?? "", c.to ?? "");
  };
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((l) => selected.has(l.id));
  const updated = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(refreshedAt));
  const head = (key: string, label: string) => (
    <button type="button" className="cm-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {label}{sort.key === key && (sort.dir === 1 ? <ArrowUp /> : <ArrowDown />)}
    </button>
  );
  const chip = (list: string[], v: string, set: (x: string[]) => void, label: string) => (
    <button key={v} type="button" className={`cm-chip${list.includes(v) ? " on" : ""}`} onClick={() => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])}>{label}</button>
  );
  const num = (v: number | undefined, set: (x: number | undefined) => void, label: string) => (
    <input className="sdr-input sm" type="number" min={0} placeholder={label} value={v ?? ""} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} />
  );

  if (!lines.length) {
    return (
      <section className="cm-empty"><h3>{m.empty}</h3><p>{m.emptyLine}</p><Link className="sdr-btn primary" href="/outreach/new"><Plus />{m.create}</Link></section>
    );
  }

  return (
    <div className="cm">
      <div className="cm-toolbar" ref={bar}>
        <Link className="sdr-btn primary" href="/outreach/new"><Plus />{m.create}</Link>
        <label className="cm-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.search} aria-label={m.search} /></label>
        <div className="cm-wrap">
          <button type="button" className={`sdr-btn cm-toggle${activeFilters ? " on" : ""}`} onClick={() => setOpen(open === "filters" ? null : "filters")}><Filter />{m.filters}{activeFilters > 0 && <span className="sdr-count">{activeFilters}</span>}</button>
          {open === "filters" && (
            <div className="cm-pop cm-filters">
              <div><strong>{m.f.status}</strong><div className="cm-chips">{STATUSES.map((s) => chip(filters.status, s, (x) => setFilters({ ...filters, status: x }), t.camp.status[s]))}</div></div>
              <div><strong>{m.f.objective}</strong><div className="cm-chips">{OBJECTIVES.map((s) => chip(filters.objective, s, (x) => setFilters({ ...filters, objective: x }), m.objectives[s]))}</div></div>
              <div><strong>{m.f.channel}</strong><div className="cm-chips">{chip(filters.channel, "email", (x) => setFilters({ ...filters, channel: x }), channelSpec("email")!.label[lang])}</div></div>
              {countries.length > 0 && <div><strong>{m.f.country}</strong><div className="cm-chips">{countries.map((c) => chip(filters.country, c, (x) => setFilters({ ...filters, country: x }), countryLabel(c, locale)))}</div></div>}
              {members.length > 1 && <div><strong>{m.f.owner}</strong><div className="cm-chips">{members.map((u) => chip(filters.owner, u.id, (x) => setFilters({ ...filters, owner: x }), u.name))}</div></div>}
              <div><strong>{m.f.created}</strong><div className="cm-pair"><input className="sdr-input sm" type="date" aria-label={m.f.min} value={filters.createdFrom ?? ""} onChange={(e) => setFilters({ ...filters, createdFrom: e.target.value || undefined })} /><input className="sdr-input sm" type="date" aria-label={m.f.max} value={filters.createdTo ?? ""} onChange={(e) => setFilters({ ...filters, createdTo: e.target.value || undefined })} /></div></div>
              <div><strong>{m.f.spend}</strong><div className="cm-pair">{num(filters.spendMin, (x) => setFilters({ ...filters, spendMin: x }), m.f.min)}{num(filters.spendMax, (x) => setFilters({ ...filters, spendMax: x }), m.f.max)}</div></div>
              <div><strong>{m.f.contacted}</strong><div className="cm-pair">{num(filters.contactedMin, (x) => setFilters({ ...filters, contactedMin: x }), m.f.min)}{num(filters.contactedMax, (x) => setFilters({ ...filters, contactedMax: x }), m.f.max)}</div></div>
              <div><strong>{m.f.meetings}</strong><div className="cm-pair">{num(filters.meetingsMin, (x) => setFilters({ ...filters, meetingsMin: x }), m.f.min)}{num(filters.meetingsMax, (x) => setFilters({ ...filters, meetingsMax: x }), m.f.max)}</div></div>
              <button type="button" className="sdr-btn" onClick={() => setFilters(noFilters())}>{m.clearFilters}</button>
            </div>
          )}
        </div>
        <div className="cm-wrap">
          <button type="button" className="sdr-btn cm-toggle" onClick={() => setOpen(open === "range" ? null : "range")}>{m.ranges[range]}{range === "custom" && from ? ` · ${from} – ${to}` : ""}<ChevronDown /></button>
          {open === "range" && (
            <div className="cm-pop cm-range">
              {RANGE_PRESETS.filter((r) => r !== "custom").map((r) => <button key={r} type="button" className={r === range ? "on" : ""} onClick={() => setRange(r)}>{m.ranges[r]}</button>)}
              <div className="cm-custom"><strong>{m.ranges.custom}</strong>
                <div className="cm-pair"><input className="sdr-input sm" type="date" aria-label={m.from} value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} /><input className="sdr-input sm" type="date" aria-label={m.to} value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} /></div>
                <button type="button" className="sdr-btn primary" disabled={!custom.from || !custom.to} onClick={() => setRange("custom", custom.from, custom.to)}>{m.apply}</button></div>
            </div>
          )}
        </div>
        <button type="button" className="sdr-btn" disabled={pending} onClick={() => start(() => router.refresh())} title={fmt(m.updated, { time: updated })}><RefreshCw className={pending ? "spin" : ""} />{m.refresh}</button>
        <span className="cm-updated">{pending ? m.refreshing : fmt(m.updated, { time: updated })}</span>
        <div className="cm-spacer" />
        <div className="cm-wrap">
          <button type="button" className="sdr-btn cm-toggle" onClick={() => setOpen(open === "columns" ? null : "columns")}><Columns3 />{m.columns}</button>
          {open === "columns" && (
            <div className="cm-pop cm-columns">
              {[...columns, ...METRICS.map((x) => x.id).filter((id) => !columns.includes(id))].map((id) => {
                const mm = metric(id)!; const on = columns.includes(id); const i = columns.indexOf(id);
                return (
                  <div key={id} className="cm-col" title={mm.description[lang]}>
                    <label><input type="checkbox" checked={on} onChange={() => setColumns(on ? columns.filter((x) => x !== id) : [...columns, id])} />{mm.label[lang]}</label>
                    {on && <span>
                      <button type="button" aria-label={m.moveUp} disabled={i === 0} onClick={() => { const c = [...columns]; [c[i - 1], c[i]] = [c[i], c[i - 1]]; setColumns(c); }}><ArrowUp /></button>
                      <button type="button" aria-label={m.moveDown} disabled={i === columns.length - 1} onClick={() => { const c = [...columns]; [c[i + 1], c[i]] = [c[i], c[i + 1]]; setColumns(c); }}><ArrowDown /></button>
                      <button type="button" aria-label={pinned.includes(id) ? m.unpin : m.pin} className={pinned.includes(id) ? "on" : ""} onClick={() => setPinned(pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id])}><Pin /></button>
                    </span>}
                  </div>
                );
              })}
              <button type="button" className="sdr-btn" onClick={() => { setColumns(DEFAULT_COLUMNS); setPinned([]); }}>{m.resetColumns}</button>
            </div>
          )}
        </div>
        <select className="sdr-input sm" aria-label={m.breakdown} value={breakdown} onChange={(e) => setBreakdown(e.target.value as "none" | "audience")}>
          {(["none", "audience"] as const).map((b) => <option key={b} value={b}>{m.breakdown}: {m.breakdowns[b]}</option>)}
        </select>
        <button type="button" className="sdr-btn" onClick={() => exportCsv(shown)}><Download />{m.export}</button>
        <div className="cm-wrap">
          <button type="button" className="sdr-btn cm-toggle" onClick={() => setOpen(open === "views" ? null : "views")}><Bookmark />{m.views}</button>
          {open === "views" && (
            <div className="cm-pop cm-views">
              {!views.length && <p className="cm-muted">{m.noViews}</p>}
              {views.map((v) => (
                <div key={v.id} className="cm-view"><button type="button" onClick={() => { applyView(v); setOpen(null); }}>{v.name}</button>
                  <button type="button" aria-label={m.deleteView} onClick={() => run(() => deleteView(v.id))}><Trash2 /></button></div>
              ))}
              <button type="button" className="sdr-btn primary" onClick={() => {
                const name = prompt(m.viewName)?.trim();
                if (name) run(() => saveView(name, { columns, pinned, filters: filters as unknown as Record<string, unknown>, range, from, to, breakdown, sort: `${sort.key}:${sort.dir === 1 ? "asc" : "desc"}` }), () => setOpen(null));
              }}>{m.saveView}</button>
            </div>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="cm-bulk" role="toolbar" aria-label={fmt(m.selected, { n: String(selected.size) })}>
          <strong>{fmt(m.selected, { n: String(selected.size) })}</strong>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => setEditing(true)}>{m.edit}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("pause")}>{m.pause}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("resume")}>{m.resume}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("duplicate")}>{m.duplicate}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => setOnlySelected((x) => !x)}>{onlySelected ? m.showAll : m.compare}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => exportCsv(lines.filter((l) => selected.has(l.id)))}>{m.export}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("archive")}>{m.archive}</button>
          <button type="button" className="sdr-btn sm danger" disabled={pending} onClick={() => bulk("delete")}>{m.delete}</button>
          <button type="button" className="cm-x" aria-label={m.clearSelection} onClick={() => { setSelected(new Set()); setOnlySelected(false); }}><X /></button>
        </div>
      )}

      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              <th className="cm-check"><input type="checkbox" aria-label={m.selectAll} checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(shown.map((l) => l.id)))} /></th>
              <th className="cm-name">{head("name", m.colName)}</th>
              <th>{head("status", m.colStatus)}</th>
              <th>{m.colChannel}</th>
              {ordered.map((c) => <th key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`} title={c.description[lang]}>{head(c.id, c.label[lang])}</th>)}
              <th className="cm-actions" aria-label={m.edit} />
            </tr>
          </thead>
          <tbody>
            {!shown.length && <tr><td colSpan={ordered.length + 5} className="cm-none">{m.noMatch}</td></tr>}
            {shown.map((l) => {
              const open2 = breakdown === "audience" && expanded.has(l.id);
              return [
                <tr key={l.id} className={selected.has(l.id) ? "sel" : ""}>
                  <td className="cm-check"><input type="checkbox" aria-label={l.name} checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} /></td>
                  <td className="cm-name">
                    {breakdown === "audience" && l.groups.length > 0 && <button type="button" className="cm-expand" aria-expanded={open2} onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}><ChevronRight className={open2 ? "rot" : "flip-rtl"} /></button>}
                    {renaming?.id === l.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); run(() => renameCampaign(l.id, renaming.name), () => setRenaming(null)); }}>
                        <input className="sdr-input sm" autoFocus dir="auto" value={renaming.name} maxLength={160} onChange={(e) => setRenaming({ id: l.id, name: e.target.value })} onBlur={() => setRenaming(null)} />
                      </form>
                    ) : (
                      <span className="cm-name-cell"><Link href={`/outreach/${l.id}`} dir="auto">{l.name}</Link><small>{m.objectives[l.objective]}{l.ownerId && members.length > 1 ? ` · ${memberName(l.ownerId)}` : ""}</small></span>
                    )}
                  </td>
                  <td><span className={`cd-status st-${l.status}`}>{t.camp.status[l.status]}</span></td>
                  <td>{l.channels.map((c) => channelSpec(c)?.label[lang] ?? c).join(" + ")}</td>
                  {ordered.map((c) => <td key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`}>{formatMetric(c.compute(l.counts), c.format, lang)}</td>)}
                  <td className="cm-actions">
                    <div className="cm-wrap">
                      <button type="button" className="sdr-icon-btn cm-toggle" aria-label={m.edit} aria-expanded={menu === l.id} onClick={() => setMenu(menu === l.id ? null : l.id)}><MoreHorizontal /></button>
                      {menu === l.id && (
                        <div className="cm-menu" role="menu">
                          <Link role="menuitem" href={`/outreach/${l.id}`}>{m.view}</Link>
                          <Link role="menuitem" href={`/outreach/${l.id}?tab=settings`}>{m.edit}</Link>
                          <button role="menuitem" type="button" onClick={() => { setRenaming({ id: l.id, name: l.name }); setMenu(null); }}>{m.rename}</button>
                          <button role="menuitem" type="button" onClick={() => bulk("duplicate", [l.id])}>{m.duplicate}</button>
                          {l.status === "active" && <button role="menuitem" type="button" onClick={() => bulk("pause", [l.id])}>{m.pause}</button>}
                          {l.status === "paused" && l.approved && <button role="menuitem" type="button" onClick={() => bulk("resume", [l.id])}>{m.resume}</button>}
                          {l.status !== "archived" && <button role="menuitem" type="button" onClick={() => bulk("archive", [l.id])}>{m.archive}</button>}
                          {l.status === "draft" && <button role="menuitem" type="button" className="danger" onClick={() => bulk("delete", [l.id])}>{m.delete}</button>}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>,
                ...(open2 ? l.groups.map((g) => (
                  <tr key={g.id} className="cm-group">
                    <td /><td className="cm-name"><span className="cm-name-cell sub" dir="auto">{g.name}</span></td>
                    <td><span className={`cd-status st-${g.status}`}>{t.camp.groups.status[g.status]}</span></td><td />
                    {ordered.map((c) => <td key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`}>{formatMetric(c.compute(g.counts), c.format, lang)}</td>)}
                    <td />
                  </tr>
                )) : []),
              ];
            })}
          </tbody>
          {shown.length > 1 && (
            <tfoot>
              <tr><td /><td className="cm-name"><strong>{m.total}</strong></td><td /><td />
                {ordered.map((c) => <td key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`}><strong>{formatMetric(c.compute(totals), c.format, lang)}</strong></td>)}<td /></tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="cm-muted cm-foot">{m.unavailable}</p>

      {editing && <BulkEdit n={selected.size} members={members} onClose={() => setEditing(false)} onSave={(patch) => run(() => bulkEdit([...selected], patch), () => setEditing(false))} pending={pending} />}
    </div>
  );
}

function BulkEdit({ n, members, onClose, onSave, pending }: { n: number; members: { id: string; name: string }[]; onClose: () => void; onSave: (p: { ownerId?: string; endsAt?: string | null; dailyLimit?: number | null; budgetUsd?: number | null }) => void; pending: boolean }) {
  const { t } = useI18n();
  const m = t.camp.manager;
  const [owner, setOwner] = useState("");
  const [end, setEnd] = useState("");
  const [daily, setDaily] = useState("");
  const [budget, setBudget] = useState("");
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={fmt(m.bulkEdit, { n: String(n) })} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cm-edit">
        <h3>{fmt(m.bulkEdit, { n: String(n) })}</h3>
        <label>{m.owner}<select className="form-input" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">{m.keep}</option>{members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label>{m.endDate}<input className="form-input" type="date" value={end} placeholder={m.keep} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>{m.daily}<input className="form-input" type="number" min={1} max={500} placeholder={m.keep} value={daily} onChange={(e) => setDaily(e.target.value)} /></label>
        <label>{m.budget}<input className="form-input" type="number" min={0} placeholder={m.keep} value={budget} onChange={(e) => setBudget(e.target.value)} /></label>
        <div className="cm-edit-actions">
          <button type="button" className="sdr-btn" onClick={onClose}>{t.ws.common.cancel}</button>
          <button type="button" className="sdr-btn primary" disabled={pending} onClick={() => onSave({
            ...(owner ? { ownerId: owner } : {}), ...(end ? { endsAt: new Date(`${end}T23:59:00`).toISOString() } : {}),
            ...(daily ? { dailyLimit: Number(daily) } : {}), ...(budget ? { budgetUsd: Number(budget) } : {}),
          })}>{m.save}</button>
        </div>
      </div>
    </div>
  );
}
