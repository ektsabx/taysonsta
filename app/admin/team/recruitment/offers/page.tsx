import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { listOffers } from "@/services/bos/hr/recruitment";
import { listDocuments, listTemplates } from "@/services/bos/documents";
import { PageHeader, Card, EmptyState, Money, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate } from "@/lib/bos/format";
import { statusOptions } from "@/lib/bos/labels";
import { GenerateDocumentButton } from "@/app/admin/documents/DocumentControls";

// Job offers: Draft → Sent → Accepted / Rejected / Expired (§22); each offer
// can be issued as a job-offer document (docs/bos/30 §8).
export default async function OffersPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("recruitment.read");
  const sp = await readParams(searchParams);
  const rows = await listOffers({ status: sp.status });
  const canDocs = can(bos, "documents.create");
  const [templates, docs] = await Promise.all([
    canDocs ? listTemplates({ docType: "job_offer", active: true }) : Promise.resolve([]),
    can(bos, "documents.read") ? listDocuments({ entityType: "job_offer", limit: 500 }) : Promise.resolve([]),
  ]);
  const tplOpts = templates.map((t) => ({ id: t.id, name: t.name, language: t.language, doc_type: t.doc_type }));
  return (
    <>
      <PageHeader title="عروض العمل" />
      <FilterBar filters={[{ key: "status", label: "الحالة", type: "select", options: statusOptions("offer_status") }]} />
      <Card flush>
        {rows.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>العرض</Tx></th><th><Tx>المرشح</Tx></th><th><Tx>الوظيفة</Tx></th><th><Tx>الراتب</Tx></th><th><Tx>البدء</Tx></th><th><Tx>صالح حتى</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المستندات</Tx></th></tr></thead>
            <tbody>
              {rows.map((o) => {
                const c = o.candidates as unknown as { id: string; first_name: string; last_name: string } | null;
                const issued = docs.filter((d) => d.entity_id === o.id);
                return (
                  <tr key={o.id}>
                    <td className="cell-primary"><Link href={`/admin/team/recruitment/applications/${o.application_id}`}><Tx>{o.offer_number}</Tx></Link></td>
                    <td>{c ? <Link href={`/admin/team/recruitment/candidates/${c.id}`}>{c.first_name} {c.last_name}</Link> : "—"}</td>
                    <td><Tx>{o.position_title}</Tx><span className="cell-sub">{(o.career_jobs as { title: string } | null)?.title}</span></td>
                    <td><Money value={o.basic_salary} currency={o.currency} /></td>
                    <td>{formatDate(o.start_date)}</td>
                    <td>{formatDate(o.expires_at)}</td>
                    <td><StatusBadge map="offer_status" value={o.status} /></td>
                    <td>
                      <div className="bos-row" style={{ gap: 6 }}>
                        {issued.map((d) => <Link key={d.id} className="bos-link" href={`/admin/documents/${d.id}`}>{d.number}</Link>)}
                        {canDocs ? <GenerateDocumentButton entityType="job_offer" entityId={o.id} templates={tplOpts} /> : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد عروض" />}
      </Card>
    </>
  );
}
