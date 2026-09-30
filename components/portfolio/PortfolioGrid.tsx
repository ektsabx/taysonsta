import type { PortfolioCompany } from "@/services/portfolio-companies";
import type { Dictionary } from "@/content/dictionaries";
import type { Locale } from "@/lib/i18n";
import { PortfolioCard } from "./PortfolioCard";

interface PortfolioGridProps {
  companies: PortfolioCompany[];
  locale: Locale;
  dictionary: Dictionary;
}

export function PortfolioGrid({ companies, locale, dictionary }: PortfolioGridProps) {
  const colsClass = companies.length === 1 ? " cols-1" : companies.length === 2 ? " cols-2" : "";

  return (
    <div className={`portfolio-grid${colsClass}`}>
      {companies.map((company) => (
        <PortfolioCard key={company.id} company={company} locale={locale} dictionary={dictionary} />
      ))}
    </div>
  );
}
