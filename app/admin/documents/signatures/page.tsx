import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { formatDateTime } from "@/lib/bos/format";
import { listSignatureRequests } from "@/services/bos/esign";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { requestStatus } from "./labels";

// Signature requests (docs/bos/30 §19).
export default async function SignaturesPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("documents.read");
  const sp = await readParams(searchParams);
  const rows = await listSignatureRequests(bos, { status: sp.status });
  return (
    <>
      <PageHeader title="طلبات التوقيع" subtitle="تتبع إرسال المستندات والاطلاع والتوقيع والنسخ الموقعة" />
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: Object.entries(requestStatus).map(([value, s]) => ({ value, label: s.label })) }]} />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table">
            <thead><tr><th>#</th><th><Tx>المستند</Tx></th><th><Tx>الطريقة</Tx></th><th><Tx>الموقّعون</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>أُرسل</Tx></th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const ss = (r.signature_signers ?? []) as { name: string; status: string }[];
                return (
                  <tr key={r.id}>
                    <td className="bos-nowrap"><Link href={`/admin/documents/signatures/${r.id}`}>{r.number}</Link></td>
                    <td><Link href={`/admin/documents/${r.document_id}`}>{r.title}</Link></td>
                    <td>{r.provider === "docusign" ? "DocuSign" : <Tx>خارج النظام</Tx>}</td>
                    <td className="bos-num">{ss.filter((s) => s.status === "signed").length}/{ss.length}</td>
                    <td><StatusBadge tone={requestStatus[r.status]?.tone ?? "neutral"} label={requestStatus[r.status]?.label ?? r.status} /></td>
                    <td className="bos-nowrap">{formatDateTime(r.sent_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات توقيع" description="افتح مستنداً صادراً واختر «إرسال للتوقيع»." />}
      </Card>
    </>
  );
}
