import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { listFiles } from "@/services/bos/files";
import { listActiveStaff, listRoles, userNameMap } from "@/services/bos/shared";
import { entityHref, entityTypeLabels } from "@/lib/bos/links";
import { PageHeader, Card, EmptyState, StatusBadge, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDateTime } from "@/lib/bos/format";
import { PurgeFileButton, RestoreFileButton, ShareButton, TemplateToggle } from "./FileControls";

const size = (b: number | null) => (!b ? "—" : b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

// All Files (docs/bos/16): every file the viewer can access.
export default async function FilesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("files.read");
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const [res, names, staff, roles] = await Promise.all([listFiles(bos, { ...sp, page }), userNameMap(), listActiveStaff(), listRoles()]);
  const deleted = sp.deleted === "1";
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const qs = (p: number) => `/admin/files?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]), page: String(p) })}`;
  const userOpts = staff.map((s) => ({ value: s.userId, label: s.name }));
  const roleOpts = roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name }));
  return (
    <>
      <PageHeader title="كل الملفات" subtitle={<Tx vars={{ total: res.total }}>{"{total} ملف"}</Tx>} breadcrumbs={[{ label: "الملفات" }]} actions={<><Link className="admin-btn small ghost" href="/admin/files/shared"><Tx>المشتركة معي</Tx></Link><Link className="admin-btn small ghost" href="/admin/files/templates"><Tx>القوالب</Tx></Link></>} />
      <Tabs param="deleted" active={deleted ? "1" : "0"} baseHref="/admin/files" tabs={[{ key: "0", label: "الملفات" }, { key: "1", label: "المحذوفة" }]} />
      <FilterBar searchPlaceholder="اسم الملف..." filters={[
        { key: "entity_type", label: "مرتبط بـ", type: "select", options: Object.entries(entityTypeLabels).map(([value, label]) => ({ value, label })) },
        { key: "uploader", label: "رفعه", type: "select", options: userOpts },
        { key: "kind", label: "النوع", type: "select", options: [{ value: "image", label: "صور" }, { value: "pdf", label: "PDF" }, { value: "doc", label: "مستندات" }] },
        { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" },
      ]} />
      <Card flush>
        {res.rows.length ? (
          <div className="bos-table-scroll">
            <table className="bos-table responsive">
              <thead><tr><th><Tx>الملف</Tx></th><th><Tx>مرتبط بـ</Tx></th><th><Tx>الحجم</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>رفعه</Tx></th><th><Tx>التاريخ</Tx></th><th className="col-actions" /></tr></thead>
              <tbody>
                {res.rows.map((f) => {
                  const href = entityHref(f.entity_type, f.entity_id);
                  return (
                    <tr key={f.id}>
                      <td className="cell-primary" data-label="الملف">
                        {deleted ? f.name : <a className="bos-link" href={`/api/bos/files/${f.id}`} target="_blank" rel="noreferrer">{f.name}</a>}
                        {f.folder && f.folder !== "/" ? <span className="cell-sub"><Tx>{f.folder}</Tx></span> : null}
                        {f.client_visible ? <StatusBadge tone="accent" label="مرئي للعميل" /> : null}
                        {f.is_template ? <StatusBadge tone="info" label="قالب" /> : null}
                      </td>
                      <td data-label="مرتبط بـ">{f.entity_type ? (href && f.entity_type !== "file" ? <Link className="bos-link" href={href}><Tx>{entityTypeLabels[f.entity_type] ?? f.entity_type}</Tx></Link> : entityTypeLabels[f.entity_type] ?? f.entity_type) : "—"}</td>
                      <td data-label="الحجم" className="bos-num">{size(f.size_bytes)}</td>
                      <td data-label="الإصدار">v{f.version}</td>
                      <td data-label="رفعه">{f.uploaded_by ? names.get(f.uploaded_by) ?? "—" : "—"}</td>
                      <td data-label="التاريخ">{formatDateTime(deleted ? f.deleted_at : f.created_at)}</td>
                      <td className="col-actions">
                        {deleted ? <><RestoreFileButton id={f.id} />{bos.isSuperAdmin ? <PurgeFileButton id={f.id} /> : null}</> : <><ShareButton id={f.id} users={userOpts} roles={roleOpts} />{can(bos, "files.manage") ? <TemplateToggle id={f.id} isTemplate={f.is_template} /> : null}</>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title={deleted ? "لا توجد ملفات محذوفة" : "لا توجد ملفات"} description="تُرفع الملفات من تبويب «الملفات» داخل كل سجل (عميل، مشروع، مهمة، عقد...)." />}
        {pages > 1 ? <div className="bos-row" style={{ justifyContent: "center", gap: 8, padding: 10 }}>{page > 1 ? <Link className="admin-btn small secondary" href={qs(page - 1)}><Tx>السابق</Tx></Link> : null}<span className="bos-faint">{page}/{pages}</span>{page < pages ? <Link className="admin-btn small secondary" href={qs(page + 1)}><Tx>التالي</Tx></Link> : null}</div> : null}
      </Card>
    </>
  );
}
