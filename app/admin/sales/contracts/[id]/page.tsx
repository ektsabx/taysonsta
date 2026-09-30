import { RecordDocuments } from "@/components/bos/RecordDocuments";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listCurrencies } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge, Money, Tabs, KeyValues } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { FileManager } from "@/components/bos/FileManager";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { ContractForm } from "../ContractForm";
import { updateContractAction } from "../actions";
import { ContractActions, SignatureForm } from "./ContractActions";

const tabs = [
  { key: "overview", label: "نظرة عامة" },
  { key: "files", label: "مستند العقد" },
  { key: "edit", label: "تعديل" },
  { key: "approvals", label: "الموافقات" },
  { key: "timeline", label: "السجل الزمني" },
  { key: "audit", label: "سجل التدقيق" },
];

export default async function ContractDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("contracts.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab : "overview";
  if (!(await canAccessEntity(bos, "contract", id))) notFound();

  const { data: c, error } = await db()
    .from("contracts")
    .select("*, clients(id, name, company_name), deals(id, name, deal_number), projects!contracts_project_fk(id, name, project_number), files(id, name)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!c) notFound();
  const { data: signatures } = await db().from("contract_signatures").select("*").eq("contract_id", id).order("signed_at");
  const { data: contacts } = await db().from("contacts").select("id, full_name, email").eq("client_id", c.client_id).is("archived_at", null);
  const currencies = await listCurrencies();
  const client = c.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const deal = c.deals as unknown as { id: string; name: string; deal_number: string } | null;
  const project = c.projects as unknown as { id: string; name: string; project_number: string } | null;
  const file = c.files as unknown as { id: string; name: string } | null;
  const canUpdate = can(bos, "contracts.update") && (await canAccessEntity(bos, "contract", id, "update"));
  const validSigs = (signatures ?? []).filter((s) => s.is_valid && s.document_version === c.document_version);

  return (
    <>
      <PageHeader
        title={`${c.contract_number} — ${c.title}`}
        subtitle={<StatusBadge map="contract_status" value={c.status} />}
        breadcrumbs={[{ label: "المبيعات" }, { label: "العقود", href: "/admin/sales/contracts" }, { label: c.contract_number }]}
        actions={canUpdate ? <ContractActions contractId={id} status={c.status} hasFile={Boolean(c.file_id)} /> : null}
      />
      <Summary
        items={[
          { label: "الحساب", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "الصفقة", value: deal ? <Link href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : "—" },
          { label: "المشروع", value: project ? <Link href={`/admin/projects/${project.id}`}>{project.project_number}</Link> : "—" },
          { label: "القيمة", value: <Money value={c.value} currency={c.currency} /> },
          { label: "المدة", value: `${formatDate(c.start_date)} → ${formatDate(c.end_date)}` },
          { label: "التوقيعات", value: `${validSigs.length}/${c.required_signers}` },
          { label: "إصدار المستند", value: `v${c.document_version}` },
        ]}
      />
      <Tabs tabs={tabs.map((t) => (t.key === "edit" ? { ...t, hidden: !canUpdate || ["signed", "cancelled", "expired"].includes(c.status) } : t.key === "audit" ? { ...t, hidden: !can(bos, "audit.read") } : t))} active={tab} baseHref={`/admin/sales/contracts/${id}`} />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="التوقيعات">
              {(signatures ?? []).length ? (
                <table className="bos-table responsive">
                  <thead>
                    <tr>
                      <th><Tx>الموقّع</Tx></th>
                      <th><Tx>الطريقة</Tx></th>
                      <th><Tx>الوقت</Tx></th>
                      <th>IP</th>
                      <th><Tx>إصدار المستند</Tx></th>
                      <th><Tx>صالح</Tx></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(signatures ?? []).map((s) => (
                      <tr key={s.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الموقّع">
                          {s.signer_name}
                          {s.signer_email ? <span className="cell-sub"><Tx>{s.signer_email}</Tx></span> : null}
                        </td>
                        <td data-label="الطريقة"><Tx>{s.method === "manual" ? "يدوي (مستند موقّع)" : s.method === "click" ? "موافقة إلكترونية" : "توقيع إلكتروني"}</Tx></td>
                        <td data-label="الوقت">{formatDateTime(s.signed_at)}</td>
                        <td data-label="IP">{s.ip ? String(s.ip) : "—"}</td>
                        <td data-label="الإصدار">v{s.document_version}</td>
                        <td data-label="صالح"><Tx>{s.is_valid ? "نعم" : "لا (استُبدل المستند)"}</Tx></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد توقيعات بعد.</Tx></div>
              )}
              {canUpdate && ["sent", "viewed", "partially_signed"].includes(c.status) ? (
                <>
                  <div className="bos-divider" />
                  <SignatureForm contractId={id} contacts={(contacts ?? []).map((x) => ({ value: x.id, label: x.full_name, email: x.email }))} />
                </>
              ) : null}
            </Card>
            {c.payment_terms ? (
              <Card title="شروط الدفع">
                <div className="bos-prose"><Tx>{c.payment_terms}</Tx></div>
              </Card>
            ) : null}
          </div>
          <div>
            <Card title="المستند">
              <KeyValues
                items={[
                  { label: "الملف الحالي", value: file ? <a className="bos-link" href={`/api/bos/files/${file.id}`} target="_blank" rel="noreferrer">{file.name}</a> : "لم يُرفع بعد" },
                  { label: "أُرسل", value: c.sent_at ? formatDateTime(c.sent_at) : null },
                  { label: "شوهد", value: c.viewed_at ? formatDateTime(c.viewed_at) : null },
                  { label: "وُقّع", value: c.signed_at ? formatDateTime(c.signed_at) : null },
                  { label: "مزود التوقيع الإلكتروني", value: c.esign_provider ?? "غير مفعّل — تسجيل يدوي" },
                ]}
              />
            </Card>
            <Card title="آخر الأحداث">
              <ActivityTimeline entityType="contract" entityId={id} limit={8} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "files" ? (
        <Card title="مستند العقد">
          <p className="bos-muted" style={{ fontSize: 13, marginBottom: 10 }}>
            <Tx>ارفع ملف العقد ثم اضغط “اعتماد آخر ملف كنسخة العقد” من الأعلى. رفع نسخة جديدة يلغي التوقيعات السابقة ويعيد العقد لحالة “مُرسل”.</Tx>
          </p>
          <FileManager entityType="contract" entityId={id} canUpload={canUpdate} allowClientVisible />
        </Card>
      ) : null}

      {tab === "edit" && canUpdate ? (
        <ContractForm
          action={updateContractAction.bind(null, id)}
          currencies={currencies}
          initialClient={client ? { id: client.id, label: client.company_name ?? client.name } : null}
          initialDeal={deal ? { id: deal.id, label: deal.name, sub: deal.deal_number } : null}
          initial={{ title: c.title, value: String(c.value), currency: c.currency, start_date: c.start_date, end_date: c.end_date, payment_terms: c.payment_terms, required_signers: c.required_signers }}
        />
      ) : null}

      {tab === "approvals" ? (
        <Card title="الموافقات">
          <ApprovalPanel entityType="contract" entityId={id} bos={bos} />
        </Card>
      ) : null}
      {tab === "timeline" ? (
        <Card title="السجل الزمني">
          <ActivityTimeline entityType="contract" entityId={id} limit={200} />
        </Card>
      ) : null}
      {tab === "audit" && can(bos, "audit.read") ? (
        <Card title="سجل التدقيق">
          <AuditLogPanel entityType="contract" entityId={id} />
        </Card>
      ) : null}
      {tab === "overview" ? <RecordDocuments bos={bos} entityType="contract" entityId={id} /> : null}
    </>
  );
}
