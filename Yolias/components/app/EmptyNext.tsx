import Link from "next/link";

// An empty page says what's missing and offers one clear next step (owner, 2026-10-29).
export function EmptyNext({ text, href, label }: { text: string; href: string; label: string }) {
  return (
    <div className="empty-next">
      <p>{text}</p>
      <Link className="btn-primary" href={href}>{label}</Link>
    </div>
  );
}
