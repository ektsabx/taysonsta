import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { dealRadar } from "@/services/bos/deal-radar";
import { listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, KpiCard, EmptyState, StatusBadge, Money } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { RadarActions, ResolveRisk } from "./RadarControls";

const bandLabel = { low: "منخفض", medium: "متوسط", high: "مرتفع" } as const;
const bandTone = { low: "danger", medium: "warning", high: "success" } as const;
const riskLabel: Record<string, string> = { risk: "خطر", blocker: "عائق", delay_reason: "سبب تأخير" };

// Deal Radar (docs/bos/30 §17): near-closing and at-risk deals with the
// signals behind each estimate, actual vs weighted value per currency, and
// follow-up actions on the existing CRM.
export default async function DealRadarPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("deals.read");
  const sp = await readParams(searchParams);
  const [r, staff, names, { data: stages }, { count: ai }] = await Promise.all([
    dealRadar(bos, { owner: sp.owner || null, stage: sp.stage || null, currency: sp.currency || null, flag: sp.flag || null }),
    listActiveStaff(), userNameMap(),
    db().from("pipeline_stages").select("id, name").eq("category", "open").eq("is_active", true).order("sort_order"),
    db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active"),
  ]);
  const staffOpts = staff.map((s) => ({ value: s.userId, label: s.name }));
  return (
    <>
      <PageHeader title="رادار الصفقات" subtitle="الصفقات القريبة من الإغلاق أو المعرّضة للخطر — مع أسباب كل تقدير" />
      <FilterBar filters={[
        { key: "flag", label: "العرض", type: "select", options: [{ value: "nearClosing", label: "قريبة من الإغلاق" }, { value: "overdue", label: "متأخرة" }, { value: "stale", label: "بلا نشاط حديث" }, { value: "intervention", label: "تحتاج تدخل المدير" }, { value: "followUp", label: "فرص متابعة" }, { value: "risky", label: "مخاطر وعوائق" }] },
        { key: "owner", label: "المسؤول", type: "select", options: staffOpts },
        { key: "stage", label: "المرحلة", type: "select", options: (stages ?? []).map((s) => ({ value: s.id, label: s.name })) },
        { key: "currency", label: "العملة", type: "select", options: [...new Set(r.rows.map((x) => x.currency))].map((c) => ({ value: c, label: c })) },
      ]} />
      <div className="bos-kpis">
        {r.summary.nearClosing.length ? r.summary.nearClosing.map((x) => <KpiCard key={x.currency} label={`قريبة من الإغلاق (${x.currency})`} value={<Money value={x.value} currency={x.currency} />} sub={<Tx vars={{ n: String(x.count), w: x.weighted.toLocaleString("en-US") }}>{"{n} صفقة · مرجّح {w}"}</Tx>} />) : <KpiCard label="قريبة من الإغلاق" value={0} />}
        <KpiCard label="متأخرة عن تاريخ الإغلاق" value={r.summary.overdue} href="/admin/sales/radar?flag=overdue" />
        <KpiCard label="بلا نشاط حديث" value={r.summary.stale} href="/admin/sales/radar?flag=stale" />
        <KpiCard label="تحتاج تدخل المدير" value={r.summary.intervention} href="/admin/sales/radar?flag=intervention" />
        <KpiCard label="فرص متابعة" value={r.summary.followUp} href="/admin/sales/radar?flag=followUp" />
      </div>
      <Card>
        <p className="bos-hint" style={{ margin: 0 }}>
          <Tx>التقدير قائم على قواعد: يبدأ من احتمال المرحلة ثم يتعدّل بإشارات مسجلة (عرض، عقد، ردود العميل، النشاط، المواعيد، العوائق). يُقرّب لأقرب 5% ويُعرض كنطاق — ليس احتمالاً دقيقاً.</Tx>{" "}
          {r.meta.historyUsed ? <Tx vars={{ n: String(r.meta.historyClosed) }}>{"تُستخدم نسب الفوز التاريخية لكل مرحلة (من {n} صفقة مغلقة)."}</Tx> : <Tx vars={{ n: String(r.meta.historyClosed), m: String(r.meta.minHistory) }}>{"البيانات التاريخية غير كافية ({n} من {m} صفقة مغلقة على الأقل) — يُستخدم احتمال المرحلة كأساس."}</Tx>}{" "}
          <Tx>القيمة الفعلية والمرجّحة منفصلتان ولكل عملة على حدة.</Tx>
        </p>
      </Card>
      {r.rows.length ? r.rows.map((d) => (
        <Card key={d.id} title={<span className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}><Link href={`/admin/sales/deals/${d.id}`}>{d.number} · {d.name}</Link><span className="bos-faint" style={{ fontSize: 12 }}>{d.client}</span>
          {d.flags.intervention ? <StatusBadge tone="danger" label="تدخل المدير" /> : null}{d.flags.overdue ? <StatusBadge tone="danger" label="متأخرة" /> : null}{d.flags.stale ? <StatusBadge tone="warning" label="بلا نشاط حديث" /> : null}{d.flags.followUp ? <StatusBadge tone="info" label="تحتاج متابعة" /> : null}</span>}
          actions={<span className="bos-row" style={{ gap: 8, alignItems: "baseline" }}><Money value={d.value} currency={d.currency} /><span className="bos-faint" style={{ fontSize: 12 }}><Tx>مرجّح</Tx> <Money value={d.weighted} currency={d.currency} /></span></span>}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div style={{ fontSize: 12.5 }}>
              <div><Tx>المرحلة</Tx>: <b>{d.stage.name}</b> <span className="bos-faint">(<Tx vars={{ n: String(d.stageDays) }}>{"منذ {n} يوم"}</Tx>)</span></div>
              <div><Tx>الإغلاق المتوقع</Tx>: {d.expectedClose ? formatDate(d.expectedClose) : "—"}{d.flags.closeIn != null ? <span className={d.flags.closeIn < 0 ? "bos-danger" : "bos-faint"}> ({d.flags.closeIn < 0 ? <Tx vars={{ n: String(-d.flags.closeIn) }}>{"متأخرة {n} يوم"}</Tx> : <Tx vars={{ n: String(d.flags.closeIn) }}>{"بعد {n} يوم"}</Tx>})</span> : null}</div>
              <div><Tx>المسؤول</Tx>: {d.owner ? names.get(d.owner) ?? "—" : <span className="bos-danger"><Tx>بلا مسؤول</Tx></span>}</div>
              <div><Tx>آخر تواصل</Tx>: {d.lastActivity ? formatDateTime(d.lastActivity) : <span className="bos-danger"><Tx>لا يوجد</Tx></span>}</div>
              <div><Tx>الخطوة التالية</Tx>: {d.next ? `${d.next.title} · ${formatDateTime(d.next.due_at)}` : <span className="bos-danger"><Tx>غير محددة</Tx></span>}</div>
              {d.proposal ? <div><Tx>العرض</Tx>: {d.proposal}</div> : null}
              {d.contract ? <div><Tx>العقد</Tx>: {d.contract}</div> : null}
            </div>
            <div style={{ fontSize: 12.5 }}>
              <div className="bos-row" style={{ gap: 6, alignItems: "center" }}><Tx>التقدير</Tx>: <StatusBadge tone={bandTone[d.score.band as keyof typeof bandTone]} label={bandLabel[d.score.band as keyof typeof bandLabel]} /> <b>~{d.score.estimate}%</b> <span className="bos-faint">(<Tx>ثقة</Tx> <Tx>{d.score.confidence === "medium" ? "متوسطة" : "منخفضة"}</Tx>)</span></div>
              <div className="bos-faint"><Tx>الأساس</Tx>: {d.score.base}% (<Tx>{d.score.baseSource === "history" ? "نسبة فوز تاريخية للمرحلة" : "احتمال المرحلة"}</Tx>)</div>
              <details><summary><Tx>لماذا على الرادار؟</Tx></summary>
                <ul style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{d.score.contributions.map((c) => <li key={c.key}><Tx>{c.label}</Tx> <b className={c.effect < 0 ? "bos-danger" : ""}>{c.effect > 0 ? "+" : ""}{c.effect}</b></li>)}{!d.score.contributions.length ? <li><Tx>لا توجد إشارات إضافية — التقدير = الأساس.</Tx></li> : null}</ul>
              </details>
              {d.risks.length ? <div style={{ marginTop: 6 }}>{d.risks.map((x) => <div key={x.id} className="bos-row" style={{ gap: 4, alignItems: "center" }}><span className="bos-tag"><Tx>{riskLabel[x.kind]}</Tx></span> {x.text} {can(bos, "deals.update") ? <ResolveRisk id={x.id} /> : null}</div>)}</div> : null}
            </div>
            <div style={{ fontSize: 12 }}>
              <div className="bos-faint"><Tx>آخر الأنشطة</Tx></div>
              {d.recent.length ? d.recent.map((a) => <div key={a.id}>{a.direction === "inbound" ? "⬅" : "➡"} {a.title} <span className="bos-faint">· {a.status} · {formatDate(a.at)}</span></div>) : <span className="bos-faint">—</span>}
            </div>
          </div>
          <div style={{ marginTop: 10 }}><RadarActions dealId={d.id} nextId={d.next?.id ?? null} staff={staffOpts} canAssign={can(bos, "deals.assign")} canUpdate={can(bos, "deals.update")} aiReady={!!ai} /></div>
        </Card>
      )) : <Card><EmptyState title="لا توجد صفقات على الرادار" description="الصفقات المفتوحة ذات الاحتمال العالي أو القريبة من تاريخ الإغلاق أو المعرّضة للخطر تظهر هنا." /></Card>}
      {r.summary.byOwner.length ? (
        <Card title="حسب المسؤول والمرحلة" flush>
          <div style={{ display: "grid", gap: 0, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            <BosTable className="bos-table"><thead><tr><th><Tx>المسؤول</Tx></th><th><Tx>الصفقات والقيمة</Tx></th></tr></thead><tbody>{r.summary.byOwner.map((o) => <tr key={o.key}><td>{o.key === "none" ? <Tx>بلا مسؤول</Tx> : names.get(o.key) ?? "—"}</td><td>{o.byCurrency.map((x) => <div key={x.currency}>{x.count} · <Money value={x.value} currency={x.currency} /></div>)}</td></tr>)}</tbody></BosTable>
            <BosTable className="bos-table"><thead><tr><th><Tx>المرحلة</Tx></th><th><Tx>الصفقات والقيمة</Tx></th></tr></thead><tbody>{r.summary.byStage.map((o) => <tr key={o.key}><td>{o.key}</td><td>{o.byCurrency.map((x) => <div key={x.currency}>{x.count} · <Money value={x.value} currency={x.currency} /></div>)}</td></tr>)}</tbody></BosTable>
          </div>
        </Card>
      ) : null}
    </>
  );
}
