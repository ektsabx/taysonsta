"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Bookmark, ChevronDown, Columns3, Download, Filter, Folder, Mail, MoreHorizontal, Pin, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { METRICS, DEFAULT_COLUMNS, RANGE_PRESETS, cleanColumns, formatMetric, metric, zeroCounts, addCounts, type Counts, type RangePreset } from "@/lib/campaigns/metrics";
import { countryLabel, formatNumber } from "@/lib/format";
import { bulkCampaigns, bulkEdit, deleteView, renameCampaign, saveView } from "@/app/(app)/outreach/manager-actions";
import { groupAction } from "@/app/(app)/outreach/[id]/actions";
import type { CampaignLine } from "@/services/campaign-table";

// Campaigns, after Facebook Ads Manager (owner, 2026-10-31, D-272, D-273):
// three levels in three tabs: Campaigns, Audiences (like ad sets) and
// Messages (each audience's openings, like ads). Selecting campaigns narrows
// the other two tabs to them. A toolbar (create, search, filters, date range,
// refresh, columns, export, saved views), metric columns from the registry,
// bulk actions on campaigns, a row menu and totals. The date range and
// refresh go to the server; everything else filters what came back.

type Level = "campaigns" | "audiences" | "messages";
type Filters = { status: string[]; country: string[]; owner: string[]; createdFrom?: string; createdTo?: string; spendMin?: number; spendMax?: number; meetingsMin?: number; meetingsMax?: number };
const noFilters = (): Filters => ({ status: [], country: [], owner: [] });
const STATUSES = ["draft", "scheduled", "active", "paused", "completed", "failed", "archived"] as const;
const PREF_KEY = "yolias:campaign-columns:v2";

interface View { id: string; name: string; config: { columns?: string[]; pinned?: string[]; filters?: Partial<Filters>; range?: string; from?: string; to?: string; sort?: string; level?: Level } }
interface Row { id: string; level: Level; name: string; sub: string; status: string; statusLabel: string; href: string; counts: Counts; campaignId: string; approved: boolean; groupStatus?: string; perDay?: number | null }

export function CampaignsManager({ lines, members, views, range, from, to, refreshedAt }: {
  lines: CampaignLine[]; members: { id: string; name: string }[]; views: View[]; range: RangePreset; from: string; to: string; refreshedAt: string;
}) {
  const { t, locale } = useI18n();
  const m = t.ag.manager;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [level, setLevel] = useState<Level>("campaigns");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters());
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [pinned, setPinned] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [open, setOpen] = useState<"filters" | "columns" | "views" | "range" | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState({ from, to });
  const n = (v: number) => formatNumber(v, locale);

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

  // Campaigns after the filters; the other levels come from them (and from the selection, like Ads Manager).
  const campaigns = useMemo(() => {
    const between = (v: number, a?: number, b?: number) => (a == null || v >= a) && (b == null || v <= b);
    return lines.filter((l) =>
      (!filters.status.length ? l.status !== "archived" : filters.status.includes(l.status)) &&
      (!filters.country.length || l.countries.some((c) => filters.country.includes(c))) &&
      (!filters.owner.length || filters.owner.includes(l.ownerId ?? "")) &&
      (!filters.createdFrom || l.createdAt.slice(0, 10) >= filters.createdFrom) &&
      (!filters.createdTo || l.createdAt.slice(0, 10) <= filters.createdTo) &&
      between(l.counts.spendUsd, filters.spendMin, filters.spendMax) &&
      between(l.counts.meetings, filters.meetingsMin, filters.meetingsMax));
  }, [lines, filters]);
  const scope = selected.size && level !== "campaigns" ? campaigns.filter((l) => selected.has(l.id)) : campaigns;

  const rows: Row[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base: Row[] = level === "campaigns"
      ? campaigns.filter((l) => !onlySelected || selected.has(l.id)).map((l) => ({
        id: l.id, level, name: l.name, sub: [l.ownerId && members.length > 1 ? memberName(l.ownerId) : "", fmt(t.ag.manager.colPerDay, { n: String(l.dailyLimit ?? 30) })].filter(Boolean).join(" · "),
        status: l.status, statusLabel: t.ag.status[l.status], href: `/outreach/${l.id}`, counts: l.counts, campaignId: l.id, approved: l.approved, perDay: l.dailyLimit,
      }))
      : level === "audiences"
        ? scope.flatMap((l) => l.groups.map((g) => ({
          id: g.id, level, name: g.name, sub: l.name, status: l.status === "active" ? g.status : l.status, statusLabel: l.status === "active" ? t.ag.groupStatus[g.status] : t.ag.status[l.status],
          href: `/outreach/${l.id}?tab=audiences`, counts: g.counts, campaignId: l.id, approved: l.approved, groupStatus: g.status,
        })))
        : scope.flatMap((l) => l.groups.flatMap((g) => g.openings.map((o) => ({
          id: o.key, level, name: `${t.ag.builder.message[o.variant === "a" ? "angleA" : "angleB"]} · ${g.name}`, sub: o.text, status: l.status, statusLabel: t.ag.status[l.status],
          href: `/outreach/${l.id}?tab=messages`, counts: o.counts, campaignId: l.id, approved: l.approved,
        }))));
    const hit = base.filter((r) => !s || r.name.toLowerCase().includes(s) || r.sub.toLowerCase().includes(s));
    const val = (r: Row) => sort.key === "name" ? r.name.toLowerCase() : sort.key === "status" ? r.status : sort.key === "created" ? 0 : metric(sort.key)?.compute(r.counts) ?? -Infinity;
    return sort.key === "created" ? hit : [...hit].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, campaigns, scope, q, sort, onlySelected, selected, lang]);

  const totals = useMemo(() => rows.reduce<Counts>((s, r) => addCounts(s, r.counts), zeroCounts()), [rows]);
  const activeFilters = filters.status.length + filters.country.length + filters.owner.length
    + [filters.createdFrom, filters.createdTo, filters.spendMin, filters.spendMax, filters.meetingsMin, filters.meetingsMax].filter((x) => x != null && x !== "").length;

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
    const k = String(list.length);
    if (action === "pause" && list.length > 1 && !confirm(fmt(m.confirmPause, { n: k }))) return;
    if (action === "archive" && !confirm(fmt(m.confirmArchive, { n: k }))) return;
    if (action === "delete" && !confirm(fmt(m.confirmDelete, { n: k }))) return;
    run(() => bulkCampaigns(list, action), () => { setSelected(new Set()); setMenu(null); });
  };
  const exportCsv = (list: Row[]) => {
    const head = [m.colName, level === "campaigns" ? m.colStatus : m.colCampaign, ...ordered.map((c) => c.label[lang])];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const body = list.map((r) => [r.name, level === "campaigns" ? r.statusLabel : r.sub, ...ordered.map((c) => formatMetric(c.compute(r.counts), c.format, lang))].map(esc).join(","));
    const blob = new Blob([`﻿${[head.map(esc).join(","), ...body].join("\n")}`], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `yolias-${level}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const applyView = (v: View) => {
    const c = v.config;
    setColumns(cleanColumns(c.columns ?? DEFAULT_COLUMNS)); setPinned(cleanColumns(c.pinned ?? []));
    setFilters({ ...noFilters(), ...(c.filters ?? {}) });
    if (c.level) setLevel(c.level);
    if (c.sort) { const [key, dir] = c.sort.split(":"); setSort({ key, dir: dir === "asc" ? 1 : -1 }); }
    setRange((c.range as RangePreset) ?? "lifetime", c.from ?? "", c.to ?? "");
  };
  const toggleSel = (id: string) => setSelected((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });
  const allOn = level === "campaigns" && rows.length > 0 && rows.every((r) => selected.has(r.id));
  const updated = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(refreshedAt));
  const head = (key: string, label: string) => (
    <button type="button" className="cm-sort" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {label}{sort.key === key && (sort.dir === 1 ? <ArrowUp /> : <ArrowDown />)}
    </button>
  );
  const chip = (list: string[], v: string, set: (x: string[]) => void, label: string) => (
    <button key={v} type="button" className={`cm-chip${list.includes(v) ? " on" : ""}`} onClick={() => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])}>{label}</button>
  );
  const numIn = (v: number | undefined, set: (x: number | undefined) => void, label: string) => (
    <input className="sdr-input sm" type="number" min={0} placeholder={label} value={v ?? ""} onChange={(e) => set(e.target.value === "" ? undefined : Number(e.target.value))} />
  );
  const counts = { campaigns: campaigns.length, audiences: scope.reduce((s, l) => s + l.groups.length, 0), messages: scope.reduce((s, l) => s + l.groups.reduce((x, g) => x + g.openings.length, 0), 0) };

  if (!lines.length) {
    return (
      <section className="cm-empty"><Folder /><h3>{m.empty}</h3><p>{m.emptyLine}</p><Link className="sdr-btn primary" href="/outreach/new"><Plus />{m.create}</Link></section>
    );
  }

  return (
    <div className="cm">
      <div className="cm-levels" role="tablist">
        {(["campaigns", "audiences", "messages"] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={level === k} className={`cm-level${level === k ? " on" : ""}`} onClick={() => setLevel(k)}>
            {k === "campaigns" ? <Folder /> : k === "audiences" ? <Users /> : <Mail />}{m.tabs[k]}<span className="n">{n(counts[k])}</span>
          </button>
        ))}
        {level !== "campaigns" && selected.size > 0 && (
          <span className="cm-scope">{fmt(m.selectedHint, { n: String(selected.size) })}<button type="button" onClick={() => setSelected(new Set())}>{m.showAllLevels}</button></span>
        )}
      </div>

      <div className="cm-toolbar">
        <Link className="sdr-btn primary" href="/outreach/new"><Plus />{m.create}</Link>
        <label className="cm-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.search} aria-label={m.search} /></label>
        <div className="cm-wrap">
          <button type="button" className={`sdr-btn cm-toggle${activeFilters ? " on" : ""}`} onClick={() => setOpen(open === "filters" ? null : "filters")}><Filter />{m.filters}{activeFilters > 0 && <span className="sdr-count">{activeFilters}</span>}</button>
          {open === "filters" && (
            <div className="cm-pop cm-filters">
              <div><strong>{m.f.status}</strong><div className="cm-chips">{STATUSES.map((s) => chip(filters.status, s, (x) => setFilters({ ...filters, status: x }), t.ag.status[s]))}</div></div>
              {countries.length > 0 && <div><strong>{m.f.country}</strong><div className="cm-chips">{countries.map((c) => chip(filters.country, c, (x) => setFilters({ ...filters, country: x }), countryLabel(c, locale)))}</div></div>}
              {members.length > 1 && <div><strong>{m.f.owner}</strong><div className="cm-chips">{members.map((u) => chip(filters.owner, u.id, (x) => setFilters({ ...filters, owner: x }), u.name))}</div></div>}
              <div><strong>{m.f.created}</strong><div className="cm-pair"><input className="sdr-input sm" type="date" aria-label={m.f.min} value={filters.createdFrom ?? ""} onChange={(e) => setFilters({ ...filters, createdFrom: e.target.value || undefined })} /><input className="sdr-input sm" type="date" aria-label={m.f.max} value={filters.createdTo ?? ""} onChange={(e) => setFilters({ ...filters, createdTo: e.target.value || undefined })} /></div></div>
              <div><strong>{m.f.spend}</strong><div className="cm-pair">{numIn(filters.spendMin, (x) => setFilters({ ...filters, spendMin: x }), m.f.min)}{numIn(filters.spendMax, (x) => setFilters({ ...filters, spendMax: x }), m.f.max)}</div></div>
              <div><strong>{m.f.meetings}</strong><div className="cm-pair">{numIn(filters.meetingsMin, (x) => setFilters({ ...filters, meetingsMin: x }), m.f.min)}{numIn(filters.meetingsMax, (x) => setFilters({ ...filters, meetingsMax: x }), m.f.max)}</div></div>
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
        <button type="button" className="sdr-btn" onClick={() => exportCsv(rows)}><Download />{m.export}</button>
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
                if (name) run(() => saveView(name, { columns, pinned, filters: filters as unknown as Record<string, unknown>, range, from, to, level, sort: `${sort.key}:${sort.dir === 1 ? "asc" : "desc"}` }), () => setOpen(null));
              }}>{m.saveView}</button>
            </div>
          )}
        </div>
      </div>

      {level === "campaigns" && selected.size > 0 && (
        <div className="cm-bulk" role="toolbar" aria-label={fmt(m.selected, { n: String(selected.size) })}>
          <strong>{fmt(m.selected, { n: String(selected.size) })}</strong>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => setEditing(true)}>{m.edit}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("pause")}>{m.pause}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("resume")}>{m.resume}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("duplicate")}>{m.duplicate}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => setOnlySelected((x) => !x)}>{onlySelected ? m.showAll : m.compare}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => setLevel("audiences")}>{m.tabs.audiences}</button>
          <button type="button" className="sdr-btn sm" disabled={pending} onClick={() => bulk("archive")}>{m.archive}</button>
          <button type="button" className="sdr-btn sm danger" disabled={pending} onClick={() => bulk("delete")}>{m.delete}</button>
          <button type="button" className="cm-x" aria-label={m.clearSelection} onClick={() => { setSelected(new Set()); setOnlySelected(false); }}><X /></button>
        </div>
      )}

      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              {level === "campaigns" && <th className="cm-check"><input type="checkbox" aria-label={m.tabs.campaigns} checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
              <th className="cm-name">{head("name", level === "campaigns" ? m.colName : level === "audiences" ? m.colAudience : m.colOpening)}</th>
              <th>{head("status", m.colStatus)}</th>
              {ordered.map((c) => <th key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`} title={c.description[lang]}>{head(c.id, c.label[lang])}</th>)}
              <th className="cm-actions" aria-label={m.edit} />
            </tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td colSpan={ordered.length + 4} className="cm-none">{level === "audiences" ? m.noAudiences : level === "messages" ? m.noMessages : m.noMatch}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={level === "campaigns" && selected.has(r.id) ? "sel" : ""}>
                {level === "campaigns" && <td className="cm-check"><input type="checkbox" aria-label={r.name} checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} /></td>}
                <td className="cm-name">
                  {renaming?.id === r.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); run(() => renameCampaign(r.id, renaming.name), () => setRenaming(null)); }}>
                      <input className="sdr-input sm" autoFocus dir="auto" value={renaming.name} maxLength={160} onChange={(e) => setRenaming({ id: r.id, name: e.target.value })} onBlur={() => setRenaming(null)} />
                    </form>
                  ) : (
                    <span className="cm-name-cell"><Link href={r.href} dir="auto">{r.name}</Link><small dir="auto" className={level === "messages" ? "cm-clip" : ""}>{r.sub}</small></span>
                  )}
                </td>
                <td><span className={`cd-status st-${r.status}`}>{r.statusLabel}</span></td>
                {ordered.map((c) => <td key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`}>{formatMetric(c.compute(r.counts), c.format, lang)}</td>)}
                <td className="cm-actions">
                  <div className="cm-wrap">
                    <button type="button" className="sdr-icon-btn cm-toggle" aria-label={m.edit} aria-expanded={menu === r.id} onClick={() => setMenu(menu === r.id ? null : r.id)}><MoreHorizontal /></button>
                    {menu === r.id && (
                      <div className="cm-menu" role="menu">
                        <Link role="menuitem" href={r.href}>{m.view}</Link>
                        {level === "campaigns" && <>
                          <Link role="menuitem" href={r.status === "draft" ? `/outreach/new?draft=${r.id}` : `/outreach/${r.id}/edit`}>{m.edit}</Link>
                          <button role="menuitem" type="button" onClick={() => { setRenaming({ id: r.id, name: r.name }); setMenu(null); }}>{m.rename}</button>
                          <button role="menuitem" type="button" onClick={() => bulk("duplicate", [r.id])}>{m.duplicate}</button>
                          {r.status === "active" && <button role="menuitem" type="button" onClick={() => bulk("pause", [r.id])}>{m.pause}</button>}
                          {r.status === "paused" && r.approved && <button role="menuitem" type="button" onClick={() => bulk("resume", [r.id])}>{m.resume}</button>}
                          {r.status !== "archived" && <button role="menuitem" type="button" onClick={() => bulk("archive", [r.id])}>{m.archive}</button>}
                          {r.status === "draft" && <button role="menuitem" type="button" className="danger" onClick={() => bulk("delete", [r.id])}>{m.delete}</button>}
                        </>}
                        {level === "audiences" && r.groupStatus === "active" && <button role="menuitem" type="button" onClick={() => run(() => groupAction(r.id, "pause"), () => setMenu(null))}>{m.pause}</button>}
                        {level === "audiences" && r.groupStatus === "paused" && <button role="menuitem" type="button" onClick={() => run(() => groupAction(r.id, "resume"), () => setMenu(null))}>{m.resume}</button>}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 && (
            <tfoot>
              <tr>{level === "campaigns" && <td />}<td className="cm-name"><strong>{m.total}</strong></td><td />
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
  const m = t.ag.manager;
  const [owner, setOwner] = useState("");
  const [end, setEnd] = useState("");
  const [daily, setDaily] = useState("");
  const [budget, setBudget] = useState("");
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={fmt(m.bulkEdit, { n: String(n) })} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cm-edit">
        <h3>{fmt(m.bulkEdit, { n: String(n) })}</h3>
        {members.length > 1 && <label>{m.owner}<select className="form-input" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">{m.keep}</option>{members.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}
        <label>{m.endDate}<input className="form-input" type="date" value={end} placeholder={m.keep} onChange={(e) => setEnd(e.target.value)} /></label>
        <label>{m.daily}<input className="form-input" type="number" min={1} max={500} placeholder={m.keep} value={daily} onChange={(e) => setDaily(e.target.value)} /></label>
        <label>{m.budget}<span className="cb-money"><span aria-hidden>$</span><input className="form-input" type="number" min={0} placeholder={m.keep} value={budget} onChange={(e) => setBudget(e.target.value)} /></span></label>
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
