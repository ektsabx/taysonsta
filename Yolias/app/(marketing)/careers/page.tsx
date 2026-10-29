import type { Metadata } from "next";
import { pageMetadata, webPageSchema } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import Link from "@/components/LocaleLink";
import { listCareerJobs } from "@/lib/careers";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const c = (await getDictionary()).careers;
  return pageMetadata({ title: `${c.title} | Yolias`, description: c.lead, path: "/careers" });
}

// Open positions, managed in Yolias Admin → Team → Recruitment → Jobs
// (published jobs marked for yolias.com only; lib/careers.ts).
export default async function CareersPage() {
  const [c, jobs] = await Promise.all([getDictionary().then((t) => t.careers), listCareerJobs()]);
  return (
    <>
      <JsonLd nodes={[webPageSchema({ title: c.title, description: c.lead, path: "/careers", type: "CollectionPage" })]} />
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="display-font max-w-[900px]">{c.title}</h1>
          <p className="lead">{c.lead}</p>
        </div>
      </section>

      <section className="section">
        <div className="site-width">
          {jobs === null ? (
            <div className="careers-empty" role="status"><h2>{c.errorTitle}</h2><p>{c.errorBody}</p></div>
          ) : jobs.length === 0 ? (
            <div className="careers-empty" role="status">
              <h2>{c.emptyTitle}</h2>
              <p>{c.emptyBody}</p>
              <Link className="btn-ghost mt-5" href="/contact?topic=other">{c.contactCta}</Link>
            </div>
          ) : (
            <ul className="careers-list">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link href={`/careers/${j.slug}`} className="careers-item">
                    <span className="careers-item-title">{j.title}</span>
                    <span className="careers-item-meta">{[j.team, j.location, j.employmentType].filter(Boolean).join(" · ")}</span>
                    {j.summary && <span className="careers-item-summary">{j.summary}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
