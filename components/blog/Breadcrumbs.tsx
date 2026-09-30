import Link from "next/link";
import type { ReactNode } from "react";

interface Crumb {
  href?: string;
  label: ReactNode;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={index} style={{ display: "contents" }}>
          {index > 0 ? <span>/</span> : null}
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
