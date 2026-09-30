import type { PortfolioCompanyMetric } from "@/services/portfolio-companies";

export function CompanyMetrics({ metrics }: { metrics: PortfolioCompanyMetric[] }) {
  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="company-metrics-grid">
      {metrics.map((metric) => (
        <div className="company-metric-card" key={metric.id}>
          <div className="company-metric-value">{metric.value_display}</div>
          <div className="company-metric-label">{metric.label}</div>
        </div>
      ))}
    </div>
  );
}
