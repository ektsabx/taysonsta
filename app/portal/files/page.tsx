import { portalCan, requirePortalSection } from "@/lib/bos/portal-auth";
import { portalProjects } from "@/services/bos/portal";
import { PortalUpload } from "../ExtraControls";
import { portalFiles } from "@/services/bos/portal";
import { formatDate } from "@/lib/bos/format";
import { PEmpty, PTop } from "../ui";

const typeLabels: Record<string, string> = { project: "مشروع", milestone: "مرحلة", ticket: "تذكرة", change_request: "طلب تغيير", invoice: "فاتورة", contract: "عقد", client: "الحساب" };

export default async function PortalFilesPage() {
  const p = await requirePortalSection("files");
  const [files, projects] = await Promise.all([portalFiles(p), portalCan(p, "upload") ? portalProjects(p) : Promise.resolve([])]);
  return (
    <>
      <PTop title="الملفات" />
      {portalCan(p, "upload") ? <PortalUpload projects={(projects as { id: string; name: string; status?: string }[]).filter((x) => x.status !== "cancelled").map((x) => ({ id: x.id, name: x.name }))} /> : null}
      <div className="portal-card">
        {files.length ? (
          <table className="portal-table">
            <thead><tr><th>الملف</th><th>مرتبط بـ</th><th>الإصدار</th><th>التاريخ</th></tr></thead>
            <tbody>{files.map((f) => <tr key={f.id}><td><a href={`/portal/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a></td><td>{typeLabels[f.entity_type ?? ""] ?? f.entity_type}</td><td>v{f.version}</td><td>{formatDate(f.created_at)}</td></tr>)}</tbody>
          </table>
        ) : <PEmpty title="لا توجد ملفات مشتركة معك" />}
      </div>
    </>
  );
}
