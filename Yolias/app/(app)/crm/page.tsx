import type { Metadata } from "next";
import Link from "next/link";
import { SquareKanban, Search, Table2 } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { CRM_PAGE, CRM_SORTS, listLeads, stageTotals, type CrmSort } from "@/services/crm";
import { teamMembers } from "@/services/workspace";
import { STAGES } from "@/lib/automations/schema";
import { AutoSubmitSelect, StageSelect } from "@/components/app/ws/bits";
import { CrmKanban } from "@/components/app/ws/CrmKanban";
import { dateTime, money, shortDate } from "@/components/app/ws/format";
import type { LeadStage } from "@/types/database";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.crm.title} — Yolias` };
}

// CRM (D-195): one lead per person / company, real stages, deal value,
// meetings and follow-ups. Table (default) and Kanban show the same rows.
export default async function CrmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireViewer();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const view = one(sp.view) === "kanban" ? "kanban" : "table";
  const stage = (STAGES as readonly string[]).includes(one(sp.stage)) ? (one(sp.stage) as LeadStage) : null;
  const owner = one(sp.owner) || null;
  const q = one(sp.q).slice(0, 100);
  const sort = (CRM_SORTS as readonly string[]).includes(one(sp.sort)) ? (one(sp.sort) as CrmSort) : "last_activity_at";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [t, locale, team, totals, list] = await Promise.all([
    getDictionary(), getLocale(), teamMembers(session.workspace.id), stageTotals(session.workspace.id),
    listLeads(session.workspace.id, { stage: view === "kanban" ? null : stage, owner, q, sort, page, all: view === "kanban" }),
  ]);
  const c = t.ws.crm;
  const tz = session.profile.timezone;
  const names = new Map(team.members.map((m) => [m.user_id, m.profile?.full_name || m.profile?.email || "—"]));
  const pages = Math.max(1, Math.ceil(list.total / CRM_PAGE));
  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | null> = { view: view === "kanban" ? "kanban" : null, stage, owner, q: q || null, sort: sort === "last_activity_at" ? null : sort, page: null, ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/crm?${s}` : "/crm";
  };
  const all = Object.values(totals).reduce((a, b) => a + b.count, 0);

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{c.title}</h2>
          <p>{c.subtitle}</p>
        </div>
        <div className="view-actions">
          <div className="ws-segment" role="tablist">
            <Link href={href({ view: null })} className={view === "table" ? "active" : ""} aria-current={view === "table" ? "page" : undefined}><Table2 />{c.table}</Link>
            <Link href={href({ view: "kanban", stage: null })} className={view === "kanban" ? "active" : ""} aria-current={view === "kanban" ? "page" : undefined}><SquareKanban />{c.kanban}</Link>
          </div>
          <Link className="btn-secondary" href="/prospects">{c.addFromProspects}</Link>
        </div>
      </header>
      <div className="view-content-padding">
        <form className="ws-toolbar" method="get" action="/crm">
          {view === "kanban" && <input type="hidden" name="view" value="kanban" />}
          <div className="toolbar-search">
            <Search />
            <input className="form-input" name="q" defaultValue={q} placeholder={t.ws.common.search} aria-label={t.ws.common.search} />
          </div>
          {/* Stage is a dropdown like Owner (owner, 2026-10-13). */}
          {view === "table" && (
            <AutoSubmitSelect className="form-select" name="stage" defaultValue={stage ?? ""} aria-label={c.filterStage}>
              <option value="">{c.filterStage}: {t.ws.common.all} ({all})</option>
              {STAGES.map((s) => <option key={s} value={s}>{c.filterStage}: {t.ws.stages[s]} ({totals[s].count})</option>)}
            </AutoSubmitSelect>
          )}
          <AutoSubmitSelect className="form-select" name="owner" defaultValue={owner ?? ""} aria-label={c.filterOwner}>
            <option value="">{c.filterOwner}: {c.anyone}</option>
            <option value="none">{c.unassigned}</option>
            {team.members.map((m) => <option key={m.user_id} value={m.user_id}>{names.get(m.user_id)}</option>)}
          </AutoSubmitSelect>
          {view === "table" && (
            <AutoSubmitSelect className="form-select" name="sort" defaultValue={sort} aria-label={c.sort}>
              {CRM_SORTS.map((s) => <option key={s} value={s}>{c.sort}: {c.sorts[s]}</option>)}
            </AutoSubmitSelect>
          )}
        </form>
        <p className="ws-muted" style={{ marginBottom: 12 }}>{t.ws.stageNote}</p>

        {view === "kanban" ? (
          <CrmKanban
            leads={list.rows.map((l) => ({ id: l.id, name: l.name, company: l.company_name, stage: l.stage, value: l.deal_value, currency: l.deal_currency, nextMeeting: l.next_meeting_at, followUp: l.next_follow_up_at, owner: l.owner_id ? names.get(l.owner_id) ?? null : null }))}
            timeZone={tz}
          />
        ) : (
          <>
            <div className="data-table-card">
              <div className="data-table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{c.cols.name}</th><th>{c.cols.contact}</th><th>{c.cols.source}</th><th>{c.cols.campaign}</th><th>{c.cols.owner}</th>
                      <th>{c.cols.stage}</th><th>{c.cols.value}</th><th>{c.cols.followUp}</th><th>{c.cols.meeting}</th><th>{c.cols.lastActivity}</th><th>{c.cols.added}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!list.rows.length && <tr><td colSpan={11} className="empty-cell">{all ? c.emptyFiltered : c.empty}</td></tr>}
                    {list.rows.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <Link className="entity-link" href={`/crm/${l.id}`}>
                            <strong>{l.name}</strong>
                            <span className="cell-sub">{[l.job_title, l.company_name !== l.name ? l.company_name : null].filter(Boolean).join(" · ") || "—"}</span>
                          </Link>
                          {l.do_not_contact && <span className="ws-chip red">{t.ws.crm.detail.dnc}</span>}
                        </td>
                        <td className="cell-sub" dir="ltr">{l.email ?? l.phone ?? (l.linkedin_url ? "LinkedIn" : "—")}</td>
                        <td className="cell-sub">{c.sources[l.source]}</td>
                        <td className="cell-sub">{l.campaign_names?.join(", ") || "—"}</td>
                        <td className="cell-sub">{l.owner_id ? names.get(l.owner_id) ?? "—" : c.unassigned}</td>
                        <td><StageSelect leadId={l.id} stage={l.stage} /></td>
                        <td dir="ltr">{money(l.deal_value, l.deal_currency, locale)}</td>
                        <td className="cell-sub">{dateTime(l.next_follow_up_at, locale, tz)}</td>
                        <td className="cell-sub">{dateTime(l.next_meeting_at, locale, tz)}</td>
                        <td className="cell-sub">{shortDate(l.last_activity_at, locale, tz)}</td>
                        <td className="cell-sub">{shortDate(l.created_at, locale, tz)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {pages > 1 && (
              <div className="table-pager">
                <span>{fmt(t.ws.common.page, { page, pages })}</span>
                <div className="table-pager-nav">
                  <Link href={href({ page: String(page - 1) })} aria-disabled={page <= 1} className="btn-secondary">{t.ws.common.prev}</Link>
                  <Link href={href({ page: String(page + 1) })} aria-disabled={page >= pages} className="btn-secondary">{t.ws.common.next}</Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
