import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

interface Props {
  code?: string;
  title: string;
  body: string;
  primary: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href: string };
}

// Shared look for 404 and error pages: calm, centered, Yolias identity.
export function ErrorScreen({ code, title, body, primary, secondary }: Props) {
  return (
    <div className="error-page">
      <header className="error-top"><Link href="/" aria-label="Yolias"><BrandLogo /></Link></header>
      <main className="error-main">
        {code && <p className="error-code">{code}</p>}
        <h1>{title}</h1>
        <p>{body}</p>
        <div className="error-actions">
          {primary.href ? (
            <Link className="btn-primary" href={primary.href}>{primary.label}</Link>
          ) : (
            <button className="btn-primary" type="button" onClick={primary.onClick}>{primary.label}</button>
          )}
          {secondary && <Link className="btn-secondary" href={secondary.href}>{secondary.label}</Link>}
        </div>
      </main>
    </div>
  );
}
