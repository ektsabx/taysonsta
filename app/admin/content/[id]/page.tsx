import { BosTable } from "@/components/bos/BosTable";
import { notFound } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { NotFoundError } from "@/lib/bos/errors";
import { formatDateTime } from "@/lib/bos/format";
import { getItem, listStages } from "@/services/bos/content";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, KeyValues } from "@/components/bos/ui";
import { FileManager } from "@/components/bos/FileManager";
import { AiPanel, ItemForm, StageControls, TaskList } from "../ContentControls";
import { typeLabels } from "../labels";

// One content item (docs/bos/30 §13.1–13.3): stage + approval, tasks, files,
// AI drafts, change log.
export default async function ContentItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("content.read");
  const { id } = await params;
  let data: Awaited<ReturnType<typeof getItem>>;
  try {
    data = await getItem(bos, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { item, tasks, drafts } = data;
  const [stages, staff, names, { data: history }, { count: ai }] = await Promise.all([
    listStages(true), listActiveStaff(), userNameMap(),
    db().from("status_history").select("from_status, to_status, changed_by, reason, changed_at").eq("entity_type", "content_item").eq("entity_id", id).order("changed_at", { ascending: false }).limit(30),
    db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active"),
  ]);
  const stage = stages.find((s) => s.key === item.stage);
  const canEdit = can(bos, "content.update");
  const staffOpts = staff.map((s) => ({ value: s.userId, label: s.name }));
  const stageName = (k: string | null) => stages.find((s) => s.key === k)?.name ?? k ?? "—";
  return (
    <>
      <PageHeader title={`${item.number} · ${item.title}`} />
      <Card title={<span className="bos-row" style={{ gap: 8 }}><Tx>المرحلة</Tx><StatusBadge tone={stage?.is_review ? "warning" : item.approved_at ? "success" : "neutral"} label={stage?.name ?? item.stage} />{item.approved_at ? <span className="bos-tag">✓ <Tx>معتمد</Tx></span> : null}</span>}>
        <KeyValues items={[
          { label: "النوع", value: <Tx>{typeLabels[item.content_type] ?? item.content_type}</Tx> },
          { label: "المسؤول", value: item.owner_id ? names.get(item.owner_id) ?? "—" : "—" },
          { label: "الموعد النهائي", value: item.deadline ?? "—" },
          { label: "موعد النشر", value: item.publish_date ? formatDateTime(item.publish_date) : "—" },
          { label: "اعتمده", value: item.approved_by ? `${names.get(item.approved_by) ?? "—"} · ${formatDateTime(item.approved_at)}` : "—" },
          { label: "ملاحظات المراجعة", value: item.review_note ?? "—", hidden: !item.review_note },
        ]} />
        {canEdit ? <div style={{ marginTop: 10 }}><StageControls id={item.id} stage={item.stage} stages={stages.map((s) => ({ key: s.key, name: s.name, requires_approval: s.requires_approval }))} isReview={!!stage?.is_review} canApprove={can(bos, "content.approve")} approved={!!item.approved_at} /></div> : null}
      </Card>
      <div className="bos-grid-2" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Card title="المهام"><TaskList itemId={item.id} tasks={tasks} staff={staffOpts} names={Object.fromEntries(names)} /></Card>
      </div>
      {canEdit ? <Card title="الكتابة بالذكاء الاصطناعي"><AiPanel itemId={item.id} drafts={drafts} aiReady={!!ai} /></Card> : null}
      <Card title="الملفات"><FileManager entityType="content_item" entityId={item.id} canUpload={can(bos, "files.create") && canEdit} /></Card>
      {canEdit ? <Card title="التفاصيل"><ItemForm initial={item} staff={staffOpts} canAssign={can(bos, "content.assign") || can(bos, "content.manage")} /></Card> : null}
      <Card title="سجل التغييرات" flush>
        <BosTable className="bos-table">
          <tbody>
            {(history ?? []).map((h, i) => <tr key={i}><td className="bos-nowrap">{formatDateTime(h.changed_at)}</td><td><Tx>{stageName(h.from_status)}</Tx> → <Tx>{stageName(h.to_status)}</Tx></td><td>{h.changed_by ? names.get(h.changed_by) ?? "—" : "—"}</td><td>{h.reason ?? ""}</td></tr>)}
          </tbody>
        </BosTable>
      </Card>
    </>
  );
}
