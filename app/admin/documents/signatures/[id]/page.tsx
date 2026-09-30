import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { formatDateTime } from "@/lib/bos/format";
import { entityHref } from "@/lib/bos/links";
import { getSignatureRequest } from "@/services/bos/esign";
import { PageHeader, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { OfflineSignerButton, RequestActions } from "../SignatureControls";
import { eventLabels, requestStatus, roleLabels, signerStatus } from "../labels";

// One signature request: parties and their status, event log, signed copy.
export default async function SignatureRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("documents.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let data: Awaited<ReturnType<typeof getSignatureRequest>>;
  try {
    data = await getSignatureRequest(bos, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) redirect("/admin/forbidden");
    throw e;
  }
  const { request: r, signers, events } = data;
  const active = ["sent", "delivered", "partially_signed"].includes(r.status);
  const { data: files } = r.provider === "offline" && active ? await db().from("files").select("id, name, created_at").eq("entity_type", r.entity_type).eq("entity_id", r.entity_id).eq("is_latest", true).is("deleted_at", null).order("created_at", { ascending: false }).limit(50) : { data: [] as { id: string; name: string; created_at: string }[] };
  const source = entityHref(r.entity_type, r.entity_id);
  return (
    <>
      <PageHeader title={`${r.number} · ${r.title}`} />
      <Card title={<span className="bos-row" style={{ gap: 8 }}><Tx>الحالة</Tx><StatusBadge tone={requestStatus[r.status]?.tone ?? "neutral"} label={requestStatus[r.status]?.label ?? r.status} /></span>}>
        <KeyValues items={[
          { label: "المستند", value: <Link href={`/admin/documents/${r.document_id}`}><Tx>فتح المستند</Tx></Link> },
          { label: "السجل", value: source ? <Link href={source}><Tx>فتح السجل</Tx></Link> : "—" },
          { label: "الطريقة", value: r.provider === "docusign" ? <>DocuSign <span className="bos-faint" dir="ltr">{r.external_id}</span></> : <Tx>توقيع خارج النظام</Tx> },
          { label: "ترتيب التوقيع", value: <Tx>{r.signing_order === "sequential" ? "بالترتيب" : "بالتوازي"}</Tx> },
          { label: "أُرسل", value: formatDateTime(r.sent_at) },
          { label: "ينتهي", value: r.expires_at ? formatDateTime(r.expires_at) : "—" },
          { label: "اكتمل", value: r.completed_at ? formatDateTime(r.completed_at) : "—" },
          { label: "النسخة الموقعة", value: r.signed_file_id ? <a href={`/api/bos/files/${r.signed_file_id}`}><Tx>تنزيل</Tx></a> : "—" },
          { label: "آخر خطأ", value: <span className="bos-danger">{r.last_error}</span>, hidden: !r.last_error },
        ]} />
        {can(bos, "documents.create") ? <div style={{ marginTop: 10 }}><RequestActions id={r.id} provider={r.provider} active={active} files={(files ?? []).map((f) => ({ value: f.id, label: `${f.name} · ${formatDateTime(f.created_at)}` }))} /></div> : null}
      </Card>
      <Card title="الأطراف" flush>
        <BosTable className="bos-table">
          <thead><tr><th>#</th><th><Tx>الاسم</Tx></th><th><Tx>البريد</Tx></th><th><Tx>الصفة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التوقيت</Tx></th><th /></tr></thead>
          <tbody>
            {signers.map((s) => (
              <tr key={s.id}>
                <td>{s.routing_order}</td>
                <td>{s.name}</td>
                <td dir="ltr">{s.email}</td>
                <td><Tx>{roleLabels[s.role] ?? s.role}</Tx></td>
                <td><StatusBadge tone={signerStatus[s.status]?.tone ?? "neutral"} label={signerStatus[s.status]?.label ?? s.status} />{s.declined_reason ? <div className="bos-danger" style={{ fontSize: 11 }}>{s.declined_reason}</div> : null}</td>
                <td className="bos-nowrap">{s.signed_at ? formatDateTime(s.signed_at) : s.delivered_at ? formatDateTime(s.delivered_at) : "—"}</td>
                <td>{r.provider === "offline" && active && s.status !== "signed" && can(bos, "documents.create") ? <OfflineSignerButton signerId={s.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      </Card>
      <Card title="سجل الأحداث" flush>
        <BosTable className="bos-table">
          <tbody>{events.map((e) => <tr key={e.id}><td className="bos-nowrap">{formatDateTime(e.occurred_at)}</td><td><Tx>{eventLabels[e.event] ?? e.event}</Tx></td><td>{e.detail ?? ""}</td><td className="bos-faint" style={{ fontSize: 11 }}>{e.source}</td></tr>)}</tbody>
        </BosTable>
      </Card>
    </>
  );
}
