import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { PageHeader, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { formatDateTime } from "@/lib/bos/format";
import { entityHref } from "@/lib/bos/links";
import { docTypeLabels, getDocument } from "@/services/bos/documents";
import { DocumentActions } from "../DocumentControls";
import { listSignatureRequests } from "@/services/bos/esign";
import { SendForSignature } from "../signatures/SignatureControls";
import { requestStatus } from "../signatures/labels";

const statusTone = { issued: "info", sent: "warning", signed: "success", void: "neutral" } as const;
const statusLabel = { issued: "صادر", sent: "مُرسل", signed: "موقّع", void: "ملغى" } as const;

// An issued document: the frozen copy exactly as issued (docs/bos/30 §8.3).
export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("documents.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let d;
  try {
    d = await getDocument(bos, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) redirect("/admin/forbidden");
    throw e;
  }
  const snapshot = d.data_snapshot as { client?: { email?: string; name?: string; contact_name?: string } } | null;
  let defaultTo = snapshot?.client?.email ?? "";
  const emp = d.entity_type === "employee" ? (await db().from("employees").select("email, full_name").eq("id", d.entity_id).maybeSingle()).data : null;
  if (!defaultTo && emp) defaultTo = emp.email ?? "";
  // E-signature (docs/bos/30 §19): parties prefilled from the record, plus the signing staff member.
  const [requests, { count: docusign }] = await Promise.all([listSignatureRequests(bos, { document_id: d.id }), db().from("integration_connections").select("id", { count: "exact", head: true }).eq("provider", "docusign").neq("status", "disabled")]);
  const defaults: { name: string; email: string; role: "client" | "company" | "employee" }[] = [];
  if (emp?.email) defaults.push({ name: emp.full_name ?? "", email: emp.email, role: "employee" });
  else if (snapshot?.client?.email) defaults.push({ name: snapshot.client.contact_name ?? snapshot.client.name ?? "", email: snapshot.client.email, role: "client" });
  if (bos.email) defaults.push({ name: bos.employee?.full_name ?? "", email: bos.email, role: "company" });
  const source = entityHref(d.entity_type, d.entity_id);
  return (
    <>
      <PageHeader title={d.title} subtitle={<Tx vars={{ n: d.number }}>{"مستند رقم {n} — نسخة مجمّدة"}</Tx>} breadcrumbs={[{ label: "المستندات", href: "/admin/documents" }, { label: d.number }]}
        actions={
          <div className="bos-row" style={{ gap: 6 }}>
            <a className="admin-btn small secondary" href={`/api/bos/documents/${d.id}/docx`}><Tx>تنزيل DOCX</Tx></a>
            <a className="admin-btn small secondary" href={`/admin/documents/${d.id}/print`} target="_blank" rel="noopener"><Tx>طباعة / PDF</Tx></a>
            <DocumentActions id={d.id} status={d.status} defaultTo={defaultTo} />
          </div>
        } />
      <Card>
        <KeyValues items={[
          { label: "النوع", value: docTypeLabels[d.doc_type] ?? d.doc_type },
          { label: "الحالة", value: <StatusBadge tone={statusTone[d.status as keyof typeof statusTone] ?? "neutral"} label={statusLabel[d.status as keyof typeof statusLabel] ?? d.status} /> },
          { label: "السجل", value: source ? <Link className="bos-link" href={source}>{d.reference ?? <Tx>فتح</Tx>}</Link> : d.reference },
          { label: "اللغة", value: d.language === "ar" ? "العربية" : "English" },
          { label: "تاريخ الإصدار", value: formatDateTime(d.created_at) },
          { label: "أُرسل إلى", value: d.sent_to?.length ? <span dir="ltr">{d.sent_to.join(", ")}</span> : null, hidden: !d.sent_to?.length },
          { label: "سبب الإلغاء", value: d.void_reason, hidden: d.status !== "void" },
          { label: "بصمة المحتوى (SHA-256)", value: <code dir="ltr" style={{ fontSize: 11 }}>{d.content_hash.slice(0, 24)}…</code> },
        ]} />
      </Card>
      {can(bos, "documents.create") && d.status !== "void" ? (
        <Card title="التوقيع الإلكتروني">
          {requests.length ? (
            <div style={{ marginBottom: 10 }}>{requests.map((r) => <div key={r.id} className="bos-row" style={{ gap: 6, alignItems: "center", fontSize: 13 }}><Link href={`/admin/documents/signatures/${r.id}`}>{r.number}</Link><StatusBadge tone={requestStatus[r.status]?.tone ?? "neutral"} label={requestStatus[r.status]?.label ?? r.status} /><span className="bos-faint">{r.provider === "docusign" ? "DocuSign" : <Tx>خارج النظام</Tx>} · {formatDateTime(r.sent_at)}</span></div>)}</div>
          ) : null}
          {d.status !== "signed" && !requests.some((r) => ["sent", "delivered", "partially_signed"].includes(r.status)) ? <SendForSignature documentId={d.id} defaults={defaults} docusignReady={!!docusign} /> : null}
        </Card>
      ) : null}
      <iframe title={d.title} className="bos-doc-preview" srcDoc={d.rendered_html} sandbox="allow-same-origin" style={{ minHeight: 900 }} />
    </>
  );
}
