import type { PortfolioCompanyRole } from "@/services/portfolio-companies";

export function CompanyRole({ roles }: { roles: PortfolioCompanyRole[] }) {
  if (roles.length === 0) {
    return null;
  }

  return (
    <div className="company-tag-list">
      {roles.map((role) => (
        <span className="company-tag" key={role.id}>
          {role.label}
        </span>
      ))}
    </div>
  );
}
