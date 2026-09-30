import type { PortfolioCompanyTimelineEntry } from "@/services/portfolio-companies";

export function CompanyTimeline({ timeline }: { timeline: PortfolioCompanyTimelineEntry[] }) {
  if (timeline.length === 0) {
    return null;
  }

  return (
    <div className="company-timeline">
      {timeline.map((entry) => (
        <div className="company-timeline-item" key={entry.id}>
          <div className="company-timeline-year">{entry.year}</div>
          <div className="company-timeline-content">
            <div className="company-timeline-label">{entry.label}</div>
            {entry.description ? <p className="company-timeline-desc">{entry.description}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
