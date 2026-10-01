import Link from "next/link";
import { Info } from "lucide-react";
import { slugify, type Block } from "@/lib/content/types";

// Renders **bold** and [label](href) inside a text run.
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*\*(.+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          const [, label, href] = link;
          return href.startsWith("/") || href.startsWith("#") ? (
            <Link key={i} href={href}>{label}</Link>
          ) : (
            <a key={i} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose">
      {blocks.map((b, i) => {
        if ("h2" in b) return <h2 key={i} id={b.id ?? slugify(b.h2)}>{b.h2}</h2>;
        if ("h3" in b) return <h3 key={i}>{b.h3}</h3>;
        if ("p" in b) return <p key={i}><Rich text={b.p} /></p>;
        if ("ul" in b) return <ul key={i}>{b.ul.map((x, j) => <li key={j}><Rich text={x} /></li>)}</ul>;
        if ("ol" in b) return <ol key={i}>{b.ol.map((x, j) => <li key={j}><Rich text={x} /></li>)}</ol>;
        if ("note" in b) return <div key={i} className="prose-note"><Info /><p><Rich text={b.note} /></p></div>;
        return (
          <div key={i} className="prose-table">
            <table>
              <thead><tr>{b.table.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>{b.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Rich text={c} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
