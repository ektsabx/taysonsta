import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDateTime } from "@/lib/bos/format";
import { entityHref } from "@/lib/bos/links";
import { docTypeLabels, listDocuments, listTemplates } from "@/services/bos/documents";

const statusTone = { issued: "info", sent: "warning", signed: "success", void: "neutral" } as const;
const statusLabel = { issued: "صادر", sent: "مُرسل", signed: "موقّع", void: "ملغى" } as const;

// Documents & templates (docs/bos/30 §3.5, §8): issued documents (frozen
// copies) and the central template library.
export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("documents.read");
  const sp = await readParams(searchParams);
  const tab = sp.tab === "templates" ? "templates" : "documents";
  const canManage = can(bos, "documents.manage", "all");
  const typeOptions = Object.entries(docTypeLabels).map(([value, label]) => ({ value, label }));
  const [docs, templates] = await Promise.all([
    tab === "documents" ? listDocuments({ docType: sp.type && sp.type in docTypeLabels ? sp.type : undefined }) : Promise.resolve([]),
    tab === "templates" ? listTemplates({ docType: sp.type && sp.type in docTypeLabels ? sp.type : undefined, language: sp.lang === "ar" || sp.lang === "en" ? sp.lang : undefined }) : Promise.resolve([]),
  ]);
  const q = (sp.q ?? "").trim().toLowerCase();
  const shownDocs = q ? docs.filter((d) => `${d.number} ${d.title} ${d.reference ?? ""}`.toLowerCase().includes(q)) : docs;
  const shownTemplates = q ? templates.filter((t) => `${t.key} ${t.name}`.toLowerCase().includes(q)) : templates;
  return (
    <>
      <PageHeader title="المستندات والقوالب" subtitle="قوالب مركزية بإصدارات، ومستندات صادرة بنسخ مجمّدة لا تتغير" breadcrumbs={[{ label: "الملفات" }, { label: "المستندات" }]}
        actions={canManage ? <Link className="admin-btn small" href="/admin/documents/templates/new"><Tx>+ قالب جديد</Tx></Link> : null} />
      <Tabs param="tab" active={tab} baseHref="/admin/documents" tabs={[{ key: "documents", label: "المستندات الصادرة" }, { key: "templates", label: "القوالب" }]} />
      <FilterBar searchPlaceholder="بحث بالرقم أو العنوان..." filters={[{ key: "type", label: "النوع", type: "select", options: typeOptions }, ...(tab === "templates" ? [{ key: "lang", label: "اللغة", type: "select" as const, options: [{ value: "ar", label: "العربية" }, { value: "en", label: "English" }] }] : [])]} />
      {tab === "documents" ? (
        <Card flush>
          {shownDocs.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>الرقم</Tx></th><th><Tx>العنوان</Tx></th><th><Tx>النوع</Tx></th><th><Tx>السجل</Tx></th><th><Tx>اللغة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
              <tbody>
                {shownDocs.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-primary"><Link href={`/admin/documents/${d.id}`}>{d.number}</Link></td>
                    <td>{d.title}</td>
                    <td><Tx>{docTypeLabels[d.doc_type] ?? d.doc_type}</Tx></td>
                    <td>{entityHref(d.entity_type, d.entity_id) ? <Link className="bos-link" href={entityHref(d.entity_type, d.entity_id)!}>{d.reference ?? <Tx>فتح</Tx>}</Link> : d.reference ?? "—"}</td>
                    <td>{d.language === "ar" ? "العربية" : "English"}</td>
                    <td><StatusBadge tone={statusTone[d.status as keyof typeof statusTone] ?? "neutral"} label={statusLabel[d.status as keyof typeof statusLabel] ?? d.status} /></td>
                    <td>{formatDateTime(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد مستندات صادرة" description="تُصدر المستندات من صفحة السجل نفسه (فاتورة، عقد، صفقة، عرض عمل، موظف، مشروع، عميل)." />}
        </Card>
      ) : (
        <Card flush>
          {shownTemplates.length ? (
            <table className="bos-table responsive">
              <thead><tr><th><Tx>القالب</Tx></th><th><Tx>النوع</Tx></th><th><Tx>اللغة</Tx></th><th><Tx>الإصدار</Tx></th><th><Tx>الحالة</Tx></th></tr></thead>
              <tbody>
                {shownTemplates.map((t) => {
                  const v = t.document_template_versions as unknown as { version: number; created_at: string } | null;
                  return (
                    <tr key={t.id}>
                      <td className="cell-primary"><Link href={`/admin/documents/templates/${t.id}`}><Tx>{t.name}</Tx></Link><span className="cell-sub" dir="ltr">{t.key}</span></td>
                      <td><Tx>{docTypeLabels[t.doc_type] ?? t.doc_type}</Tx></td>
                      <td>{t.language === "ar" ? "العربية" : "English"}</td>
                      <td className="bos-num">{v ? `v${v.version}` : "—"}</td>
                      <td>{t.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <EmptyState title="لا توجد قوالب" />}
        </Card>
      )}
    </>
  );
}
