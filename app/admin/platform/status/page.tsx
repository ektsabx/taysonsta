import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, yoliasLink } from "./ui";
import { overview } from "@/services/yolias/status";
import { ComponentForm, IncidentUpdateForm, NewIncidentForm, SettingsForm } from "./StatusForms";

const statusLabel: Record<string, string> = { operational: "تعمل", degraded: "أداء أبطأ", partial_outage: "توقف جزئي", major_outage: "توقف كامل", no_data: "لا توجد بيانات", maintenance: "صيانة" };
const tone = (s: string | null) => (s === "operational" ? "success" : s === "degraded" ? "warning" : s === "partial_outage" || s === "major_outage" ? "danger" : "neutral") as "success" | "warning" | "danger" | "neutral";
const incLabel: Record<string, string> = { investigating: "قيد التحقق", identified: "تم تحديد السبب", monitoring: "تحت المراقبة", resolved: "تم الحل", scheduled: "مجدولة", in_progress: "جارية", completed: "اكتملت" };

// Status management (D-181): what yolias.com/status shows. The checks run in
// Yolias's worker; incidents and maintenance are published from here.
export default async function StatusManagementPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="صفحة الحالة" /><NotConnected /></>);
  const o = await overview();
  const canEdit = can(bos, "platform.manage", "all");
  const names = new Map(o.components.map((c) => [c.id, c.name_ar]));
  const open = o.incidents.filter((i) => !["resolved", "completed"].includes(i.status));
  const closed = o.incidents.filter((i) => ["resolved", "completed"].includes(i.status));
  return (
    <>
      <PageHeader title="صفحة الحالة" subtitle={<Tx>الخدمات والفحوص والأعطال والصيانة المعروضة على صفحة الحالة العامة.</Tx>} actions={<a className="admin-btn secondary small" href={yoliasLink("/status")} target="_blank" rel="noopener noreferrer"><Tx>فتح الصفحة العامة</Tx></a>} />
      <Card title="الخدمات وآخر فحص" flush>
        <div className="bos-table-scroll">
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الخدمة</Tx></th><th><Tx>آخر نتيجة</Tx></th><th><Tx>فشل متتالٍ</Tx></th><th><Tx>زمن الاستجابة</Tx></th><th><Tx>آخر فحص</Tx></th><th><Tx>تفاصيل للفريق</Tx></th></tr></thead>
            <tbody>
              {o.components.map((c) => {
                const last = o.checks.find((x) => x.component_id === c.id);
                return (
                  <tr key={c.id}>
                    <td>{c.name_ar}<span className="cell-sub" dir="ltr">{c.check_kind}{c.is_public ? "" : " · hidden"}</span></td>
                    <td>{c.check_kind === "manual" ? <Tx>يدوي (الأعطال فقط)</Tx> : <StatusBadge tone={tone(c.last_status)} label={statusLabel[c.last_status ?? "no_data"]} />}</td>
                    <td>{c.fail_streak}</td>
                    <td dir="ltr">{c.last_latency_ms != null ? `${c.last_latency_ms} ms` : "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{c.last_checked_at ? formatDateTime(c.last_checked_at) : <Tx>لم يُفحص بعد</Tx>}</td>
                    <td dir="ltr" style={{ fontSize: 12 }}>{last?.detail ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </BosTable>
        </div>
        <p className="bos-faint" style={{ fontSize: 12, padding: "8px 16px" }}><Tx>تُشغَّل الفحوص من عامل يولياس (worker). إذا توقف العامل تظهر الخدمات في الصفحة العامة «لا توجد بيانات حديثة» ولا تظهر كأنها تعمل.</Tx></p>
      </Card>
      {canEdit ? <Card title="نشر عطل أو صيانة"><NewIncidentForm components={o.components.map((c) => ({ id: c.id, name: c.name_ar }))} /></Card> : null}
      <Card title="الأعطال والصيانة المفتوحة">
        {open.length ? open.map((i) => (
          <div key={i.id} className="status-admin-incident">
            <div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
              <strong>{i.title}</strong>
              <StatusBadge tone={i.kind === "maintenance" ? "info" : tone(i.impact)} label={statusLabel[i.impact]} />
              <StatusBadge tone="neutral" label={incLabel[i.status]} />
            </div>
            <div className="cell-sub">{i.components.map((c) => names.get(c) ?? c).join("، ")} · {formatDateTime(i.started_at)} · {i.created_by}</div>
            <ul className="aff-events">{i.updates.map((u) => <li key={u.id}><span className="cell-sub">{formatDateTime(u.created_at)}</span><span dir="auto">{incLabel[u.status] ?? u.status}: {u.body}</span><span className="cell-sub" dir="ltr">{u.created_by}</span></li>)}</ul>
            {canEdit ? <IncidentUpdateForm id={i.id} kind={i.kind} /> : null}
          </div>
        )) : <EmptyState title="لا توجد أعطال مفتوحة" />}
      </Card>
      <Card title="السجل">
        {closed.length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>العنوان</Tx></th><th><Tx>النوع</Tx></th><th><Tx>البداية</Tx></th><th><Tx>الإغلاق</Tx></th><th><Tx>التحديثات</Tx></th></tr></thead>
            <tbody>{closed.map((i) => <tr key={i.id}><td>{i.title}</td><td><Tx>{i.kind === "maintenance" ? "صيانة" : statusLabel[i.impact]}</Tx></td><td>{formatDateTime(i.started_at)}</td><td>{i.resolved_at ? formatDateTime(i.resolved_at) : "—"}</td><td>{i.updates.length}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد سجل بعد" />}
      </Card>
      {canEdit ? (
        <>
          <Card title="إعدادات الفحص"><SettingsForm v={o.settings} /></Card>
          <Card title="أسماء الخدمات الظاهرة">
            {o.components.map((c) => <details key={c.id} className="cx-section"><summary>{c.name_ar}</summary><ComponentForm c={c} /></details>)}
          </Card>
        </>
      ) : null}
    </>
  );
}
