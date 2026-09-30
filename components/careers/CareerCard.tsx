import Link from "next/link";
import type { CareerJob } from "@/services/careers";
import type { Dictionary } from "@/content/dictionaries";
import { localizedPath, type Locale } from "@/lib/i18n";

interface CareerCardProps {
  job: CareerJob;
  locale: Locale;
  dictionary: Dictionary;
}

export function CareerCard({ job, locale, dictionary }: CareerCardProps) {
  return (
    <Link href={localizedPath(locale, `/careers/${job.slug}`)} className="career-card">
      <div className="career-card-body">
        <div className="career-card-meta-row">
          <span className="career-card-tag">{job.team}</span>
          <span className="career-card-tag">{job.employment_type}</span>
        </div>
        <h3 className="career-card-title">{job.title}</h3>
        <p className="career-card-desc">{job.summary}</p>
        <div className="career-card-footer">
          <span>{job.location}</span>
          <span>{dictionary.careers.viewJob}</span>
        </div>
      </div>
    </Link>
  );
}
