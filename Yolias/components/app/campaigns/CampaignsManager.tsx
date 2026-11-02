"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronDown, Columns3, Download, Filter, Folder, Layers, Mail, MoreHorizontal, Pin, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { METRICS, DEFAULT_COLUMNS, OBJECTIVES, PRESETS, customMetric, formatMetric, metric, zeroCounts, addCounts, type Counts, type CustomMetricDef, type Metric, type MetricFormat, type Objective, type RangePreset } from "@/lib/campaigns/metrics";
import { countryLabel, formatNumber } from "@/lib/format";
import { bulkCampaigns, bulkEdit, createCustomMetric, deleteCustomMetric, renameCampaign } from "@/app/(app)/outreach/manager-actions";
import { groupAction } from "@/app/(app)/outreach/[id]/actions";
import { runOutreach } from "@/app/(app)/outreach/actions";
import type { CampaignLine } from "@/services/campaign-table";
import { DateRange } from "@/components/app/campaigns/DateRange";
import { xlsx } from "@/lib/xlsx";
import type { BreakRow, Dimension } from "@/services/campaign-detail";

// Campaigns, after Facebook Ads Manager (owner, 2026-10-31, D-272, D-273):
// three levels in three tabs: Campaigns, Audiences (like ad sets) and
// Messages (each audience's openings, like ads). Selecting campaigns narrows
// the other two tabs to them. A toolbar (create, search, filters, date range,
// columns, export, refresh last), metric columns from the registry, an on/off
// switch per row, bulk actions on campaigns, a row menu and totals. The date
// range and refresh go to the server; everything else filters what came back.
// D-274: no saved views (owner, 2026-11-02); inside one campaign (scope) the
// same table shows its audiences and messages, with a breakdown, like an ads
// manager's campaign view.

type Level = "campaigns" | "audiences" | "messages";
type Filters = { status: string[]; country: string[]; owner: string[]; createdFrom?: string; createdTo?: string; spendMin?: number; spendMax?: number; meetingsMin?: number; meetingsMax?: number };
const noFilters = (): Filters => ({ status: [], country: [], owner: [] });
const STATUSES = ["draft", "scheduled", "active", "paused", "completed", "failed", "archived"] as const;
const PREF_KEY = "yolias:campaign-columns:v2";

interface Row { id: string; level: Level; name: string; sub: string; status: string; statusLabel: string; href: string; counts: Counts; campaignId: string; approved: boolean; groupStatus?: string; perDay?: number | null; badge?: string | null }
type Breakdown = Exclude<Dimension, "step"> | "none";
// Breakdown rows carry message counts only: the money and search columns don't apply to them.
const BREAKDOWN_METRICS = new Set(["sent", "contacted", "open_rate", "opened", "reply_rate", "replies", "no_reply", "open_to_reply", "interested", "positive_rate", "meetings", "held", "show_rate", "meeting_rate", "delivery_rate", "bounced"]);

export function CampaignsManager({ lines, members, range, from, to, refreshedAt, scope: inCampaign, breakdowns, custom = [], objective }: {
  lines: CampaignLine[]; members: { id: string; name: string }[]; range: RangePreset; from: string; to: string; refreshedAt: string;
  /** D-274: the workspace's custom metrics, and (inside a campaign) its objective for the ready columns. */
  custom?: CustomMetricDef[]; objective?: Objective;
  /** D-274: inside one campaign: only its audiences and messages. */
  scope?: { campaignId: string; editHref: string } | null;
  breakdowns?: Record<Dimension, BreakRow[]> | null;
}) {
  const { t, locale } = useI18n();
  const m = t.ag.manager;
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [level, setLevel] = useState<Level>(inCampaign ? "audiences" : "campaigns");
  const [breakdown, setBreakdown] = useState<Breakdown>("none");
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>(noFilters());
  // D-274: custom metrics are columns like the others.
  const customs = useMemo(() => custom.map(customMetric), [custom]);
  const mx = (id: string): Metric | null => customs.find((x) => x.id === id) ?? metric(id);
  const clean = (ids: unknown): string[] => (Array.isArray(ids) ? [...new Set(ids.filter((x): x is string => typeof x === "string" && Boolean(mx(x))))] : DEFAULT_COLUMNS);
  const initial = objective ? PRESETS[objective] : DEFAULT_COLUMNS;
  const [columns, setColumns] = useState<string[]>(initial);
  const [making, setMaking] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "created", dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);
  const [open, setOpen] = useState<"filters" | "columns" | "range" | "breakdown" | "export" | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const n = (v: number) => formatNumber(v, locale);

  // The member's own column choice is remembered in this browser (a convenience).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREF_KEY) ?? "null") as { columns?: string[]; pinned?: string[] } | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.columns && !objective) setColumns(clean(saved.columns));
      if (saved?.pinned) setPinned(clean(saved.pinned));
    } catch { /* storage unavailable */ }
    // Once, on load: the remembered columns (custom metrics known at that moment).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (objective) return; try { localStorage.setItem(PREF_KEY, JSON.stringify({ columns, pinned })); } catch { /* ignore */ } }, [columns, pinned, objective]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".cm-pop, .cm-menu, .cm-toggle")) { setOpen(null); setMenu(null); } };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const lang = locale === "ar" ? "ar" : "en";
  const ordered = [...columns.filter((c) => pinned.includes(c)), ...columns.filter((c) => !pinned.includes(c))].map((id) => mx(id)!).filter(Boolean);
  const memberName = (id: string | null) => members.find((x) => x.id === id)?.name ?? "";
  const countries = useMemo(() => [...new Set(lines.flatMap((l) => l.countries))].sort(), [lines]);

  // Campaigns after the filters; the other levels come from them (and from the selection, like Ads Manager).
  const campaigns = useMemo(() => {
    if (inCampaign) return lines.filter((l) => l.id === inCampaign.campaignId);
    const between = (v: number, a?: number, b?: number) => (a == null || v >= a) && (b == null || v <= b);
    return lines.filter((l) =>
      (!filters.status.length ? l.status !== "archived" : filters.status.includes(l.status)) &&
      (!filters.country.length || l.countries.some((c) => filters.country.includes(c))) &&
      (!filters.owner.length || filters.owner.includes(l.ownerId ?? "")) &&
      (!filters.createdFrom || l.createdAt.slice(0, 10) >= filters.createdFrom) &&
      (!filters.createdTo || l.createdAt.slice(0, 10) <= filters.createdTo) &&
      between(l.counts.spendUsd, filters.spendMin, filters.spendMax) &&
      between(l.counts.meetings, filters.meetingsMin, filters.meetingsMax));
  }, [lines, filters, inCampaign]);
  const scope = selected.size && level !== "campaigns" ? campaigns.filter((l) => selected.has(l.id)) : campaigns;

  // The optimizer's word on an audience (D-274): its share of the budget, or why it gets none.
  const O = t.ag.rx.opt;
  const CM = t.ag.rx.cm;
  const C = t.ag.rx.cp;
  const optLine = (g: CampaignLine["groups"][number]) => {
    if (g.status !== "active" || g.share == null) return "";
    if (g.share === 0 && (g.opt?.reason === "weaker" || g.opt?.reason === "over_cap")) return O.reasons[g.opt.reason];
    return fmt(O.share, { pct: `${Math.round(g.share * 100)}%` });
  };
  const rows: Row[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base: Row[] = level === "campaigns"
      ? campaigns.filter((l) => !onlySelected || selected.has(l.id)).map((l) => ({
        id: l.id, level, name: l.name, sub: [l.ownerId && members.length > 1 ? memberName(l.ownerId) : "", fmt(t.ag.manager.colPerDay, { n: String(l.dailyLimit ?? 30) })].filter(Boolean).join(" · "),
        status: l.status, statusLabel: t.ag.status[l.status], href: `/outreach/${l.id}`, counts: l.counts, campaignId: l.id, approved: l.approved, perDay: l.dailyLimit,
        badge: l.status === "active" && l.groups.some((g) => g.status === "active" && g.learning) ? t.ag.rx.opt.learning : null,
      }))
      : level === "audiences"
        ? scope.flatMap((l) => l.groups.map((g) => ({
          id: g.id, level, name: g.name, sub: [inCampaign ? "" : l.name, optLine(g)].filter(Boolean).join(" · "), status: l.status === "active" ? g.status : l.status, statusLabel: l.status === "active" ? t.ag.groupStatus[g.status] : t.ag.status[l.status],
          href: inCampaign ? inCampaign.editHref : `/outreach/${l.id}`, counts: g.counts, campaignId: l.id, approved: l.approved, groupStatus: g.status,
          badge: g.status === "active" && l.status === "active" && g.learning ? t.ag.rx.opt.learning : null,
        })))
        : scope.flatMap((l) => l.groups.flatMap((g) => g.openings.map((o) => ({
          id: o.key, level, name: `${t.ag.builder.message[o.variant === "a" ? "angleA" : "angleB"]} · ${g.name}`, sub: o.text, status: l.status, statusLabel: t.ag.status[l.status],
          href: inCampaign ? inCampaign.editHref : `/outreach/${l.id}`, counts: o.counts, campaignId: l.id, approved: l.approved,
        }))));
    const hit = base.filter((r) => !s || r.name.toLowerCase().includes(s) || r.sub.toLowerCase().includes(s));
    const val = (r: Row) => sort.key === "name" ? r.name.toLowerCase() : sort.key === "status" ? r.status : sort.key === "created" ? 0 : mx(sort.key)?.compute(r.counts) ?? -Infinity;
    return sort.key === "created" ? hit : [...hit].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, campaigns, scope, q, sort, onlySelected, selected, lang]);

  const totals = useMemo(() => rows.reduce<Counts>((s, r) => addCounts(s, r.counts), zeroCounts()), [rows]);
  const activeFilters = filters.status.length + filters.country.length + filters.owner.length
    + [filters.createdFrom, filters.createdTo, filters.spendMin, filters.spendMax, filters.meetingsMin, filters.meetingsMax].filter((x) => x != null && x !== "").length;


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
  // D-274: export as .csv or .xlsx (numbers stay numbers in the spreadsheet).
  const exportAs = (list: Row[], kind: "csv" | "xlsx") => {
    const head = [m.colName, level === "campaigns" ? m.colStatus : m.colCampaign, ...ordered.map((c) => c.label[lang])];
    const name = `yolias-${level}-${new Date().toISOString().slice(0, 10)}.${kind}`;
    let blob: Blob;
    if (kind === "csv") {
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const body = list.map((r) => [r.name, level === "campaigns" ? r.statusLabel : r.sub, ...ordered.map((c) => formatMetric(c.compute(r.counts), c.format, lang))].map(esc).join(","));
      blob = new Blob([`\ufeff${[head.map(esc).join(","), ...body].join("\n")}`], { type: "text/csv;charset=utf-8" });
    } else {
      const rowsOut = list.map((r) => [r.name, level === "campaigns" ? r.statusLabel : r.sub, ...ordered.map((c) => { const v = c.compute(r.counts); return v == null ? null : c.format === "pct" ? Math.round(v * 10000) / 100 : Math.round(v * 100) / 100; })]);
      blob = new Blob([xlsx(head, rowsOut, m.tabs[level]) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    setOpen(null);
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

  // On / off, like an ads manager (D-274): a running campaign or audience pauses; a paused one resumes (a campaign only once launched).
  const switchFor = (r: Row) => {
    const on = r.level === "campaigns" ? r.status === "active" || r.status === "scheduled" : r.groupStatus === "active";
    const can = r.level === "campaigns" ? (on || (r.status === "paused" && r.approved)) : r.groupStatus !== "archived" && !["archived", "completed", "draft"].includes(r.status);
    return (
      <button type="button" role="switch" aria-checked={on} aria-label={`${C.toggle}: ${r.name}`} className={`cm-sw${on ? " on" : ""}`} disabled={!can || pending}
        onClick={() => r.level === "campaigns" ? run(() => runOutreach(r.id, on ? "pause" : "resume")) : run(() => groupAction(r.id, on ? "pause" : "resume"))}><i /></button>
    );
  };
  // A breakdown (inside a campaign): one row per day, audience, opening, country, industry or job title, with the message columns.
  const brk = inCampaign && breakdowns && breakdown !== "none" ? breakdowns[breakdown] : null;
  const brkCounts = (b: BreakRow): Counts => ({ ...zeroCounts(), contacted: b.contacted, sent: b.sent, bounced: b.bounced, delivered: b.sent - b.bounced, replies: b.replies, interested: b.interested, meetings: b.meetings, held: b.held, opened: b.opened });
  const brkCols = ordered.filter((c) => BREAKDOWN_METRICS.has(c.id));

  if (!lines.length) {
    return (
      <section className="cm-empty"><Folder /><h3>{m.empty}</h3><p>{m.emptyLine}</p><Link className="sdr-btn primary" href="/outreach/new"><Plus />{m.create}</Link></section>
    );
  }

  return (
    <div className="cm">
      <div className="cm-levels" role="tablist">
        {(inCampaign ? (["audiences", "messages"] as const) : (["campaigns", "audiences", "messages"] as const)).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={level === k} className={`cm-level${level === k ? " on" : ""}`} onClick={() => setLevel(k)}>
            {k === "campaigns" ? <Folder /> : k === "audiences" ? <Users /> : <Mail />}{m.tabs[k]}<span className="n">{n(counts[k])}</span>
          </button>
        ))}
        {!inCampaign && level !== "campaigns" && selected.size > 0 && (
          <span className="cm-scope">{fmt(m.selectedHint, { n: String(selected.size) })}<button type="button" onClick={() => setSelected(new Set())}>{m.showAllLevels}</button></span>
        )}
      </div>

      <div className="cm-toolbar">
        {inCampaign ? <Link className="sdr-btn primary" href={inCampaign.editHref}><Plus />{t.ag.page.audiences.add}</Link> : <Link className="sdr-btn primary" href="/outreach/new"><Plus />{m.create}</Link>}
        <label className="cm-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={m.search} aria-label={m.search} /></label>
        {!inCampaign && <div className="cm-wrap">
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
        </div>}
        {inCampaign && breakdowns && (
          <div className="cm-wrap">
            <button type="button" className={`sdr-btn cm-toggle${breakdown !== "none" ? " on" : ""}`} onClick={() => setOpen(open === "breakdown" ? null : "breakdown")}><Layers />{C.breakdown}{breakdown !== "none" ? `: ${C.by[breakdown]}` : ""}<ChevronDown /></button>
            {open === "breakdown" && (
              <div className="cm-pop cm-range">
                {(["none", "day", "group", "variant", "country", "industry", "title"] as const).map((b) => <button key={b} type="button" className={b === breakdown ? "on" : ""} onClick={() => { setBreakdown(b); setOpen(null); }}>{C.by[b]}</button>)}
              </div>
            )}
          </div>
        )}
        <DateRange range={range} from={from} to={to} />
        <div className="cm-spacer" />
        <div className="cm-wrap">
          <button type="button" className="sdr-btn cm-toggle" onClick={() => setOpen(open === "columns" ? null : "columns")}><Columns3 />{m.columns}</button>
          {open === "columns" && (
            <div className="cm-pop cm-columns">
              <div className="cm-presets"><strong>{CM.presets}</strong><div className="cm-chips">{OBJECTIVES.map((o) => <button key={o} type="button" className="cm-chip" onClick={() => { setColumns(PRESETS[o]); setPinned([]); }}>{CM.presetNames[o]}</button>)}</div></div>
              {[...columns, ...[...METRICS, ...customs].map((x) => x.id).filter((id) => !columns.includes(id))].map((id) => {
                const mm = mx(id)!; const on = columns.includes(id); const i = columns.indexOf(id);
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
              <div className="cm-custom-list"><strong>{CM.custom}</strong>
                {custom.map((d) => <div key={d.id} className="cm-col"><span>{d.name}</span><button type="button" aria-label={CM.remove} onClick={() => run(() => deleteCustomMetric(d.id))}><Trash2 /></button></div>)}
                <button type="button" className="sdr-btn sm" onClick={() => { setMaking(true); setOpen(null); }}><Plus />{CM.create}</button>
              </div>
              <button type="button" className="sdr-btn" onClick={() => { setColumns(initial); setPinned([]); }}>{m.resetColumns}</button>
            </div>
          )}
        </div>
        <div className="cm-wrap">
          <button type="button" className="sdr-btn cm-toggle" aria-expanded={open === "export"} onClick={() => setOpen(open === "export" ? null : "export")}><Download />{m.export}<ChevronDown /></button>
          {open === "export" && (
            <div className="cm-pop cm-range">
              <button type="button" onClick={() => exportAs(rows, "csv")}>{t.ag.rx.cp.exportCsv}</button>
              <button type="button" onClick={() => exportAs(rows, "xlsx")}>{t.ag.rx.cp.exportXlsx}</button>
            </div>
          )}
        </div>
        <button type="button" className="sdr-btn cm-refresh" disabled={pending} onClick={() => start(() => router.refresh())} title={fmt(m.updated, { time: updated })}><RefreshCw className={pending ? "spin" : ""} /><span>{pending ? m.refreshing : fmt(m.updated, { time: updated })}</span></button>
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

      {brk ? (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead><tr><th className="cm-name">{C.by[breakdown as Exclude<Breakdown, "none">]}</th>{brkCols.map((c) => <th key={c.id} className="num" title={c.description[lang]}>{c.label[lang]}</th>)}</tr></thead>
            <tbody>
              {!brk.length && <tr><td colSpan={brkCols.length + 1} className="cm-none">{m.noMessages}</td></tr>}
              {brk.map((b) => <tr key={b.key}><td className="cm-name" dir="auto">{breakdown === "country" && b.key.length === 2 ? countryLabel(b.key, locale) : b.key}</td>{brkCols.map((c) => <td key={c.id} className="num">{formatMetric(c.compute(brkCounts(b)), c.format, lang)}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      ) : (
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              {level === "campaigns" && <th className="cm-check"><input type="checkbox" aria-label={m.tabs.campaigns} checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
              {level !== "messages" && <th className="cm-switch">On/Off</th>}
              <th className="cm-name">{head("name", level === "campaigns" ? m.colName : level === "audiences" ? m.colAudience : m.colOpening)}</th>
              <th>{head("status", m.colStatus)}</th>
              {ordered.map((c) => <th key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`} title={c.description[lang]}>{head(c.id, c.label[lang])}</th>)}
              <th className="cm-actions" aria-label={m.edit} />
            </tr>
          </thead>
          <tbody>
            {!rows.length && <tr><td colSpan={ordered.length + 5} className="cm-none">{level === "audiences" ? m.noAudiences : level === "messages" ? m.noMessages : m.noMatch}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={level === "campaigns" && selected.has(r.id) ? "sel" : ""}>
                {level === "campaigns" && <td className="cm-check"><input type="checkbox" aria-label={r.name} checked={selected.has(r.id)} onChange={() => toggleSel(r.id)} /></td>}
                {level !== "messages" && <td className="cm-switch">{switchFor(r)}</td>}
                <td className="cm-name">
                  {renaming?.id === r.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); run(() => renameCampaign(r.id, renaming.name), () => setRenaming(null)); }}>
                      <input className="sdr-input sm" autoFocus dir="auto" value={renaming.name} maxLength={160} onChange={(e) => setRenaming({ id: r.id, name: e.target.value })} onBlur={() => setRenaming(null)} />
                    </form>
                  ) : (
                    <span className="cm-name-cell"><span className="cm-name-row"><Link href={r.href} dir="auto">{r.name}</Link>{r.badge && <span className="cm-badge">{r.badge}</span>}</span><small dir="auto" className={level === "messages" ? "cm-clip" : ""}>{r.sub}</small></span>
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
              <tr>{level !== "messages" && <td />}{level === "campaigns" && <td />}<td className="cm-name"><strong>{m.total}</strong></td><td />
                {ordered.map((c) => <td key={c.id} className={`num${pinned.includes(c.id) ? " pinned" : ""}`}><strong>{formatMetric(c.compute(totals), c.format, lang)}</strong></td>)}<td /></tr>
            </tfoot>
          )}
        </table>
      </div>
      )}
      <p className="cm-muted cm-foot">{m.unavailable}</p>

      {making && <CustomMetricForm onClose={() => setMaking(false)} onSave={(d) => run(() => createCustomMetric(d), () => setMaking(false))} pending={pending} />}
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

function CustomMetricForm({ onClose, onSave, pending }: { onClose: () => void; onSave: (d: { name: string; a: string; op: "+" | "-" | "*" | "/"; b: string; format: MetricFormat }) => void; pending: boolean }) {
  const { t, locale } = useI18n();
  const CM = t.ag.rx.cm;
  const lang = locale === "ar" ? "ar" : "en";
  const [d, setD] = useState<{ name: string; a: string; op: "+" | "-" | "*" | "/"; b: string; format: MetricFormat }>({ name: "", a: "spend", op: "/", b: "site_visits", format: "usd" });
  const pick = (k: "a" | "b") => <select className="form-input" value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })}>{METRICS.map((x) => <option key={x.id} value={x.id}>{x.label[lang]}</option>)}</select>;
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={CM.create} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card cm-edit">
        <h3>{CM.create}</h3>
        <label>{CM.name}<input className="form-input" dir="auto" maxLength={60} placeholder={CM.namePh} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
        <label>{CM.formula}<span className="cm-formula">{pick("a")}<select className="form-input cm-op" value={d.op} onChange={(e) => setD({ ...d, op: e.target.value as "+" | "-" | "*" | "/" })}>{(["/", "*", "+", "-"] as const).map((o) => <option key={o} value={o}>{o === "/" ? "÷" : o === "*" ? "×" : o}</option>)}</select>{pick("b")}</span></label>
        <label>{CM.format}<select className="form-input" value={d.format} onChange={(e) => setD({ ...d, format: e.target.value as MetricFormat })}>{(["count", "pct", "usd", "ratio"] as const).map((f) => <option key={f} value={f}>{CM.formats[f]}</option>)}</select></label>
        <div className="cm-edit-actions">
          <button type="button" className="sdr-btn" onClick={onClose}>{CM.cancel}</button>
          <button type="button" className="sdr-btn primary" disabled={pending || !d.name.trim()} onClick={() => onSave(d)}>{CM.save}</button>
        </div>
      </div>
    </div>
  );
}
