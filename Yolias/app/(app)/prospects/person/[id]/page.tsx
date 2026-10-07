import type { Metadata } from "next";
import Link from "next/link";
import { PersonAvatar } from "@/components/app/Media";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChannelBadges } from "@/components/app/ChannelBadges";
import { ContactCell } from "@/components/app/EntityTable";
import { IntelligencePanel } from "@/components/app/IntelligencePanel";
import { ProspectActionButtons } from "@/components/app/ProspectActions";
import { messagesFor } from "@/services/outreach";
import { formatDate, formatNumber, location } from "@/lib/format";
import { gridPerson } from "@/lib/results";
import type { ProspectRow } from "@/types/database";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { getPerson, maskEmail, maskPhone } from "@/services/prospects";

export async function generateMetadata({ params }: PageProps<"/prospects/person/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = /^[0-9a-f-]{36}$/i.test(id) ? await getPerson(id) : null;
  return { title: p ? `${p.full_name} — Yolias` : "Yolias" };
}

// A person (decision maker): who, where, contact (masked until revealed),
// the company, and the data intelligence behind the record.
export default async function PersonPage({ params }: PageProps<"/prospects/person/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await getPerson(id);
  if (!p || p.workspace_id !== session.workspace.id) notFound();
  const [t, locale, messages] = await Promise.all([getDictionary(), getLocale(), messagesFor(p.id)]);
  const o = t.outreach;
  const pr = t.prospects;
  const d = pr.detail;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link href={p.company ? `/prospects/company/${p.company.id}` : "/prospects"} className="detail-back"><ArrowLeft className="flip-rtl" /> {d.back}</Link>
          <div className="person-hero">
            <PersonAvatar name={p.full_name} photoUrl={p.photo_url} size={56} />
            <div>
              <h2>{p.full_name}</h2>
              <p>{[p.title, p.company?.name].filter(Boolean).join(" · ")}</p>
            </div>
          </div>
        </div>
      </header>
      <div className="view-content-padding detail-layout">
        <section className="detail-card">
          <h3>{d.overview}</h3>
          <dl className="detail-grid">
            <dt>{pr.csv.title}</dt><dd>{p.title ?? <span className="cell-sub">{d.notProvided}</span>}</dd>
            <dt>{pr.colLocation}</dt><dd>{location(p.city, p.country, locale) || "—"}</dd>
            <dt>{pr.colContact}</dt>
            <dd>{p.revealed_at ? <ChannelBadges prospect={p} /> : <ContactCell id={p.id} masked={{ email: p.email && p.email_status !== "invalid" ? maskEmail(p.email) : null, phone: p.phone ? maskPhone(p.phone) : null, verified: p.email_status === "verified" }} linkedin={p.linkedin_url} />}</dd>
            {p.revealed_at && p.email && <><dt>{pr.csv.email}</dt><dd dir="ltr">{p.email}{p.email_status === "verified" ? " ✓" : ""}</dd></>}
            {p.revealed_at && p.phone && <><dt>{pr.csv.phone}</dt><dd dir="ltr">{p.phone}</dd></>}
            {p.campaign && <><dt>{d.fromSearch}</dt><dd>{p.campaign.strategy_id ? <Link className="entity-link" href={`/search/${p.campaign.strategy_id}`}>{p.campaign.name}</Link> : p.campaign.name}</dd></>}
          </dl>
        </section>
        {p.company && (
          <section className="detail-card">
            <h3>{d.company}</h3>
            <dl className="detail-grid">
              <dt>{pr.colName}</dt><dd><Link className="entity-link" href={`/prospects/company/${p.company.id}`}>{p.company.name}</Link></dd>
              {p.company.domain && <><dt>{pr.csv.domain}</dt><dd dir="ltr">{p.company.domain}</dd></>}
              {p.company.industry && <><dt>{pr.csv.industry}</dt><dd>{p.company.industry}</dd></>}
              {p.company.employee_count != null && <><dt>{pr.csv.employees}</dt><dd>{fmt(pr.employees, { count: formatNumber(p.company.employee_count, locale) })}</dd></>}
            </dl>
          </section>
        )}
        <section className="detail-card">
          <h3>{o.messages}</h3>
          <div className="person-actions">
            <ProspectActionButtons people={[gridPerson(p as unknown as ProspectRow, p.company ? { id: p.company.id, name: p.company.name } : null, locale)]} source="prospects" />
          </div>
          {messages.length ? (
            <ul className="message-log">
              {messages.map((m) => (
                <li key={m.id}>
                  <span className="message-log-channel">{m.channel === "linkedin" ? o.linkedin : o.email}</span>
                  <span className="message-log-text" dir="auto">{m.subject || m.body.slice(0, 120)}</span>
                  <span className="cell-sub">{m.opened_at && m.opened_via ? fmt(o.lastOpened, { via: o.via[m.opened_via], date: formatDate(m.opened_at, locale, session.profile.timezone) }) : formatDate(m.created_at, locale, session.profile.timezone)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="cell-sub">{o.none}</p>}
        </section>
        <IntelligencePanel t={t} locale={locale} timeZone={session.profile.timezone} row={p} />
      </div>
    </div>
  );
}
