import type { Metadata } from "next";
import Link from "@/components/LocaleLink";
import { connection } from "next/server";
import { AlertTriangle, CheckCircle2, CircleHelp, Wrench, XCircle } from "lucide-react";
import { statusCopy } from "@/lib/content/status-page";
import { statusPage, type PublicStatus } from "@/lib/status";
import { fmt } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { breadcrumbSchema, pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";

export async function generateMetadata(): Promise<Metadata> {
  const c = statusCopy[await getLocale()];
  return pageMetadata({ title: c.seoTitle, absoluteTitle: true, description: c.metaDescription, path: "/status" });
}

const icons: Record<PublicStatus, typeof CheckCircle2> = { operational: CheckCircle2, maintenance: Wrench, degraded: AlertTriangle, partial_outage: AlertTriangle, major_outage: XCircle, no_data: CircleHelp };

// Public status page (D-181): measured service health and published
// incidents. Each state has an icon and a word, never colour alone.
export default async function StatusPage() {
  await connection();
  const locale = await getLocale();
  const c = statusCopy[locale];
  let data: Awaited<ReturnType<typeof statusPage>> | null = null;
  try {
    data = await statusPage(locale);
  } catch {
    data = null;
  }
  const time = (iso: string) => new Intl.DateTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso)) + " UTC";
  const names = new Map((data?.components ?? []).map((x) => [x.id, x.name]));
  const Overall = icons[data?.overall ?? "no_data"];

  const incidentList = (list: NonNullable<typeof data>["active"]) => list.map((i) => (
    <article key={i.id} className={`status-incident impact-${i.impact}`}>
      <header>
        <h3>{i.title}</h3>
        <span className="status-incident-state">{c.incidentStatus[i.status] ?? i.status}</span>
      </header>
      {i.components.length ? <p className="status-incident-affects">{fmt(c.affects, { list: i.components.map((x) => names.get(x) ?? x).join(locale === "ar" ? "، " : ", ") })}</p> : null}
      {i.kind === "maintenance" && i.scheduled_for ? <p className="status-incident-affects">{fmt(c.scheduled, { from: time(i.scheduled_for), to: i.scheduled_until ? time(i.scheduled_until) : "…" })}</p> : null}
      <ol className="status-updates">
        {i.updates.map((u) => (
          <li key={u.id}>
            <strong>{c.incidentStatus[u.status] ?? u.status}</strong>
            <p dir="auto">{u.body}</p>
            <time dateTime={u.created_at}>{time(u.created_at)}</time>
          </li>
        ))}
      </ol>
    </article>
  ));

  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.seoTitle, description: c.metaDescription, path: "/status" }), breadcrumbSchema([{ name: "Yolias", path: "/" }, { name: c.title, path: "/status" }])]} />
      <section className="page-hero">
        <div className="site-width status-width">
          <h1 className="display-font">{c.title}</h1>
          <div className={`status-overall is-${data?.overall ?? "no_data"}`} role="status">
            <Overall aria-hidden="true" />
            <div>
              <strong>{c.overall[data?.overall ?? "no_data"]}</strong>
              <span>{data?.updatedAt ? fmt(c.updated, { time: time(data.updatedAt) }) : c.never}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="site-width status-width">
          {data?.active.length ? <div className="status-block"><h2>{c.activeTitle}</h2>{incidentList(data.active)}</div> : null}
          {data?.upcoming.length ? <div className="status-block"><h2>{c.upcomingTitle}</h2>{incidentList(data.upcoming)}</div> : null}

          <ul className="status-components">
            {(data?.components ?? []).map((comp) => {
              const Icon = icons[comp.status];
              return (
                <li key={comp.id} className={`status-component is-${comp.status}`}>
                  <div className="status-component-head">
                    <div>
                      <h3>{comp.name}</h3>
                      {comp.description ? <p>{comp.description}</p> : null}
                    </div>
                    <span className="svc-pill"><Icon aria-hidden="true" />{c.labels[comp.status]}</span>
                  </div>
                  <div className="status-bars" role="img" aria-label={`${comp.name}: ${comp.uptime == null ? c.noHistory : fmt(c.uptime, { pct: comp.uptime })}`}>
                    {comp.days.map((d) => (
                      <span key={d.day} className={`status-bar day-${d.status}`} title={`${d.day} · ${d.status === "none" ? c.noDataDay : `${c.labels[d.status]} (${d.uptime}%)`}`} />
                    ))}
                  </div>
                  <div className="status-bars-foot"><span>{c.daysAgo}</span><span>{comp.uptime == null ? c.noHistory : fmt(c.uptime, { pct: comp.uptime })}</span><span>{c.today}</span></div>
                </li>
              );
            })}
          </ul>

          <div className="status-block">
            <h2>{c.pastTitle}</h2>
            {data?.past.length ? incidentList(data.past) : <p className="status-muted">{c.noIncidents}</p>}
          </div>

          <p className="status-muted">{c.how} <Link href="/contact?topic=support">{c.contact}</Link></p>
        </div>
      </section>
    </>
  );
}
