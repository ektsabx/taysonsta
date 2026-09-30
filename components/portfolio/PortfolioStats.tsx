import type { PortfolioStats as PortfolioStatsData } from "@/services/portfolio-companies";
import type { Dictionary } from "@/content/dictionaries";

interface PortfolioStatsProps {
  stats: PortfolioStatsData;
  dictionary: Dictionary;
}

export function PortfolioStats({ stats, dictionary }: PortfolioStatsProps) {
  const entries = [
    { value: stats.companies, label: dictionary.portfolio.statsCompanies },
    { value: stats.markets, label: dictionary.portfolio.statsMarkets },
    { value: stats.exits, label: dictionary.portfolio.statsExits },
  ].filter((entry) => entry.value > 0);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="portfolio-stats">
      {entries.map((entry) => (
        <div className="portfolio-stat" key={entry.label}>
          <div className="portfolio-stat-value">{entry.value}</div>
          <div className="portfolio-stat-label">{entry.label}</div>
        </div>
      ))}
    </div>
  );
}
