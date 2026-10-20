import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requirePermission } from "@/lib/bos/auth";
import { Card, EmptyState, KeyValues, PageHeader, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { MessagingNotReady, NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { NotFoundError } from "@/lib/bos/errors";
import { eventDef } from "../../../../../../Yolias/lib/messaging/catalog";
import { flowErrors, type FlowDefinition } from "../../../../../../Yolias/lib/messaging/flow";
import { messagingReady, flowReach, getFlow, getSettings, listSegments, listTemplates } from "@/services/yolias/messaging";
import { FlowBuilder } from "../../_ui/FlowBuilder";
import { FlowStatusButtons, TestRunForm } from "../../_ui/Forms";
import { classLabel, enrollmentStatus, flowStatus } from "../../_ui/labels";

// One automation or sequence: the builder, its status and test mode, a test
// run, its versions and the people currently in it.
export default async function FlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المسار" /><NotConnected /></>);
  if (!(await messagingReady())) return (<><PageHeader title="المسار" /><MessagingNotReady /></>);
  const { id } = await params;
  const data = await getFlow(id).catch((e) => { if (e instanceof NotFoundError) notFound(); throw e; });
  const { flow, versions, recent } = data;
  const [templates, segments, settings, reach] = await Promise.all([listTemplates(), listSegments(), getSettings(), flowReach(flow).catch(() => null)]);
  const canManage = can(bos, "platform.manage", "all");
  const st = flowStatus[flow.status as keyof typeof flowStatus];
  const def: FlowDefinition = { kind: flow.kind, trigger_event: flow.trigger_event, steps: flow.steps, entry_rules: flow.entry_rules, exit_rules: flow.exit_rules, exit_events: flow.exit_events, goal_event: flow.goal_event, reentry: flow.reentry, reentry_days: flow.reentry_days, send_window: flow.send_window as FlowDefinition["send_window"] };
  const problems = flowErrors(def, new Set(templates.map((t) => t.id)));
  const testEmails = [...new Set([...flow.test_emails, ...settings.test_emails, bos.email.toLowerCase()])];
  const list = flow.kind === "sequence" ? "/admin/platform/messaging/sequences" : "/admin/platform/messaging/automations";
  return (
    <>
      <PageHeader title={flow.name} subtitle={flow.kind === "sequence" ? "تسلسل إيميلات" : "أتمتة"}
        actions={<span className="msg-actions"><Link className="admin-btn secondary" href={list}><Tx>كل المسارات</Tx></Link>{canManage && <FlowStatusButtons id={flow.id} status={flow.status} testMode={flow.test_mode} />}</span>} />
      <Card>
        <KeyValues items={[
          { label: "الحالة", value: <StatusBadge tone={st.tone} label={st.label} /> },
          { label: "الوضع", value: flow.test_mode ? <StatusBadge tone="warning" label="وضع الاختبار" /> : <StatusBadge tone="success" label="حقيقي: يصل لكل من تنطبق عليه الشروط" /> },
          { label: "نوع الرسائل", value: <Tx>{classLabel[flow.category]}</Tx> },
          { label: "يبدأ عند", value: <Tx>{eventDef(flow.trigger_event)?.label ?? flow.trigger_event}</Tx> },
          { label: "النسخة", value: num(flow.version) },
          { label: "ينطبق عليهم الآن", value: reach ? <Tx vars={{ a: num(reach.matching), b: num(reach.reachable) }}>{"{a} مستخدم يطابق الشروط، {b} يمكن مراسلته"}</Tx> : "-" },
        ]} />
        {problems.length > 0 && <ul className="msg-problems" role="alert">{problems.map((p) => <li key={p}><Tx>{p}</Tx></li>)}</ul>}
        {!flow.test_mode && flow.status !== "active" && <p className="bos-hint"><Tx>عند التفعيل خارج وضع الاختبار يدخل كل مستخدم يحدث له الحدث من الآن (الأحداث السابقة لا تبدأ المسار).</Tx></p>}
      </Card>

      <FlowBuilder flow={flow} canManage={canManage}
        templates={templates.map((t) => ({ value: t.id, label: `${t.name} · ${classLabel[t.category] ?? t.category}` }))}
        segments={segments.map((s) => ({ value: s.id, label: s.name }))} />

      {canManage && (
        <Card title="تجربة المسار">
          <TestRunForm id={flow.id} emails={testEmails} />
        </Card>
      )}

      <Card title="المستخدمون في هذا المسار (آخر 50)">
        {recent.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>المستخدم</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>الخطوة</Tx></th><th><Tx>الخطوة التالية</Tx></th><th><Tx>دخل</Tx></th><th><Tx>السبب</Tx></th></tr></thead>
            <tbody>
              {recent.map((e) => {
                const es = enrollmentStatus[e.status as keyof typeof enrollmentStatus];
                return (
                  <tr key={e.id}>
                    <td data-label="المستخدم" dir="ltr"><Link className="bos-link" href={`/admin/platform/messaging/activity/${e.id}`}>{e.email ?? e.user_id}</Link>{e.test ? <span className="cell-sub"><Tx>تجربة</Tx></span> : null}</td>
                    <td data-label="الحالة"><StatusBadge tone={es.tone} label={es.label} />{e.goal_at ? <span className="cell-sub"><Tx>اشترك</Tx></span> : null}</td>
                    <td data-label="الخطوة" dir="ltr">{e.current_step ?? "-"}</td>
                    <td data-label="الخطوة التالية">{e.status === "active" && e.next_run_at ? formatDateTime(e.next_run_at) : "-"}</td>
                    <td data-label="دخل">{formatDateTime(e.entered_at)}</td>
                    <td data-label="السبب" dir="auto">{e.exit_reason ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم يدخل أحد بعد" />}
      </Card>

      <Card title="النسخ">
        {versions.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>النسخة</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{versions.map((v) => <tr key={v.version}><td className="bos-num">{v.version}</td><td dir="ltr">{v.created_by ?? "-"}</td><td>{formatDateTime(v.created_at)}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا نسخ محفوظة بعد" />}
        <p className="bos-hint"><Tx>من دخل المسار يكمل على النسخة التي دخل بها؛ التعديلات تنطبق على من يدخل بعدها.</Tx></p>
      </Card>
    </>
  );
}
