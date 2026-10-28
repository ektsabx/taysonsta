"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Pause, Play, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { runOutreach, setOutreachStatus } from "@/app/(app)/outreach/actions";
import { RowMenu, Ring, useAgo } from "@/components/app/sdr/bits";
import type { CampaignSummary, CampaignView } from "@/services/campaigns";

const VIEW_TONE: Record<CampaignView, string> = { draft: "gray", active: "green", paused: "gray", completed: "blue", archived: "gray" };

/** The status chip of a campaign (Draft, Active, Paused, Completed, Archived). */
export function CampaignStatus({ view }: { view: CampaignView }) {
  const { t } = useI18n();
  return <span className={`sdr-badge ${VIEW_TONE[view]} sdr-status`}>{t.sdr.campaigns.views[view]}</span>;
}

// Campaigns (D-256, after AgentSDR Send campaigns): All / Active / Paused /
// Draft / Completed, a search, and one row per campaign with its progress
// ring, leads, sent, replies and last send.
export function CampaignList({ campaigns }: { campaigns: CampaignSummary[] }) {
  const { t, locale } = useI18n();
  const c = t.sdr.campaigns;
  const router = useRouter();
  const toast = useToast();
  const ago = useAgo();
  const [view, setView] = useState<"all" | CampaignView>("all");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const n = (v: number) => formatNumber(v, locale);
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US", { month: "short", day: "numeric" }).format(new Date(iso));
  const count = (v: CampaignView) => campaigns.filter((x) => x.view === v).length;
  const shown = campaigns.filter((x) => view === "all" || x.view === view)
    .filter((x) => !q || x.name.toLowerCase().includes(q.toLowerCase()));
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await fn();
    if (!r.ok) toast(r.error ?? t.ws.common.error, "error");
    router.refresh();
  });

  return (
    <section className="sdr-panel">
      <div className="sdr-panel-head">
        <div><div className="sdr-panel-title">{c.panelTitle}</div><div className="sdr-panel-sub">{c.panelSub}</div></div>
      </div>
      <div className="sdr-panel-body">
        <div className="sdr-panel-head" style={{ padding: "10px 12px 4px" }}>
          <div className="sdr-seg" role="tablist">
            {(["all", "active", "paused", "draft", "completed"] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "active" : ""} onClick={() => setView(v)}>
                {c.views[v]} <span className="n">{n(v === "all" ? campaigns.length : count(v))}</span>
              </button>
            ))}
          </div>
          <label className="sdr-search"><Search /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.search} aria-label={c.search} /></label>
        </div>
        <div className="sdr-table-wrap sdr-table-inset">
          <table className="sdr-table">
            <thead>
              <tr><th>{c.colCampaign}</th><th className="num">{c.colLeads}</th><th className="num">{c.colSent}</th><th>{c.colReplies}</th><th>{c.colLastSend}</th><th aria-label={t.sdr.common.more} /></tr>
            </thead>
            <tbody>
              {!shown.length && <tr><td colSpan={6} className="empty">{campaigns.length ? c.noMatch : c.empty}</td></tr>}
              {shown.map((x) => {
                const pct = x.leads ? (x.replied / x.leads) * 100 : 0;
                return (
                  <tr key={x.id} className="clickable" onClick={(e) => { if (!(e.target as HTMLElement).closest("a,button")) router.push(`/outreach/${x.id}`); }}>
                    <td>
                      <div className="sdr-who">
                        <Ring pct={x.donePct} done={x.view === "completed"} />
                        <div>
                          <span className="sdr-title-row" style={{ gap: 8 }}><Link className="sdr-cell-main" href={`/outreach/${x.id}`} dir="auto">{x.name}</Link><CampaignStatus view={x.view} /></span>
                          <span className="sdr-cell-sub">{fmt(x.steps === 1 ? c.oneStepCreated : c.stepsCreated, { steps: n(x.steps), date: date(x.createdAt) })}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num">{n(x.leads)}</td>
                    <td className="num">{n(x.sent)}</td>
                    <td style={{ minWidth: 200 }}>
                      <div className="sdr-bar-row"><span style={{ minWidth: 18 }}>{n(x.replied)}</span><span className="muted" style={{ minWidth: 48, fontSize: ".78rem" }}>{pct.toFixed(2)}%</span><span className="sdr-bar"><span style={{ width: `${Math.min(100, pct * 5)}%` }} /></span></div>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{x.lastSendAt ? ago(x.lastSendAt) : t.sdr.common.never}</td>
                    <td className="num">
                      <RowMenu label={t.sdr.common.more}>{(close) => (<>
                        <Link href={`/outreach/${x.id}`} onClick={close}><ExternalLink />{c.menu.open}</Link>
                        {x.approved && x.status === "active" && <button type="button" disabled={pending} onClick={() => { close(); act(() => runOutreach(x.id, "pause")); }}><Pause />{c.menu.pause}</button>}
                        {x.approved && x.status === "paused" && <button type="button" disabled={pending} onClick={() => { close(); act(() => runOutreach(x.id, "resume")); }}><Play />{c.menu.resume}</button>}
                        {x.status !== "archived" && (<><hr /><button type="button" className="danger" disabled={pending} onClick={() => { close(); if (window.confirm(c.menu.archiveConfirm)) act(() => setOutreachStatus(x.id, "archived")); }}><Archive />{c.menu.archive}</button></>)}
                      </>)}</RowMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
