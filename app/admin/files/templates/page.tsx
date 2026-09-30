import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { listTemplates } from "@/services/bos/files";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { TemplateToggle } from "../FileControls";

// Reusable templates (proposal/contract templates, documents).
export default async function TemplatesPage() {
  const { bos } = await requirePermission("files.read");
  const [rows, names] = await Promise.all([listTemplates(), userNameMap()]);
  return (
    <>
      <PageHeader title="القوالب" subtitle="أي ملف يمكن جعله قالباً من صفحة «كل الملفات» (يتطلب files.manage)" breadcrumbs={[{ label: "الملفات", href: "/admin/files" }, { label: "القوالب" }]} />
      <Card flush>
        {rows.length ? (
          <table className="bos-table responsive">
            <thead><tr><th><Tx>القالب</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>رفعه</Tx></th><th><Tx>التاريخ</Tx></th><th /></tr></thead>
            <tbody>{rows.map((f) => <tr key={f.id}><td className="cell-primary"><a className="bos-link" href={`/api/bos/files/${f.id}?download=1`}>{f.name}</a></td><td>v{f.version}</td><td>{f.uploaded_by ? names.get(f.uploaded_by) ?? "—" : "—"}</td><td>{formatDate(f.created_at)}</td><td>{can(bos, "files.manage") ? <TemplateToggle id={f.id} isTemplate /> : null}</td></tr>)}</tbody>
          </table>
        ) : <EmptyState title="لا توجد قوالب بعد" />}
      </Card>
    </>
  );
}
