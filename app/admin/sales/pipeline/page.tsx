import { Tx } from "@/components/bos/I18n";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { requireBosUser, scopeUserIds } from "@/lib/bos/auth";
import { redirect } from "next/navigation";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getPipeline, listActiveStaff, userNameMap } from "@/services/bos/shared";
import { scopeOwnerFilter } from "@/services/bos/leads";
import { PageHeader, Money } from "@/components/bos/ui";
import { KanbanBoard } from "@/components/bos/KanbanBoard";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDate, todayIn, startOfMonth } from "@/lib/bos/format";
import { formatMoney, percentOf, toDecimalString, addMoney } from "@/lib/bos/money";
import { pipelineMetrics } from "@/services/bos/metrics";
import { changeDealStageAction } from "../deals/actions";
import { changeLeadStageAction } from "../leads/actions";
import type { Scope } from "@/lib/bos/permissions";

export default async function PipelinePage({ searchParams }: { searchParams: SearchParams }) {
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const entity = sp.entity === "lead" ? "lead" : bos.permissions.has("deals.read") ? "deal" : "lead";
  const scope = bos.permissions.get(entity === "deal" ? "deals.read" : "leads.read") as Scope | undefined;
  if (!scope) redirect("/admin/forbidden");

  const [{ stages }, names, staff] = await Promise.all([getPipeline(entity), userNameMap(), listActiveStaff()]);
  const activeStages = stages.filter((s) => s.is_active);

  let cards: { id: string; column: string; content: React.ReactNode }[] = [];
  let columnMeta: Record<string, React.ReactNode> = {};

  if (entity === "deal") {
    const users = await scopeUserIds(bos, scope);
    let query = db()
      .from("deals")
      .select("id, name, deal_number, value, currency, probability, expected_close_date, assigned_to, stage_id, won_at, lost_at, clients(name, company_name)")
      .is("archived_at", null)
      .order("expected_close_date", { ascending: true, nullsFirst: false })
      .limit(500);
    if (users) query = query.or(`assigned_to.in.(${users.join(",")}),created_by.in.(${users.join(",")})`);
    if (sp.q) query = query.ilike("name", `%${sp.q.replace(/[%_]/g, " ")}%`);
    if (sp.assigned) query = query.eq("assigned_to", sp.assigned === "me" ? bos.userId : sp.assigned);
    // Closed columns show only the last 90 days to keep the board focused.
    const since = nowMs() - 90 * 86400000;
    const { data } = await query;
    const deals = (data ?? []).filter((d) => {
      const closedAt = d.won_at ?? d.lost_at;
      return !closedAt || new Date(closedAt).getTime() >= since;
    });
    cards = deals.map((d) => {
      const client = d.clients as unknown as { name: string; company_name: string | null } | null;
      return {
        id: d.id,
        column: d.stage_id,
        content: (
          <Link href={`/admin/sales/deals/${d.id}`}>
            <span className="title">{d.name}</span>
            <span className="bos-faint" style={{ display: "block", fontSize: 11.5 }}>{client?.company_name ?? client?.name}</span>
            <span className="bos-row" style={{ justifyContent: "space-between", marginTop: 4 }}>
              <Money value={d.value} currency={d.currency} />
              <span className="bos-faint">{d.probability}% · {formatDate(d.expected_close_date)}</span>
            </span>
            <span className="bos-faint" style={{ fontSize: 11 }}><Tx>{d.assigned_to ? names.get(d.assigned_to) : "غير معيّن"}</Tx></span>
          </Link>
        ),
      };
    });
    const byStage = new Map<string, typeof deals>();
    for (const d of deals) byStage.set(d.stage_id, [...(byStage.get(d.stage_id) ?? []), d]);
    columnMeta = Object.fromEntries(
      activeStages.map((s) => {
        const list = byStage.get(s.id) ?? [];
        const currencies = [...new Set(list.map((d) => d.currency))];
        if (currencies.length === 1) {
          const total = addMoney(...list.map((d) => d.value));
          const weighted = list.reduce((acc, d) => acc + percentOf(d.value, d.probability, d.currency), BigInt(0));
          return [s.id, `${formatMoney(toDecimalString(total, 2), currencies[0])} · موزون ${formatMoney(toDecimalString(weighted, 2), currencies[0])}`];
        }
        return [s.id, list.length ? `${currencies.length} عملات` : "—"];
      }),
    );
  } else {
    const owner = await scopeOwnerFilter(bos, scope);
    let query = db()
      .from("leads")
      .select("id, name, company_name, total_score, next_activity_at, assigned_to, stage_id, estimated_budget, budget_currency")
      .is("archived_at", null)
      .order("total_score", { ascending: false })
      .limit(500);
    if (owner) query = query.or(owner);
    if (sp.q) query = query.or(`name.ilike.%${sp.q.replace(/[%_,()]/g, " ")}%,company_name.ilike.%${sp.q.replace(/[%_,()]/g, " ")}%`);
    if (sp.assigned) query = query.eq("assigned_to", sp.assigned === "me" ? bos.userId : sp.assigned);
    const { data } = await query;
    cards = (data ?? []).map((l) => ({
      id: l.id,
      column: l.stage_id,
      content: (
        <Link href={`/admin/sales/leads/${l.id}`}>
          <span className="title">{l.name}</span>
          <span className="bos-row" style={{ justifyContent: "space-between" }}>
            <span className="bos-faint"><Tx>{l.assigned_to ? names.get(l.assigned_to) : "غير معيّن"}</Tx></span>
            <span className="bos-num"><Tx>{l.total_score}</Tx></span>
          </span>
          {l.estimated_budget ? <Money value={l.estimated_budget} currency={l.budget_currency} /> : null}
        </Link>
      ),
    }));
  }

  const today = todayIn(bos.employee.timezone);
  const metrics = entity === "deal" ? await pipelineMetrics({ userIds: await scopeUserIds(bos, scope), from: startOfMonth(today), to: today }) : null;
  const lostStage = activeStages.find((s) => s.category === "lost");
  const wonStage = activeStages.find((s) => s.category === "won");

  return (
    <>
      <PageHeader
        title={entity === "deal" ? "مسار الصفقات" : "مسار العملاء المحتملين"}
        breadcrumbs={[{ label: "المبيعات" }, { label: "المسار" }]}
        subtitle={
          metrics
            ? `المسار ${formatMoney(metrics.pipelineValue, metrics.baseCurrency)} · الموزون ${formatMoney(metrics.weightedPipeline, metrics.baseCurrency)} · المكسوب هذا الشهر ${formatMoney(metrics.wonRevenue, metrics.baseCurrency)} · التحويل ${metrics.conversionRate}%`
            : "اسحب البطاقات بين المراحل — كل انتقال يُسجل في السجل الزمني"
        }
        actions={
          <>
            {bos.permissions.has("deals.read") ? (
              <Link href="/admin/sales/pipeline" className={`admin-btn small ${entity === "deal" ? "" : "secondary"}`}>
                <Tx>الصفقات</Tx>
              </Link>
            ) : null}
            {bos.permissions.has("leads.read") ? (
              <Link href="/admin/sales/pipeline?entity=lead" className={`admin-btn small ${entity === "lead" ? "" : "secondary"}`}>
                <Tx>العملاء المحتملون</Tx>
              </Link>
            ) : null}
            <Link href={entity === "deal" ? "/admin/sales/deals" : "/admin/sales/leads"} className="admin-btn small ghost">
              <Tx>عرض الجدول</Tx>
            </Link>
          </>
        }
      />
      <FilterBar
        searchPlaceholder="بحث..."
        filters={scope === "all" || scope === "team" ? [{ key: "assigned", label: "المسؤول", type: "select", options: [{ value: "me", label: "أنا" }, ...staff.map((s) => ({ value: s.userId, label: s.name }))] }] : []}
      />
      <KanbanBoard
        columns={activeStages.map((s) => ({ key: s.id, title: s.name, meta: columnMeta[s.id] }))}
        cards={cards}
        onMove={entity === "deal" ? changeDealStageAction : changeLeadStageAction}
        interceptMove={
          entity === "deal"
            ? Object.fromEntries([wonStage, lostStage].filter(Boolean).map((s) => [s!.id, "/admin/sales/deals/{id}"]))
            : Object.fromEntries([lostStage].filter(Boolean).map((s) => [s!.id, "/admin/sales/leads/{id}"]))
        }
      />
    </>
  );
}
