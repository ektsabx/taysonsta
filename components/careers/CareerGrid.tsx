import type { CareerJob } from "@/services/careers";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";
import { CareerCard } from "./CareerCard";

interface CareerGridProps {
  jobs: CareerJob[];
  locale: Locale;
  dictionary: Dictionary;
}

export function CareerGrid({ jobs, locale, dictionary }: CareerGridProps) {
  const colsClass = jobs.length === 1 ? " cols-1" : "";

  return (
    <div className={`career-grid${colsClass}`}>
      {jobs.map((job) => (
        <CareerCard key={job.id} job={job} locale={locale} dictionary={dictionary} />
      ))}
    </div>
  );
}
