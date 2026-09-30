import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { listSharedWithMe } from "@/services/bos/files";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";

export default async function SharedFilesPage() {
  const { bos } = await requirePermission("files.read");
  const [rows, names] = await Promise.all([listSharedWithMe(bos), userNameMap()]);
  return (
    <>
      <PageHeader title="الملفات المشتركة معي" />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الملف</Tx></th><th><Tx>شاركه</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{rows.map((s) => { const f = s.files as unknown as { id: string; name: string; version: number }; return <tr key={s.id}><td className="cell-primary"><a className="bos-link" href={`/api/bos/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a><span className="cell-sub">v{f.version}</span></td><td>{s.created_by ? names.get(s.created_by) ?? "—" : "—"}</td><td>{formatDateTime(s.created_at)}</td></tr>; })}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد ملفات مشتركة معك" />}
      </Card>
    </>
  );
}
