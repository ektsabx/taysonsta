import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { StatusBadge, EmptyState } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { kindLabels, playbookLabels } from "@/services/bos/knowledge";

type Row = { id: string; kind: string; slug: string; title: string; tags: string[]; status: string; version: number; updated_at: string; allowed_role_ids: string[] | null; playbook_section: string | null; kb_categories: unknown };

export function ArticleList({ rows, empty = "لا توجد مقالات" }: { rows: Row[]; empty?: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <BosTable className="bos-table responsive">
      <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>النوع</Tx></th><th><Tx>التصنيف</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>آخر تحديث</Tx></th></tr></thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td className="cell-primary" data-label="العنوان">
              <Link href={`/admin/knowledge/articles/${a.slug}`}><Tx>{a.title}</Tx></Link>
              {a.tags.length ? <span className="cell-sub">{a.tags.map((t) => `#${t}`).join(" ")}</span> : null}
              {a.allowed_role_ids?.length ? <span className="bos-badge tone-warning plain"><Tx>مقيد</Tx></span> : null}
            </td>
            <td data-label="النوع">{kindLabels[a.kind as keyof typeof kindLabels] ?? a.kind}{a.playbook_section ? <span className="cell-sub"><Tx>{playbookLabels[a.playbook_section]}</Tx></span> : null}</td>
            <td data-label="التصنيف">{(a.kb_categories as { name: string } | null)?.name ?? "—"}</td>
            <td data-label="الحالة"><StatusBadge tone={a.status === "published" ? "success" : a.status === "archived" ? "neutral" : "warning"} label={a.status === "published" ? "منشور" : a.status === "archived" ? "مؤرشف" : "مسودة"} /></td>
            <td data-label="الإصدار">v{a.version}</td>
            <td data-label="آخر تحديث">{formatDate(a.updated_at)}</td>
          </tr>
        ))}
      </tbody>
    </BosTable>
  );
}
