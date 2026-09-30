import { Tx } from "@/components/bos/I18n";
import { nowIso } from "@/lib/bos/clock";
import Link from "next/link";
import { StatusBadge, EmptyState, ProgressBar } from "@/components/bos/ui";
import { formatDate, formatDateTime, formatMinutes, formatTime } from "@/lib/bos/format";
import { sectionLabels } from "@/services/bos/onboarding";
import { ChecklistTaskEditor } from "./HrControls";
import { AccessStatusSelect, ChecklistToggle, CancelLeaveButton } from "./TeamControls";

type ChecklistItem = { id: string; section: string; label: string; auto_key: string | null; responsible: string | null; required: boolean; is_done: boolean; done_by: string | null; done_at: string | null; status?: string; assignee_user_id?: string | null; due_date?: string | null; notes?: string | null };

const confirmLabels: Record<string, string> = { "confirm:employee": "الموظف", "confirm:manager": "المدير", "confirm:admin": "الإدارة", "confirm:hr": "الموارد البشرية", "confirm:final": "الموافقة النهائية" };

// Onboarding / offboarding checklist grouped by section (IT §15–16).
export function ChecklistView({
  employeeId,
  checklist,
  names,
  canManage,
  links = {},
}: {
  employeeId: string;
  checklist: { id: string; template_key: string; status: string; due_date: string | null; completed_at: string | null; created_at: string; items: ChecklistItem[]; sections: { section: string; done: number; total: number; complete: boolean }[]; percent: number };
  names: Map<string, string>;
  canManage: boolean;
  links?: Record<string, { href: string; label: string }>;
}) {
  const sections = [...new Set(checklist.items.map((i) => i.section))];
  const open = checklist.status === "in_progress";
  return (
    <div className="bos-stack" style={{ gap: 12 }}>
      <div>
        <ProgressBar value={checklist.percent} tone={checklist.percent === 100 ? "success" : undefined} />
        <div className="bos-faint" style={{ fontSize: 12, marginTop: 4 }}>
          {checklist.percent}% · بدأت {formatDate(checklist.created_at)}
          {checklist.due_date ? ` · الاستحقاق ${formatDate(checklist.due_date)}` : ""}
          {checklist.completed_at ? ` · اكتملت ${formatDate(checklist.completed_at)}` : ""}
          {checklist.status === "cancelled" ? " · ملغاة" : ""}
        </div>
        <div className="bos-row" style={{ gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 12.5 }}>
          {checklist.sections.map((s) => (
            <span key={s.section}>{s.complete ? "✓" : "○"} {sectionLabels[s.section] ?? s.section} <span className="bos-faint">({s.done}/{s.total})</span></span>
          ))}
        </div>
      </div>
      {sections.map((section) => (
        <div key={section}>
          <div style={{ fontWeight: 600, fontSize: 13, margin: "6px 0" }}><Tx>{sectionLabels[section] ?? section}</Tx></div>
          <table className="bos-table">
            <tbody>
              {checklist.items.filter((i) => i.section === section).map((it) => {
                const link = it.auto_key ? links[it.auto_key] ?? (it.auto_key.startsWith("read:") ? { href: `/admin/knowledge/articles/${it.auto_key.slice(5)}`, label: "فتح المقال" } : undefined) : undefined;
                const isConfirm = it.auto_key?.startsWith("confirm:");
                const isAuto = !!it.auto_key && !isConfirm;
                return (
                  <tr key={it.id}>
                    <td style={{ width: 34 }}>
                      <ChecklistToggle employeeId={employeeId} itemId={it.id} done={it.is_done} disabled={!open || (isAuto && !canManage && !it.auto_key?.startsWith("read:"))} title={isAuto ? "يكتمل تلقائياً من بيانات النظام" : undefined} />
                    </td>
                    <td>
                      <span style={it.is_done ? { textDecoration: "line-through", opacity: 0.7 } : undefined}><Tx>{it.label}</Tx></span>
                      {isAuto ? <span className="bos-badge tone-neutral plain" style={{ marginInlineStart: 6 }}><Tx>تلقائي</Tx></span> : null}
                      {isConfirm ? <span className="bos-badge tone-accent plain" style={{ marginInlineStart: 6 }}>تأكيد: {confirmLabels[it.auto_key as string] ?? ""}</span> : null}
                      {!it.required ? <span className="bos-faint" style={{ marginInlineStart: 6, fontSize: 12 }}><Tx>(اختياري)</Tx></span> : null}
                      {link && !it.is_done ? <Link className="bos-link" style={{ marginInlineStart: 8, fontSize: 12 }} href={link.href}><Tx>{link.label}</Tx></Link> : null}
                    </td>
                    <td className="bos-faint" style={{ fontSize: 12 }}>
                      {it.done_at ? `${it.done_by ? names.get(it.done_by) ?? "النظام" : "النظام"} · ${formatDate(it.done_at)}` : ""}
                      {!it.is_done && it.assignee_user_id ? <span style={{ display: "block" }}>المسؤول: {names.get(it.assignee_user_id) ?? "—"}{it.due_date ? ` · قبل ${formatDate(it.due_date)}` : ""}</span> : null}
                      {it.notes ? <span style={{ display: "block" }}><Tx vars={{ notes: it.notes }}>{"ملاحظة: {notes}"}</Tx></span> : null}
                    </td>
                    {open && !isConfirm ? (
                      <td style={{ width: 1 }}>
                        <ChecklistTaskEditor employeeId={employeeId} item={{ id: it.id, status: it.status ?? (it.is_done ? "done" : "pending"), assignee_user_id: it.assignee_user_id ?? null, due_date: it.due_date ?? null, notes: it.notes ?? null, required: it.required, auto_key: isAuto ? it.auto_key : null }} staff={[...names.entries()].map(([value, label]) => ({ value, label }))} canManage={canManage} />
                      </td>
                    ) : <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

type Grant = { id: string; status: string; access_level: string | null; is_required: boolean; needs_review: boolean; vault: string | null; expires_at: string | null; granted_at: string | null; external_apps: unknown };

export function AccessProfileView({ employeeId, grants, canManage }: { employeeId: string; grants: Grant[]; canManage: boolean }) {
  if (!grants.length) return <EmptyState title="لا يوجد ملف صلاحيات بعد" description="يُولَّد تلقائياً من أدوار الموظف عند إنشاء حساب الدخول." />;
  const groups: { key: string; label: string; filter: (g: Grant) => boolean }[] = [
    { key: "missing", label: "مطلوبة وغير مفعّلة", filter: (g) => g.is_required && g.status !== "active" && !["revoked", "expired"].includes(g.status) },
    { key: "granted", label: "مفعّلة", filter: (g) => ["active", "provisioned"].includes(g.status) },
    { key: "pending", label: "قيد الطلب", filter: (g) => ["requested", "pending"].includes(g.status) && !g.is_required },
    { key: "revoked", label: "مسحوبة / مرفوضة", filter: (g) => ["revoked", "rejected"].includes(g.status) },
    { key: "expired", label: "منتهية", filter: (g) => g.status === "expired" },
    { key: "other", label: "أخرى (غير مطلوبة)", filter: (g) => !g.is_required && g.status === "not_started" },
  ];
  const shown = new Set<string>();
  return (
    <div className="bos-stack" style={{ gap: 14 }}>
      {groups.map((grp) => {
        const rows = grants.filter((g) => !shown.has(g.id) && grp.filter(g));
        rows.forEach((g) => shown.add(g.id));
        if (!rows.length) return null;
        return (
          <div key={grp.key}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}><Tx>{grp.label}</Tx> <span className="bos-faint">({rows.length})</span></div>
            <table className="bos-table responsive">
              <tbody>
                {rows.map((g) => {
                  const app = g.external_apps as { name: string; category: string; access_levels: string[]; requires_mfa: boolean; is_sensitive: boolean };
                  return (
                    <tr key={g.id}>
                      <td className="cell-primary" data-label="التطبيق">
                        {app.name}
                        <span className="cell-sub">
                          {app.category}
                          {g.is_required ? " · مطلوب" : ""}
                          {app.is_sensitive ? " · حساس" : ""}
                          {app.requires_mfa ? " · يتطلب 2FA" : ""}
                          {g.vault ? ` · خزنة: ${g.vault}` : ""}
                        </span>
                        {g.needs_review ? <span className="bos-badge tone-warning plain"><Tx>يحتاج مراجعة</Tx></span> : null}
                      </td>
                      <td data-label="الحالة">
                        {canManage ? <AccessStatusSelect employeeId={employeeId} grantId={g.id} status={g.status} level={g.access_level} levels={app.access_levels} /> : <><StatusBadge map="access_status" value={g.status} />{g.access_level ? <span className="cell-sub"><Tx>{g.access_level}</Tx></span> : null}</>}
                      </td>
                      <td data-label="منذ" className="bos-faint" style={{ fontSize: 12 }}>{g.granted_at ? formatDate(g.granted_at) : ""}{g.expires_at ? ` · ينتهي ${formatDate(g.expires_at)}` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

type AttendanceRow = { id: string; work_date: string; status: string; first_clock_in: string | null; last_clock_out: string | null; worked_minutes: number; expected_minutes: number; overtime_minutes: number; late_minutes: number; break_minutes: number; requires_review: boolean; review_reason: string | null; timezone: string; attendance_sessions?: unknown };

export function AttendanceTable({ rows, actions }: { rows: AttendanceRow[]; actions?: (r: AttendanceRow) => React.ReactNode }) {
  if (!rows.length) return <EmptyState title="لا توجد سجلات حضور في هذه الفترة" />;
  return (
    <div className="bos-table-scroll">
      <table className="bos-table responsive">
        <thead>
          <tr>
            <th><Tx>اليوم</Tx></th>
            <th><Tx>الحالة</Tx></th>
            <th><Tx>الدخول</Tx></th>
            <th><Tx>الخروج</Tx></th>
            <th><Tx>العمل</Tx></th>
            <th><Tx>المتوقع</Tx></th>
            <th><Tx>إضافي</Tx></th>
            <th><Tx>تأخير</Tx></th>
            {actions ? <th className="col-actions" /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sessions = ((r.attendance_sessions as { id: string; clock_in_at: string; clock_out_at: string | null; auto_closed: boolean; source: string }[]) ?? []).sort((a, b) => (a.clock_in_at < b.clock_in_at ? -1 : 1));
            return (
              <tr key={r.id}>
                <td className="cell-primary cell-primary-mobile" data-label="اليوم">
                  {formatDate(r.work_date)}
                  {sessions.length > 1 ? <span className="cell-sub"><Tx vars={{ sessions_count: sessions.length }}>{"{sessions_count} جلسات"}</Tx></span> : null}
                  {r.requires_review ? <span className="bos-badge tone-warning plain" title={r.review_reason ?? undefined}><Tx>يحتاج مراجعة</Tx></span> : null}
                  {sessions.some((s) => s.auto_closed) ? <span className="bos-badge tone-danger plain"><Tx>إغلاق تلقائي</Tx></span> : null}
                </td>
                <td data-label="الحالة"><StatusBadge map="attendance_status" value={r.status} /></td>
                <td data-label="الدخول">{r.first_clock_in ? formatTime(r.first_clock_in, r.timezone) : "—"}</td>
                <td data-label="الخروج">{r.last_clock_out ? formatTime(r.last_clock_out, r.timezone) : r.first_clock_in ? <span className="bos-faint"><Tx>جارٍ</Tx></span> : "—"}</td>
                <td data-label="العمل">{formatMinutes(r.worked_minutes)}</td>
                <td data-label="المتوقع">{formatMinutes(r.expected_minutes)}</td>
                <td data-label="إضافي">{r.overtime_minutes ? formatMinutes(r.overtime_minutes) : "—"}</td>
                <td data-label="تأخير">{r.late_minutes ? `${r.late_minutes} د` : "—"}</td>
                {actions ? <td className="col-actions">{actions(r)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type LeaveRow = { id: string; user_id: string; start_date: string; end_date: string; half_day: boolean; duration_days: number; status: string; reason: string | null; decision_comment: string | null; created_at: string; leave_types: unknown };

export function LeaveTable({ rows, names, viewerId, canManage, showEmployee }: { rows: LeaveRow[]; names: Map<string, string>; viewerId: string; canManage: boolean; showEmployee?: boolean }) {
  if (!rows.length) return <EmptyState title="لا توجد طلبات إجازة" />;
  const today = nowIso().slice(0, 10);
  return (
    <div className="bos-table-scroll">
      <table className="bos-table responsive">
        <thead>
          <tr>
            {showEmployee ? <th><Tx>الموظف</Tx></th> : null}
            <th><Tx>النوع</Tx></th>
            <th><Tx>الفترة</Tx></th>
            <th><Tx>المدة</Tx></th>
            <th><Tx>الحالة</Tx></th>
            <th><Tx>السبب</Tx></th>
            <th className="col-actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const t = l.leave_types as { name: string; is_paid: boolean } | null;
            const cancellable = (l.status === "pending" || (l.status === "approved" && (l.start_date > today || canManage))) && (l.user_id === viewerId || canManage);
            return (
              <tr key={l.id}>
                {showEmployee ? <td className="cell-primary" data-label="الموظف">{names.get(l.user_id) ?? "—"}</td> : null}
                <td data-label="النوع" className={showEmployee ? undefined : "cell-primary cell-primary-mobile"}>{t?.name ?? "—"}{t && !t.is_paid ? <span className="cell-sub"><Tx>غير مدفوعة</Tx></span> : null}</td>
                <td data-label="الفترة">{formatDate(l.start_date)}{l.end_date !== l.start_date ? ` → ${formatDate(l.end_date)}` : ""}{l.half_day ? " (نصف يوم)" : ""}</td>
                <td data-label="المدة"><Tx vars={{ v: Number(l.duration_days) }}>{"{v} يوم"}</Tx></td>
                <td data-label="الحالة"><StatusBadge map="leave_status" value={l.status} />{l.decision_comment ? <span className="cell-sub">{l.decision_comment}</span> : null}</td>
                <td data-label="السبب" style={{ maxWidth: 260 }}>{l.reason ?? "—"}</td>
                <td className="col-actions">{cancellable ? <CancelLeaveButton id={l.id} /> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function minutesToHours(m: number) {
  return formatMinutes(m);
}

export { formatDateTime };
