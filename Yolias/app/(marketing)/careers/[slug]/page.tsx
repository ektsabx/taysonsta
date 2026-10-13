import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCareerJob } from "@/lib/careers";
import { getDictionary } from "@/lib/i18n/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getCareerJob(slug);
  if (!job) return { title: "Yolias" };
  return pageMetadata({ title: `${job.title} | ${(await getDictionary()).careers.title} | Yolias`, description: job.summary || job.title, path: `/careers/${job.slug}` });
}

const paragraphs = (text: string) => text.split(/\n+/).map((p) => p.trim()).filter(Boolean);

export default async function CareerJobPage({ params }: Props) {
  const { slug } = await params;
  const [job, t] = await Promise.all([getCareerJob(slug), getDictionary()]);
  if (!job) notFound();
  const c = t.careers;
  const sections = [
    { title: c.aboutRole, body: job.roleDescription },
    { title: c.responsibilities, body: job.responsibilities },
    { title: c.requirements, body: job.requirements },
    { title: c.idealCandidate, body: job.idealCandidate },
  ].filter((s) => s.body.trim());
  return (
    <>
      <section className="page-hero">
        <div className="site-width">
          <p className="eyebrow"><Link href="/careers">{c.title}</Link></p>
          <h1 className="display-font max-w-[900px]">{job.title}</h1>
          <p className="lead">{[job.team, job.location, job.employmentType].filter(Boolean).join(" · ")}</p>
        </div>
      </section>
      <section className="section">
        <div className="site-width careers-job">
          {job.summary && <p className="careers-job-summary">{job.summary}</p>}
          {sections.map((s) => (
            <div key={s.title} className="careers-job-section">
              <h2>{s.title}</h2>
              <div className="prose">{paragraphs(s.body).map((p, i) => <p key={i}>{p}</p>)}</div>
            </div>
          ))}
          <div className="careers-apply">
            <h2>{c.applyTitle}</h2>
            <p>{c.applyBody}</p>
            <Link className="btn-solid" href="/contact?topic=other">{c.applyCta}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
