import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { db } from "@/lib/bos/db";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, StatusBadge } from "@/components/bos/ui";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { formatDateTime } from "@/lib/bos/format";
import { IssueStatusSelect } from "../../[id]/ProjectControls";

export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("issues.read");
  const { id } = await params;
  const { data: i, error } = await db().from("issues").select("*, projects(id, name)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!i) notFound();
  if (i.assigned_to !== bos.userId && !(await canAccessEntity(bos, "project", i.project_id))) notFound();
  const names = await userNameMap();
  const p = i.projects as unknown as { id: string; name: string };
  return (
    <>
      <PageHeader title={i.title} subtitle={<StatusBadge map="severity" value={i.severity} />} />
      <Summary
        items={[
          { label: "الحالة", value: can(bos, "issues.update") ? <IssueStatusSelect id={id} status={i.status} /> : <StatusBadge map="issue_status" value={i.status} /> },
          { label: "المشروع", value: <Link href={`/admin/projects/${p.id}?tab=issues`}>{p.name}</Link> },
          { label: "المسؤول", value: i.assigned_to ? names.get(i.assigned_to) : "—" },
          { label: "أبلغ عنها", value: i.reported_by ? names.get(i.reported_by) : "—" },
          { label: "التاريخ", value: formatDateTime(i.created_at) },
          { label: "حُلّت", value: i.resolved_at ? formatDateTime(i.resolved_at) : "—" },
        ]}
      />
      <div className="bos-grid main-side">
        <div>
          <Card title="الوصف">{i.description ? <div className="bos-prose"><Tx>{i.description}</Tx></div> : <div className="bos-faint"><Tx>لا يوجد وصف.</Tx></div>}</Card>
          <Card title="النقاش"><Comments entityType="issue" entityId={id} viewerId={bos.userId} /></Card>
        </div>
        <Card title="المرفقات"><FileManager entityType="issue" entityId={id} canUpload={can(bos, "files.create")} /></Card>
      </div>
    </>
  );
}
