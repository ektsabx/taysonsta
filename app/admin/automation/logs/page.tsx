import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { listEvents, listRules, listRuns } from "@/services/bos/automation";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { entityHref } from "@/lib/bos/links";
import { eventCatalog } from "@/lib/bos/event-types";
import { formatDateTime } from "@/lib/bos/format";
import { RetryButton, RunSweepButton } from "../AutomationControls";

// Automation logs (docs/bos/20): workflow runs, event stream explorer, sweeps.
export default async function AutomationLogsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("automation.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "runs";
  const page = pageOf(sp);
  const canEdit = can(bos, "automation.manage");
  const [rules, names] = await Promise.all([listRules(), userNameMap()]);
  const pager = (total: number, size: number) => {
    const pages = Math.max(1, Math.ceil(total / size));
    if (pages < 2) return null;
    const href = (p: number) => `/admin/automation/logs?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]), page: String(p) })}`;
    return <div className="bos-row" style={{ justifyContent: "center", gap: 8, padding: 10 }}>{page > 1 ? <Link className="admin-btn small secondary" href={href(page - 1)}><Tx>السابق</Tx></Link> : null}<span className="bos-faint">{page}/{pages}</span>{page < pages ? <Link className="admin-btn small secondary" href={href(page + 1)}><Tx>التالي</Tx></Link> : null}</div>;
  };
  let body: React.ReactNode;
  if (view === "events") {
    const ev = await listEvents({ type: sp.type, entity: sp.entity, q: sp.q, page });
    body = (
      <>
        <FilterBar searchPlaceholder="بحث في الملخص..." filters={[{ key: "type", label: "الحدث", type: "select", options: eventCatalog.map((e) => ({ value: e.key, label: `${e.label} (${e.key})` })) }, { key: "entity", label: "نوع السجل", type: "text" }]} />
        <Card flush>
          {ev.rows.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th>#</th><th><Tx>الوقت</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>الملخص</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>معالجة</Tx></th></tr></thead>
              <tbody>
                {ev.rows.map((e) => {
                  const href = entityHref(e.entity_type, e.entity_id);
                  return (
                    <tr key={e.id}>
                      <td className="bos-num">{e.id}</td>
                      <td>{formatDateTime(e.occurred_at)}</td>
                      <td dir="ltr" style={{ fontSize: 12 }}><Tx>{e.event_type}</Tx></td>
                      <td>{href ? <Link href={href}>{e.summary}</Link> : e.summary}{e.visibility === "client" ? <span className="bos-badge tone-accent plain"><Tx>مرئي للعميل</Tx></span> : null}</td>
                      <td>{e.actor_user_id ? names.get(e.actor_user_id) ?? "—" : e.actor_type}</td>
                      <td>{e.processed_at ? "✓" : <span className="bos-faint"><Tx>بانتظار</Tx></span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد أحداث" />}
          {pager(ev.total, ev.pageSize)}
        </Card>
      </>
    );
  } else if (view === "sweeps") {
    const { data: sweeps } = await db().from("audit_logs").select("id, created_at, actor_user_id, new_value").eq("action", "system.sweep").order("created_at", { ascending: false }).limit(30);
    body = (
      <Card flush>
        {(sweeps ?? []).length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>النتائج</Tx></th></tr></thead>
            <tbody>
              {(sweeps ?? []).map((s) => {
                const res = (s.new_value as unknown as { step: string; count: number | null; error?: string }[]) ?? [];
                return <tr key={s.id}><td>{formatDateTime(s.created_at)}</td><td><Tx>{s.actor_user_id ? names.get(s.actor_user_id) ?? "—" : "المجدول"}</Tx></td><td style={{ fontSize: 12 }}>{res.map((r) => <span key={r.step} style={{ marginInlineEnd: 8, color: r.error ? "#f87171" : undefined }}>{r.step}: {r.error ? "✗" : r.count ?? "✓"}</span>)}</td></tr>;
              })}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لم تُنفَّذ فحوصات مجدولة بعد" />}
      </Card>
    );
  } else {
    const runs = await listRuns({ rule: sp.rule, status: sp.status, from: sp.from, to: sp.to, page });
    body = (
      <>
        <FilterBar filters={[{ key: "rule", label: "المسار", type: "select", options: rules.map((r) => ({ value: r.id, label: r.name })) }, { key: "status", label: "الحالة", type: "select", options: [{ value: "success", label: "نجح" }, { value: "failed", label: "فشل" }, { value: "skipped", label: "تخطّى" }, { value: "running", label: "قيد التشغيل" }] }, { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
        <Card flush>
          {runs.rows.length ? (
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>المسار</Tx></th><th><Tx>الحدث</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المدة</Tx></th><th><Tx>النتائج / الخطأ</Tx></th><th /></tr></thead>
              <tbody>
                {runs.rows.map((r) => {
                  const rule = r.automation_rules as unknown as { id: string; name: string } | null;
                  const ev = r.activity_events as unknown as { summary: string; event_type: string } | null;
                  const href = entityHref(r.entity_type, r.entity_id);
                  const results = (r.results as unknown as { type: string; status: string; detail?: string }[]) ?? [];
                  const dur = r.finished_at ? Math.max(0, new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) : null;
                  return (
                    <tr key={r.id}>
                      <td>{formatDateTime(r.started_at)}{r.is_retry ? <span className="cell-sub"><Tx>إعادة تشغيل</Tx></span> : null}</td>
                      <td>{rule ? <Link href={`/admin/automation/workflows/${rule.id}`}>{rule.name}</Link> : "—"}</td>
                      <td>{href ? <Link href={href}>{ev?.summary ?? r.entity_type}</Link> : ev?.summary ?? "—"}</td>
                      <td><StatusBadge tone={r.status === "success" ? "success" : r.status === "failed" ? "danger" : "neutral"} label={r.status} /></td>
                      <td className="bos-num">{dur != null ? `${dur} ms` : "—"}</td>
                      <td style={{ fontSize: 12 }}>{r.error ? <span style={{ color: "var(--bos-danger)" }}><Tx>{r.error}</Tx></span> : results.map((x) => `${x.type}: ${x.status}`).join(" · ")}</td>
                      <td>{canEdit && r.status === "failed" ? <RetryButton id={r.id} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          ) : <EmptyState title="لا توجد تشغيلات" />}
          {pager(runs.total, runs.pageSize)}
        </Card>
      </>
    );
  }
  return (
    <>
      <PageHeader title="سجل الأتمتة" actions={canEdit ? <RunSweepButton /> : null} />
      <Tabs param="view" active={view} baseHref="/admin/automation/logs" tabs={[{ key: "runs", label: "تشغيلات المسارات" }, { key: "events", label: "سجل الأحداث" }, { key: "sweeps", label: "الفحوصات المجدولة" }]} />
      {body}
    </>
  );
}
