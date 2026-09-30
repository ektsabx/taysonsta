import type { CaseStudyMetric } from "@/services/case-studies";

export function CaseStudyMetrics({ metrics }: { metrics: CaseStudyMetric[] }) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="case-study-metrics-grid">
      {metrics.map((metric) => (
        <div className="case-study-metric-card" key={metric.id}>
          <div className="case-study-metric-value">{metric.value_display}</div>
          <div className="case-study-metric-label">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}
