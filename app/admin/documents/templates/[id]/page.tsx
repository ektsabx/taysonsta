import { BosTable } from "@/components/bos/BosTable";
import { notFound } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { NotFoundError } from "@/lib/bos/errors";
import { listRoles } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { templateVariables } from "@/lib/bos/documents/template";
import { docTypeEntities, docTypeLabels, getTemplate } from "@/services/bos/documents";
import { DuplicateTemplateButton, RestoreVersionButton, TemplateEditor, TemplateMetaControls } from "../../DocumentControls";

const recordSources: Record<string, { table: string; label: string; cols: string; fmt: (r: Record<string, unknown>) => string }> = {
  invoice: { table: "invoices", label: "فاتورة", cols: "id, invoice_number, created_at", fmt: (r) => String(r.invoice_number) },
  contract: { table: "contracts", label: "عقد", cols: "id, contract_number, title, created_at", fmt: (r) => `${r.contract_number} — ${r.title}` },
  deal: { table: "deals", label: "صفقة", cols: "id, deal_number, name, created_at", fmt: (r) => `${r.deal_number} — ${r.name}` },
  job_offer: { table: "job_offers", label: "عرض عمل", cols: "id, offer_number, position_title, created_at", fmt: (r) => `${r.offer_number} — ${r.position_title}` },
  employee: { table: "employees", label: "موظف", cols: "id, full_name, created_at", fmt: (r) => String(r.full_name) },
  client: { table: "clients", label: "حساب", cols: "id, name, company_name, created_at", fmt: (r) => String(r.company_name ?? r.name) },
  project: { table: "projects", label: "مشروع", cols: "id, project_number, name, created_at", fmt: (r) => `${r.project_number} — ${r.name}` },
};

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("documents.manage", "all");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getTemplate(id).catch((e) => (e instanceof NotFoundError ? null : Promise.reject(e)));
  if (!data) notFound();
  const { template, versions, current } = data;
  const roles = await listRoles();
  const records = await Promise.all(
    (docTypeEntities[template.doc_type] ?? []).map(async (type) => {
      const src = recordSources[type];
      const { data: rows } = await db().from(src.table as never).select(src.cols).order("created_at", { ascending: false }).limit(25);
      return { type, label: src.label, options: ((rows ?? []) as Record<string, unknown>[]).map((r) => ({ value: String(r.id), label: src.fmt(r) })) };
    }),
  );
  const style = (current?.style ?? {}) as { primary?: string; accent?: string; fontSize?: number; showLogo?: boolean };
  const vars = current ? templateVariables(current.body + (current.subject ?? "")) : [];
  return (
    <>
      <PageHeader title={<Tx>{template.name}</Tx>} subtitle={<Tx vars={{ type: <Tx>{docTypeLabels[template.doc_type]}</Tx>, v: current?.version ?? 0 }}>{"{type} · الإصدار الحالي v{v}"}</Tx>}
       
        actions={<DuplicateTemplateButton id={template.id} baseKey={template.key} name={template.name} language={template.language} />} />
      <Card title="بيانات القالب">
        <KeyValues items={[{ label: "المفتاح", value: <span dir="ltr">{template.key}</span> }, { label: "النوع", value: docTypeLabels[template.doc_type] }, { label: "اللغة", value: template.language === "ar" ? "العربية" : "English" }, { label: "الحالة", value: template.is_active ? <StatusBadge tone="success" label="مفعّل" /> : <StatusBadge tone="neutral" label="معطّل" /> }, { label: "قالب نظام", value: template.is_system ? "نعم" : "لا" }]} />
        <div style={{ marginTop: 12 }}><TemplateMetaControls id={template.id} name={template.name} active={template.is_active} roles={roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.key, label: r.name }))} editRoles={template.edit_role_keys} /></div>
      </Card>
      <Card title="المحتوى والتصميم">
        <TemplateEditor
          templateId={template.id}
          isEmail={template.doc_type === "email"}
          initial={{ subject: current?.subject ?? "", body: current?.body ?? "", primary: style.primary ?? "#e51f26", accent: style.accent ?? "#111827", font_size: style.fontSize ?? 11, show_logo: style.showLogo ?? true, header_note: current?.header_note ?? "", footer_note: current?.footer_note ?? "" }}
          records={records}
        />
      </Card>
      <div className="bos-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
        <Card title="صياغة القالب">
          <div className="bos-syntax">
            <div><code># عنوان</code> <code>## فرعي</code> · <code>**عريض**</code> <code>*مائل*</code></div>
            <div><code>- بند</code> <code>1. بند</code> · <Tx>سطر فارغ = فقرة جديدة</Tx></div>
            <div><code>| عمود | عمود |</code> <Tx>ثم</Tx> <code>|---|---|</code> <Tx>لصف العناوين</Tx></div>
            <div><code>---</code> <Tx>خط فاصل</Tx> · <code>[[pagebreak]]</code> <Tx>صفحة جديدة</Tx> · <code>[[signatures: الشركة | العميل]]</code></div>
            <div><code>{"{{client.display_name}}"}</code> · <code>{"{{money invoice.total invoice.currency}}"}</code> · <code>{"{{date invoice.due_date}}"}</code></div>
            <div><code>{"{{#each lines}} … {{/each}}"}</code> · <code>{"{{#if x}} … {{else}} … {{/if}}"}</code> · <code>{"{{@index}}"}</code> · <code>{"../"}</code></div>
            <div className="bos-faint"><Tx>البيانات تُدرج كنص فقط — لا يمكن لبيانات العميل تغيير بنية المستند.</Tx></div>
          </div>
        </Card>
        <Card title="المتغيرات المستخدمة">
          {vars.length ? <div className="bos-row" style={{ gap: 4, flexWrap: "wrap" }}>{vars.map((v) => <code key={v} className="bos-tag" dir="ltr">{v}</code>)}</div> : <span className="bos-faint">—</span>}
          <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>متاحة دائماً: company.* (من إعدادات الشركة)، today، doc.number، doc.title.</Tx></p>
        </Card>
      </div>
      <Card title="سجل الإصدارات" flush>
        <BosTable className="bos-table responsive">
          <thead><tr><th><Tx>الإصدار</Tx></th><th><Tx>ملاحظة التغيير</Tx></th><th><Tx>التاريخ</Tx></th><th /></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="bos-num">v{v.version}{v.id === template.current_version_id ? <span className="cell-sub"><Tx>الحالي</Tx></span> : null}</td>
                <td>{v.change_note ?? "—"}</td>
                <td>{formatDateTime(v.created_at)}</td>
                <td>{v.id !== template.current_version_id ? <RestoreVersionButton templateId={template.id} versionId={v.id} version={v.version} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      </Card>
    </>
  );
}
