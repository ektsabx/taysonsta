import { Tx } from "@/components/bos/I18n";
import type { Tables } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { StatusBadge, EmptyState } from "@/components/bos/ui";
import { ActivityRowActions } from "@/components/bos/ActivityRowActions";

// List of activities/communications for an entity tab.
export function ActivityList({ activities, names, emptyTitle = "لا توجد أنشطة بعد" }: { activities: Tables<"activities">[]; names: Map<string, string>; emptyTitle?: string }) {
  if (!activities.length) return <EmptyState title={emptyTitle} description="سجّل المكالمات والرسائل والمتابعات هنا ليظهر كل شيء في سجل النشاط." />;
  return (
    <div className="bos-table-scroll">
      <table className="bos-table responsive">
        <thead>
          <tr>
            <th><Tx>النشاط</Tx></th>
            <th><Tx>النوع</Tx></th>
            <th><Tx>الاتجاه</Tx></th>
            <th><Tx>المسؤول</Tx></th>
            <th><Tx>الموعد / التاريخ</Tx></th>
            <th><Tx>الحالة</Tx></th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {activities.map((a) => (
            <tr key={a.id}>
              <td className="cell-primary cell-primary-mobile" data-label="النشاط">
                {a.title}
                {a.description ? <span className="cell-sub" style={{ whiteSpace: "pre-wrap" }}>{a.description.slice(0, 200)}</span> : null}
                {a.outcome ? <span className="cell-sub"><Tx vars={{ outcome: a.outcome }}>{"النتيجة: {outcome}"}</Tx></span> : null}
              </td>
              <td data-label="النوع">{statusLabel("activity_type", a.type)}</td>
              <td data-label="الاتجاه"><Tx>{a.direction === "inbound" ? "وارد" : a.direction === "outbound" ? "صادر" : "—"}</Tx></td>
              <td data-label="المسؤول">{a.assigned_to ? names.get(a.assigned_to) ?? "—" : "—"}</td>
              <td data-label="الموعد">{formatDateTime(a.due_at ?? a.completed_at ?? a.created_at)}</td>
              <td data-label="الحالة">
                <StatusBadge map="activity_status" value={a.status} />
              </td>
              <td className="col-actions">{a.status !== "completed" && a.status !== "cancelled" ? <ActivityRowActions id={a.id} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
