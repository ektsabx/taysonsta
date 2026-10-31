"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Copy, Square } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useRun } from "@/components/app/ws/bits";
import { duplicateCampaign, runOutreach, updateCampaignSchedule } from "@/app/(app)/outreach/actions";
import type { CampaignMetrics } from "@/services/campaign-metrics";

// A campaign's results (D-270), below its sending numbers: what it produced
// (found → qualified meetings → customers), what it cost and returned, the
// plan and the forecast (labelled, null without data), what Yolias did, and
// the controls: edit target / dates / limit, duplicate, end.

type Activity = { id: number; kind: string; body: string; at: string };

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (d: string, end = false) => (d ? new Date(`${d}T${end ? "23:59:00" : "00:00:00"}`).toISOString() : null);

export function CampaignResults({ m, activity, dailyLimit }: { m: CampaignMetrics; activity: Activity[]; dailyLimit: number | null }) {
  const { t, locale } = useI18n();
  const p = t.camp.perf;
  const router = useRouter();
  const { run, pending } = useRun();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(m.target ? String(m.target) : "");
  const [start, setStart] = useState(day(m.startsAt));
  const [end, setEnd] = useState(day(m.endsAt));
  const [daily, setDaily] = useState(dailyLimit ? String(dailyLimit) : "");
  const n = (v: number) => formatNumber(v, locale);
  const usd = (v: number | null) => (v == null ? "–" : new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 2 : 0 }).format(v));
  const ended = m.status === "completed" || m.status === "archived";

  const funnel: [string, number][] = [
    [p.found, m.found], [p.qualifiedProspects, m.strongMatch], [p.positive, m.positive], [p.requests, m.requests],
    [p.booked, m.booked], [p.held, m.held], [p.qualified, m.qualified], [p.customers, m.customers],
  ];
  const costs: [string, string][] = [
    [p.spend, usd(m.costs.spendUsd)], [p.perProspect, usd(m.costs.perProspect)], [p.perPositive, usd(m.costs.perPositive)],
    [p.perMeeting, usd(m.costs.perMeeting)], [p.perQualified, usd(m.costs.perQualified)], [p.revenue, usd(m.revenueUsd)],
    [p.roi, m.costs.roi == null ? "–" : `${Math.round(m.costs.roi * 100)}%`],
  ];
  const when = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

  return (
    <section className="sdr-panel cr">
      <div className="sdr-panel-head">
        <div><div className="sdr-panel-title">{p.title}</div>{m.target ? <div className="sdr-panel-sub">{t.camp.kinds.target}: {n(m.target)} · <span className={`cd-pace pace-${m.pace}`}>{t.camp.pace[m.pace]}</span></div> : null}</div>
        <div className="sdr-head-actions">
          {!ended && <button type="button" className="sdr-btn" disabled={pending} onClick={() => setEditing((e) => !e)}><CalendarClock />{p.schedule}</button>}
          <button type="button" className="sdr-btn" disabled={pending} onClick={() => run(() => duplicateCampaign(m.id), { onOk: (r) => router.push(`/outreach/${r.id}`), refresh: false })}><Copy />{p.duplicate}</button>
          {!ended && <button type="button" className="sdr-btn" disabled={pending} onClick={() => { if (confirm(p.endConfirm)) run(() => runOutreach(m.id, "end")); }}><Square />{p.end}</button>}
        </div>
      </div>
      <div className="sdr-panel-body pad cr-body">
        {m.failureReason && m.status === "paused" && <p className="ws-note">{m.failureReason}</p>}
        {editing && (
          <div className="cr-edit">
            <label className="ws-field"><span className="ws-label">{p.target}</span><input className="form-input" type="number" min={1} max={1000} value={target} onChange={(e) => setTarget(e.target.value)} /></label>
            <label className="ws-field"><span className="ws-label">{p.start}</span><input className="form-input" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="ws-field"><span className="ws-label">{p.endDate}</span><input className="form-input" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} /></label>
            <label className="ws-field"><span className="ws-label">{p.daily}</span><input className="form-input" type="number" min={1} max={500} value={daily} onChange={(e) => setDaily(e.target.value)} /></label>
            <button type="button" className="sdr-btn primary" disabled={pending} onClick={() => run(() => updateCampaignSchedule({
              id: m.id, target: target ? Number(target) : null, startsAt: toIso(start), endsAt: toIso(end, true), dailyLimit: daily ? Number(daily) : null,
            }), { onOk: () => setEditing(false) })}>{p.save}</button>
          </div>
        )}

        <div className="cr-funnel">
          {funnel.map(([label, value]) => <div key={label}><span>{label}</span><strong>{n(value)}</strong></div>)}
        </div>

        <div className="cr-two">
          <div>
            <h4>{p.plan} <span className="cd-badge">{t.camp.kinds.forecast}</span></h4>
            <p>{m.plan ? fmt(p.planLine, { n: n(m.plan.contactsNeeded), perDay: n(m.plan.perDay) }) : p.planNone}</p>
            <h4>{p.forecast} <span className="cd-badge">{t.camp.kinds.forecast}</span></h4>
            <p>{m.forecast ? fmt(p.forecastLine, { low: n(m.forecast.low), high: n(m.forecast.high), mid: n(m.forecast.mid) }) : p.forecastNone}</p>
            {m.sharedWorkspaces > 0 && <p className="cr-small">{fmt(p.shared, { n: n(m.sharedWorkspaces) })}</p>}
          </div>
          <div>
            <h4>{p.spend} <span className="cd-badge">{t.camp.kinds.actual}</span></h4>
            <dl className="cr-costs">{costs.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <p className="cr-small">{p.spendNote}</p>
            <p className="cr-small">{p.revenueNote}</p>
          </div>
        </div>

        <div>
          <h4>{p.activity}</h4>
          {activity.length ? <ul className="cd-activity cr-activity">{activity.map((a) => <li key={a.id}><time>{when(a.at)}</time><span dir="auto">{a.body}</span></li>)}</ul> : <p className="cr-small">{p.activityEmpty}</p>}
        </div>
      </div>
    </section>
  );
}
