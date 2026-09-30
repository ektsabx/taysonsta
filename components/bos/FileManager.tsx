import { Tx } from "@/components/bos/I18n";
import { listEntityFiles } from "@/services/bos/shared";
import { formatDateTime } from "@/lib/bos/format";
import { FileUploader, FileRowActions } from "@/components/bos/FileUploader";
import { EmptyState } from "@/components/bos/ui";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const previewable = (mime: string | null) => !!mime && (mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("text/"));

// Files tab for any entity (§45): upload, download, preview, rename, move,
// version, client visibility, delete — all through permission-checked
// actions and short-lived signed URLs.
export async function FileManager({ entityType, entityId, canUpload = true, allowClientVisible = false }: { entityType: string; entityId: string; canUpload?: boolean; allowClientVisible?: boolean }) {
  const files = await listEntityFiles(entityType, entityId);
  return (
    <div className="bos-stack" style={{ gap: 12 }}>
      {canUpload ? <FileUploader entityType={entityType} entityId={entityId} allowClientVisible={allowClientVisible} /> : null}
      {files.length === 0 ? (
        <EmptyState title="لا توجد ملفات" description="ارفع العقود والتصاميم والمستندات المرتبطة بهذا السجل." />
      ) : (
        <div className="bos-table-scroll">
          <table className="bos-table responsive">
            <thead>
              <tr>
                <th><Tx>الملف</Tx></th>
                <th><Tx>الحجم</Tx></th>
                <th><Tx>الإصدار</Tx></th>
                <th><Tx>بواسطة</Tx></th>
                <th><Tx>التاريخ</Tx></th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td className="cell-primary cell-primary-mobile" data-label="الملف">
                    <a className="bos-link" href={`/api/bos/files/${f.id}${previewable(f.mime_type) ? "" : "?download=1"}`} target={previewable(f.mime_type) ? "_blank" : undefined} rel="noreferrer">
                      {f.name}
                    </a>
                    {f.client_visible ? <span className="bos-badge tone-accent plain" style={{ marginInlineStart: 6 }}><Tx>مرئي للعميل</Tx></span> : null}
                    {f.folder && f.folder !== "/" ? <span className="cell-sub"><Tx>{f.folder}</Tx></span> : null}
                  </td>
                  <td data-label="الحجم" className="bos-num">{formatSize(f.size_bytes)}</td>
                  <td data-label="الإصدار">v{f.version}</td>
                  <td data-label="بواسطة"><Tx>{f.uploaderName ?? "—"}</Tx></td>
                  <td data-label="التاريخ">{formatDateTime(f.created_at)}</td>
                  <td className="col-actions">
                    <FileRowActions fileId={f.id} name={f.name} folder={f.folder} clientVisible={f.client_visible} entityType={entityType} entityId={entityId} allowClientVisible={allowClientVisible} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
