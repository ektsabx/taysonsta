import { headings, type Block } from "@/lib/content/types";

export function Toc({ blocks, title }: { blocks: Block[]; title: string }) {
  const items = headings(blocks);
  if (items.length < 2) return <aside className="toc" />;
  return (
    <aside className="toc" aria-label={title}>
      <div className="toc-title">{title}</div>
      {items.map((h) => <a key={h.id} href={`#${h.id}`}>{h.text}</a>)}
    </aside>
  );
}
