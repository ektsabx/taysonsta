import type { PortfolioCompanyBuiltItem } from "@/services/portfolio-companies";

export function CompanyBuiltItems({ items }: { items: PortfolioCompanyBuiltItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="company-tag-list">
      {items.map((item) => (
        <span className="company-tag" key={item.id}>
          {item.label}
        </span>
      ))}
    </div>
  );
}
