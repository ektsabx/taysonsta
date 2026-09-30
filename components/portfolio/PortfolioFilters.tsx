import Link from "next/link";
import type { Dictionary } from "@/content/dictionaries";
import type { PortfolioRelationshipType } from "@/types/database";
import { localizedPath, type Locale } from "@/lib/i18n";

const relationshipTypes: PortfolioRelationshipType[] = ["owned", "co_founded", "equity", "acquired"];

interface PortfolioFiltersProps {
  activeType: PortfolioRelationshipType | null;
  locale: Locale;
  dictionary: Dictionary;
}

export function PortfolioFilters({ activeType, locale, dictionary }: PortfolioFiltersProps) {
  const basePath = localizedPath(locale, "/portfolio");

  return (
    <div className="portfolio-filters">
      <Link href={basePath} className={`portfolio-filter${!activeType ? " active" : ""}`}>
        {dictionary.portfolio.filterAll}
      </Link>
      {relationshipTypes.map((type) => (
        <Link
          key={type}
          href={`${basePath}?type=${type}`}
          className={`portfolio-filter${activeType === type ? " active" : ""}`}
        >
          {dictionary.portfolio.relationshipLabel[type]}
        </Link>
      ))}
    </div>
  );
}
