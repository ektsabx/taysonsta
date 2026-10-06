import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ChannelBadges } from "@/components/app/ChannelBadges";
import { ContactCell } from "@/components/app/EntityTable";
import { IntelligencePanel } from "@/components/app/IntelligencePanel";
import { OutreachComposer } from "@/components/app/OutreachComposer";
import { messagesFor, myMailboxes } from "@/services/outreach";
import { formatNumber, location } from "@/lib/format";
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
  const [t, locale, mailboxes, messages] = await Promise.all([getDictionary(), getLocale(), myMailboxes(session.userId), messagesFor(p.id)]);
  const pr = t.prospects;
  const d = pr.detail;

  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <Link href="/prospects" className="detail-back"><ArrowLeft className="flip-rtl" /> {d.back}</Link>
          <h2>{p.full_name}</h2>
          <p>{[p.title, p.company?.name].filter(Boolean).join(" · ")}</p>
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
        <OutreachComposer prospectId={p.id} canEmail={Boolean(p.email && p.email_status !== "invalid")} mailboxes={mailboxes} latest={messages[0] ?? null} />
        <IntelligencePanel t={t} locale={locale} timeZone={session.profile.timezone} row={p} />
      </div>
    </div>
  );
}
