import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Building2, ExternalLink, Globe, Mail, MapPin, MessageSquare, Phone, Search, UserRound, Users } from "lucide-react";
import { ContactCell } from "@/components/app/ProspectBits";
import { IntelligencePanel } from "@/components/app/IntelligencePanel";
import { CompanyLogo, PersonAvatar } from "@/components/app/Media";
import { ProspectActionButtons } from "@/components/app/ProspectActions";
import { SaveButton } from "@/components/app/ResultActions";
import { FacebookIcon, InstagramIcon, LinkedInIcon, WhatsAppIcon } from "@/components/app/ConnectorIcons";
import { messagesFor } from "@/services/outreach";
import { formatDate, formatNumber, location } from "@/lib/format";
import { gridPerson, sizeBand } from "@/lib/results";
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

const href = (u: string) => (u.startsWith("http") ? u : `https://${u}`);
const bare = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

type Tile = { icon: React.ReactNode; label: string; value: React.ReactNode; ltr?: boolean };

function Tiles({ items, empty }: { items: Tile[]; empty: string }) {
  return (
    <dl className="info-tiles">
      {items.map((x) => (
        <div key={x.label} className="info-tile">
          <span className="info-tile-icon">{x.icon}</span>
          <div>
            <dt>{x.label}</dt>
            <dd className={x.ltr && x.value ? "ltr-value" : undefined} dir={x.ltr && x.value ? "ltr" : undefined}>{x.value || <span className="cell-sub">{empty}</span>}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

// A person (decision maker), laid out like the company page (owner's request
// 2026-10-07): photo and name, their information as tiles (contact masked
// until revealed), their company, the messages Yolias prepared and the data
// intelligence behind the record.
export default async function PersonPage({ params }: PageProps<"/prospects/person/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const p = await getPerson(id);
  if (!p || p.workspace_id !== session.workspace.id) notFound();
  const [t, locale, messages] = await Promise.all([getDictionary(), getLocale(), messagesFor(p.id)]);
  const o = t.outreach;
  const r = t.results;
  const pr = t.prospects;
  const d = pr.detail;
  const n = (v: number) => formatNumber(v, locale);
  const c = p.company;
  const place = location(p.city ?? c?.city, p.country ?? c?.country, locale);
  const email = p.email && p.email_status !== "invalid" ? p.email : null;
  const back = c ? `/prospects/company/${c.id}` : "/prospects";
  const link = (url: string | null) => url && <a className="entity-link" href={url} target="_blank" rel="noreferrer">{bare(url)} <ExternalLink /></a>;

  const info: Tile[] = [
    { icon: <Briefcase />, label: pr.csv.title, value: p.title },
    { icon: <MapPin />, label: r.location, value: place },
    p.revealed_at
      ? { icon: <Mail />, label: pr.csv.email, ltr: true, value: email && <a className="entity-link" href={`mailto:${email}`}>{email}{p.email_status === "verified" ? " ✓" : ""}</a> }
      : { icon: <Mail />, label: pr.colContact, value: (email || p.phone) && <ContactCell id={p.id} masked={{ email: email ? maskEmail(email) : null, phone: p.phone ? maskPhone(p.phone) : null, verified: p.email_status === "verified" }} linkedin={null} /> },
    ...(p.revealed_at ? [{ icon: <Phone />, label: pr.csv.phone, ltr: true, value: p.phone && <a className="entity-link" href={`tel:${p.phone.replace(/[^\d+]/g, "")}`}>{p.phone}</a> }] : []),
    { icon: <LinkedInIcon />, label: r.linkedin, ltr: true, value: link(p.linkedin_url) },
    { icon: <WhatsAppIcon />, label: pr.csv.whatsapp, ltr: true, value: p.whatsapp },
    { icon: <FacebookIcon />, label: pr.csv.facebook, ltr: true, value: link(p.facebook_url) },
    { icon: <InstagramIcon />, label: pr.csv.instagram, ltr: true, value: link(p.instagram_url) },
  ];
  const size = c?.employee_count != null ? fmt(r.employees, { count: sizeBand(c.employee_count) ?? n(c.employee_count) }) : null;
  const site = c ? c.website ?? c.domain : null;
  const companyInfo: Tile[] = c ? [
    { icon: <Building2 />, label: c.kind === "local_business" ? r.category : r.industry, value: c.kind === "local_business" ? c.category : c.industry },
    { icon: <MapPin />, label: r.location, value: location(c.city, c.country, locale) },
    { icon: <Globe />, label: r.website, ltr: true, value: site && <a className="entity-link" href={href(site)} target="_blank" rel="noreferrer">{bare(site)} <ExternalLink /></a> },
    { icon: <Users />, label: r.size, value: size },
  ] : [];

  return (
    <div className="page-view">
      <div className="view-content-padding result-page">
        <Link href={back} className="detail-back"><ArrowLeft className="flip-rtl" /> {r.back}</Link>

        <section className="result-card company-hero">
          <PersonAvatar name={p.full_name} photoUrl={p.photo_url} size={72} />
          <div className="company-hero-main">
            <h1>{p.full_name}</h1>
            <p>{[p.title, c?.name, place].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="company-hero-actions">
            {p.linkedin_url && <a className="btn-secondary" href={p.linkedin_url} target="_blank" rel="noreferrer"><LinkedInIcon /> {r.openLinkedIn}</a>}
            <SaveButton kind="person" id={p.id} saved={Boolean(p.bookmarked_at)} />
          </div>
        </section>

        <div className="company-columns">
          <section className="result-card">
            <h2 className="result-card-title"><UserRound /> {d.overview}</h2>
            <Tiles items={info} empty={d.notProvided} />
          </section>
          <section className="result-card">
            <h2 className="result-card-title"><Building2 /> {d.company}</h2>
            {c ? (
              <>
                <Link className="person-company" href={`/prospects/company/${c.id}`}>
                  <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.domain} size={40} />
                  <strong>{c.name}</strong>
                </Link>
                <Tiles items={companyInfo} empty={d.notProvided} />
              </>
            ) : <p className="cell-sub">{d.notProvided}</p>}
            {p.campaign && (
              <p className="cell-sub company-from"><Search aria-hidden="true" /> {d.fromSearch}: {p.campaign.strategy_id ? <Link className="entity-link" href={`/search/${p.campaign.strategy_id}`}>{p.campaign.name}</Link> : p.campaign.name}</p>
            )}
          </section>
        </div>

        <section className="result-card">
          <h2 className="result-card-title"><MessageSquare /> {o.messages}</h2>
          <div className="person-actions">
            <ProspectActionButtons people={[gridPerson(p as unknown as ProspectRow, c ? { id: c.id, name: c.name } : null, locale)]} source="prospects" />
          </div>
          {messages.length ? (
            <ul className="message-log">
              {messages.map((m) => (
                <li key={m.id}>
                  <span className="message-log-channel">{o[m.channel]}</span>
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
