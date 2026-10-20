import Link from "next/link";
import { Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { num } from "@/components/yolias/PlatformUi";
import { eventDef } from "../../../../../Yolias/lib/messaging/catalog";
import { describeStep, stepsSchema } from "../../../../../Yolias/lib/messaging/flow";
import { listFlows, listTemplates } from "@/services/yolias/messaging";
import { classLabel, flowStatus, pct } from "./labels";
import { NewItemForm } from "./Forms";

/** Automations or sequences: status, trigger, steps and results, plus a new one. */
export async function FlowList({ kind, canManage }: { kind: "automation" | "sequence"; canManage: boolean }) {
  const [flows, templates] = await Promise.all([listFlows(kind), listTemplates(true)]);
  const name = (id: string) => templates.find((t) => t.id === id)?.name ?? "قالب محذوف";
  return (
    <>
      <Card title={kind === "sequence" ? "التسلسلات" : "الأتمتة"}>
        {flows.length ? (
          <BosTable className="bos-table responsive stacked">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>يبدأ عند</Tx></th><th><Tx>الخطوات</Tx></th><th><Tx>دخل</Tx></th><th><Tx>داخل الآن</Tx></th><th><Tx>حقق الهدف</Tx></th></tr></thead>
            <tbody>
              {flows.map((f) => {
                const st = flowStatus[f.status as keyof typeof flowStatus];
                const steps = stepsSchema.safeParse(f.steps);
                return (
                  <tr key={f.id}>
                    <td data-label="الاسم"><Link className="bos-link" href={`/admin/platform/messaging/flows/${f.id}`}><strong>{f.name}</strong></Link><span className="cell-sub"><Tx>{classLabel[f.category]}</Tx>{f.test_mode ? <> · <Tx>وضع الاختبار</Tx></> : null}</span></td>
                    <td data-label="الحالة"><StatusBadge tone={st.tone} label={st.label} /></td>
                    <td data-label="يبدأ عند"><Tx>{eventDef(f.trigger_event)?.label ?? f.trigger_event}</Tx></td>
                    <td data-label="الخطوات">
                      {steps.success ? (
                        <ol className="msg-mini-steps">{steps.data.slice(0, kind === "sequence" ? 12 : 4).map((s) => <li key={s.id} dir="auto"><Tx>{describeStep(s, name)}</Tx></li>)}</ol>
                      ) : <span className="bos-faint"><Tx>غير مكتمل</Tx></span>}
                    </td>
                    <td data-label="دخل" className="bos-num">{num(f.stats.entered)}</td>
                    <td data-label="داخل الآن" className="bos-num">{num(f.stats.active)}</td>
                    <td data-label="حقق الهدف" className="bos-num">{num(f.stats.goal)} <span className="cell-sub">{pct(f.stats.goal, f.stats.entered)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title={kind === "sequence" ? "لا توجد تسلسلات" : "لا توجد أتمتة"} />}
      </Card>
      {canManage && (
        <Card title={kind === "sequence" ? "تسلسل جديد" : "أتمتة جديدة"}>
          <NewItemForm kind={kind} />
        </Card>
      )}
    </>
  );
}
