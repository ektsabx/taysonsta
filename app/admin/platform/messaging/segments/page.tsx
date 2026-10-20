import { can, requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, PageHeader } from "@/components/bos/ui";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected } from "@/components/yolias/PlatformUi";
import { describeRule, rulesSchema } from "../../../../../Yolias/lib/messaging/rules";
import { messagingReady, listSegments } from "@/services/yolias/messaging";
import { ArchiveSegmentButton, SegmentForm } from "../_ui/Forms";

// Audience & Segments (D-243): saved rule sets on real user data (account,
// plan, trial, checkout, usage, activity), reused by flows and campaigns.
export default async function SegmentsPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الجمهور والشرائح" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="الجمهور والشرائح" /><MessagingNotReady /></>);
  const segments = await listSegments();
  const canManage = can(bos, "platform.manage", "all");
  return (
    <>
      <PageHeader title="الجمهور والشرائح" subtitle="شرائح محفوظة من بيانات المستخدمين والاشتراكات والأحداث الحالية، تُستخدم في الحملات والأتمتة." />
      {segments.length ? segments.map((s) => {
        const rules = rulesSchema.safeParse(s.rules);
        return (
          <Card key={s.id} title={s.name} actions={canManage ? <ArchiveSegmentButton id={s.id} /> : undefined}>
            {s.description ? <p className="bos-faint" dir="auto">{s.description}</p> : null}
            <ul className="msg-list">{(rules.success ? rules.data : []).map((r, i) => <li key={i}><Tx>{describeRule(r)}</Tx></li>)}</ul>
            <p className="bos-hint"><Tx vars={{ d: formatDateTime(s.updated_at) }}>{"آخر تعديل {d}"}</Tx></p>
            {canManage && <details className="msg-details"><summary><Tx>تعديل</Tx></summary><SegmentForm segment={{ id: s.id, name: s.name, description: s.description, rules: rules.success ? rules.data : [] }} /></details>}
          </Card>
        );
      }) : <Card><EmptyState title="لا توجد شرائح بعد" /></Card>}
      {canManage && <Card title="شريحة جديدة"><SegmentForm /></Card>}
    </>
  );
}
