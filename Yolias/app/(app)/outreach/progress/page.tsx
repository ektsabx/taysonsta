import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, Clock, Info, Send } from "lucide-react";
import { AutoRefresh } from "@/components/app/AutoRefresh";
import { PersonAvatar } from "@/components/app/Media";
import { LinkedInIcon } from "@/components/app/ConnectorIcons";
import { formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).results.progressTitle} — Yolias` };
}

type Row = { id: string; status: string; error: string | null; prospect: { full_name: string; title: string | null; photo_url: string | null; linkedin_url: string | null; email_status: string } | null };

// "Starting your outreach…" (D-147, owner's reference): each person's
// message moves Personalized → Delivery checked → Sent; the page refreshes
// itself until every message is sent or failed.
export default async function OutreachProgressPage({ searchParams }: PageProps<"/outreach/progress">) {
  const session = await requireSession();
  const raw = (await searchParams).ids;
  const ids = (typeof raw === "string" ? raw.split(",") : []).filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, 100);
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const r = t.results;
  const db = await createClient();
  const { data } = ids.length
    ? await db.from("outreach_messages").select("id, status, error, prospect:prospects(full_name, title, photo_url, linkedin_url, email_status)").eq("workspace_id", session.workspace.id).in("id", ids)
    : { data: [] };
  const rows = ((data ?? []) as unknown as Row[]).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const finished = rows.filter((m) => ["sent", "failed", "canceled"].includes(m.status)).length;
  const pct = rows.length ? Math.round((finished / rows.length) * 100) : 0;
  const n = (v: number) => formatNumber(v, locale);

  return (
    <div className="page-view">
      <AutoRefresh active={finished < rows.length} />
      <div className="view-content-padding result-page">
        <Link href="/outreach" className="detail-back"><ArrowLeft className="flip-rtl" /> {r.toOutreach}</Link>
        <div className="progress-hero">
          <span className="progress-hero-icon"><Send /></span>
          <div>
            <h1>{r.progressTitle}</h1>
            <p>{fmt(r.progressLead, { count: n(rows.length) })}</p>
          </div>
          <div className="progress-hero-note"><Info /><div><strong>{r.leave}</strong><span>{r.leaveSub}</span></div></div>
        </div>
        <div className="progress-line">
          <div className="progress-track"><div className="progress-fill accent" style={{ width: `${pct}%` }} /></div>
          <strong>{fmt(r.completed, { done: n(finished), total: n(rows.length) })}</strong>
        </div>
        <ul className="result-card progress-list">
          {rows.map((m) => {
            const p = m.prospect;
            const sent = m.status === "sent", failed = m.status === "failed" || m.status === "canceled", sending = m.status === "sending";
            const checked = sent || sending || failed;
            const step = (done: boolean, active: boolean, label: string) => (
              <span className={`step${done ? " done" : active ? " active" : ""}`}>{done ? <CheckCircle2 /> : <span className="step-dot" />} {label}</span>
            );
            return (
              <li key={m.id}>
                <div className="progress-person">
                  <PersonAvatar name={p?.full_name ?? "?"} photoUrl={p?.photo_url} size={52} />
                  <div>
                    <strong>{p?.full_name}</strong>
                    {p?.title && <span className="cell-sub">{p.title}</span>}
                    {p?.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" aria-label="LinkedIn"><LinkedInIcon /></a>}
                  </div>
                </div>
                <div className="progress-steps">
                  {step(true, false, r.stepPersonalized)}
                  <span className="step-arrow" aria-hidden="true">→</span>
                  {step(checked, !checked, checked ? r.stepChecked : r.stepChecking)}
                  <span className="step-arrow" aria-hidden="true">→</span>
                  {step(sent, sending, sending ? r.stSending : r.stepSent)}
                </div>
                <span className={`progress-status ${sent ? "sent" : failed ? "failed" : sending ? "sending" : "queued"}`}>
                  {sent ? <><CheckCircle2 /> {r.stSent}</> : failed ? <><CircleAlert /> {m.status === "canceled" ? r.stCanceled : r.stFailed}</> : sending ? <><span className="spin-ring" /> {r.stSending}</> : <><Clock /> {r.stQueued}</>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
