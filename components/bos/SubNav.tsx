import Link from "next/link";
import { Tx } from "@/components/bos/I18n";

// Section tabs inside a sidebar area (keeps the sidebar short — docs/bos/28 §5, §37).
export function SubNav({ items, active, label }: { items: { key: string; href: string; label: string }[]; active: string; label: string }) {
  if (items.length < 2) return null;
  return (
    <nav className="bos-tabs" aria-label={label}>
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={i.key === active ? "active" : undefined} aria-current={i.key === active ? "page" : undefined}>
          <Tx>{i.label}</Tx>
        </Link>
      ))}
    </nav>
  );
}
