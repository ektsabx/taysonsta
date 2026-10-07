import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, ExternalLink, FileText, Globe, Mail, MapPin, Phone, Star, Tag, Users } from "lucide-react";
import { IntelligencePanel } from "@/components/app/IntelligencePanel";
import { PeopleStatus } from "@/components/app/ProspectBits";
import { CompanyLogo } from "@/components/app/Media";
import { PeopleGrid } from "@/components/app/PeopleGrid";
import { CollectButton, SaveButton } from "@/components/app/ResultActions";
import { FacebookIcon, InstagramIcon, LinkedInIcon, WhatsAppIcon } from "@/components/app/ConnectorIcons";
import { CompanyActionButtons, type MessageRecipient } from "@/components/app/ProspectActions";
import { whatsappDigits } from "@/lib/outreach/channels";
import { formatNumber, location } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { gridPerson, sizeBand } from "@/lib/results";
import { requireSession } from "@/lib/session";
import { getCompany } from "@/services/prospects";

export async function generateMetadata({ params }: PageProps<"/prospects/company/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = /^[0-9a-f-]{36}$/i.test(id) ? await getCompany(id) : null;
  return { title: c ? `${c.company.name} — Yolias` : "Yolias" };
}

const href = (u: string) => (u.startsWith("http") ? u : `https://${u}`);
const bare = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

// A company or local business (D-147, owner's reference): logo, brief,
// company information, its decision makers as cards (reveal, select, start
// outreach), open roles and the data intelligence behind it.
export default async function CompanyPage({ params }: PageProps<"/prospects/company/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getCompany(id);
  if (!data || data.company.workspace_id !== session.workspace.id) notFound();
  const { company: c, people } = data;
  const [t, locale] = await Promise.all([getDictionary(), getLocale()]);
  const r = t.results;
  const d = t.prospects.detail;
  const local = c.kind === "local_business";
  const n = (v: number) => formatNumber(v, locale);
  const place = location(c.city, c.country, locale);
  const size = c.employee_count != null ? fmt(r.employees, { count: sizeBand(c.employee_count) ?? n(c.employee_count) }) : null;
  const site = c.website ?? (c.domain ? c.domain : null);
  const meta = [local ? c.category : c.industry, place, size].filter(Boolean);
  const back = local ? "/prospects?tab=local" : "/prospects";

  const csv = t.prospects.csv;
  const email = { icon: <Mail />, label: csv.email, ltr: true, value: c.email && <a className="entity-link" href={`mailto:${c.email}`}>{c.email}</a> };
  const socials = [
    { icon: <WhatsAppIcon />, label: csv.whatsapp, ltr: true, value: c.whatsapp },
    { icon: <FacebookIcon />, label: csv.facebook, ltr: true, value: c.facebook_url && <a className="entity-link" href={c.facebook_url} target="_blank" rel="noreferrer">{bare(c.facebook_url)} <ExternalLink /></a> },
    { icon: <InstagramIcon />, label: csv.instagram, ltr: true, value: c.instagram_url && <a className="entity-link" href={c.instagram_url} target="_blank" rel="noreferrer">{bare(c.instagram_url)} <ExternalLink /></a> },
  ];
  const recipient: MessageRecipient = {
    kind: "company", id: c.id, name: c.name, title: local ? c.category : c.industry, company: null, photoUrl: null, logo: { logoUrl: c.logo_url, domain: c.domain },
    can: { email: Boolean(c.email), linkedin: false, whatsapp: Boolean(whatsappDigits(c.whatsapp ?? c.phone)), facebook: Boolean(c.facebook_url), instagram: Boolean(c.instagram_url) },
  };
  const info: { icon: React.ReactNode; label: string; value: React.ReactNode; ltr?: boolean }[] = local
    ? [
      { icon: <Tag />, label: r.category, value: c.category },
      { icon: <MapPin />, label: r.address, value: c.address ?? place },
      { icon: <Phone />, label: r.phone, value: c.phone && <span dir="ltr">{c.phone}</span> },
      email,
      { icon: <Globe />, label: r.website, ltr: true, value: site && <a className="entity-link" href={href(site)} target="_blank" rel="noreferrer">{bare(site)} <ExternalLink /></a> },
      { icon: <Star />, label: r.rating, value: c.rating != null ? `${c.rating} ★${c.reviews_count != null ? ` (${n(c.reviews_count)})` : ""}` : null },
      { icon: <MapPin />, label: t.prospects.csv.mapsUrl, value: c.maps_url && <a className="entity-link" href={c.maps_url} target="_blank" rel="noreferrer">{t.prospects.csv.mapsUrl} <ExternalLink /></a> },
      ...socials,
    ]
    : [
      { icon: <Building2 />, label: r.industry, value: c.industry },
      { icon: <MapPin />, label: r.location, value: place },
      { icon: <Globe />, label: r.website, ltr: true, value: site && <a className="entity-link" href={href(site)} target="_blank" rel="noreferrer">{bare(site)} <ExternalLink /></a> },
      email,
      { icon: <Phone />, label: r.phone, value: c.phone && <span dir="ltr">{c.phone}</span> },
      { icon: <LinkedInIcon />, label: r.linkedin, ltr: true, value: c.linkedin_url && <a className="entity-link" href={c.linkedin_url} target="_blank" rel="noreferrer">{bare(c.linkedin_url)} <ExternalLink /></a> },
      { icon: <Users />, label: r.size, value: size },
      { icon: <CalendarDays />, label: r.founded, value: c.founded_year },
      ...socials,
    ];

  return (
    <div className="page-view">
      <div className="view-content-padding result-page">
        <Link href={back} className="detail-back"><ArrowLeft className="flip-rtl" /> {r.back}</Link>

        <section className="result-card company-hero">
          <CompanyLogo name={c.name} logoUrl={c.logo_url} domain={c.domain} size={72} />
          <div className="company-hero-main">
            <h1>{c.name}</h1>
            {meta.length > 0 && <p>{meta.join(" · ")}</p>}
          </div>
          <div className="company-hero-actions">
            {site && <a className="btn-secondary" href={href(site)} target="_blank" rel="noreferrer">{r.visitWebsite} <ExternalLink /></a>}
            {c.linkedin_url && <a className="btn-primary" href={c.linkedin_url} target="_blank" rel="noreferrer"><LinkedInIcon /> {r.openLinkedIn}</a>}
            <CompanyActionButtons company={recipient} />
            <SaveButton kind="company" id={c.id} saved={Boolean(c.bookmarked_at)} />
          </div>
        </section>

        <div className="company-columns">
          <section className="result-card">
            <h2 className="result-card-title"><FileText /> {r.brief}</h2>
            <p className="company-brief">{c.description || <span className="cell-sub">{r.noBrief}</span>}</p>
            {c.campaign && <p className="cell-sub company-from">{d.fromSearch}: {c.campaign.strategy_id ? <Link className="entity-link" href={`/search/${c.campaign.strategy_id}`}>{c.campaign.name}</Link> : c.campaign.name}</p>}
          </section>
          <section className="result-card">
            <h2 className="result-card-title"><FileText /> {r.info}</h2>
            <dl className="info-tiles">
              {info.map((x) => (
                <div key={x.label} className="info-tile">
                  <span className="info-tile-icon">{x.icon}</span>
                  <div>
                    <dt>{x.label}</dt>
                    <dd className={x.ltr && x.value ? "ltr-value" : undefined} dir={x.ltr && x.value ? "ltr" : undefined}>{x.value ?? <span className="cell-sub">{d.notProvided}</span>}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <section id="decision-makers" className="dm-section">
          <div className="dm-head">
            <div>
              <h2>{r.decisionMakers} <span className="count-chip">{fmt(r.found, { count: n(people.length) })}</span></h2>
              <p className="cell-sub">{fmt(r.dmLead, { company: c.name })} {c.people_status && <PeopleStatus status={c.people_status} found={c.people_found} requested={Boolean(c.people_requested_at)} />}</p>
            </div>
          </div>
          {people.length > 0 ? (
            <PeopleGrid people={people.map((p) => gridPerson(p, { id: c.id, name: c.name }, locale))} />
          ) : (
            <div className="result-card dm-empty">
              <div>
                <strong>{r.notCollected}</strong>
                <p className="cell-sub">{c.people_status === "done" ? d.noPeople : r.notCollectedSub}</p>
              </div>
              {c.people_status !== "done" && <CollectButton id={c.id} running={c.people_status === "running" || c.people_status === "queued" || (Boolean(c.people_requested_at) && !c.people_status)} />}
            </div>
          )}
        </section>


        <IntelligencePanel t={t} locale={locale} timeZone={session.profile.timezone} row={c} />
      </div>
    </div>
  );
}
