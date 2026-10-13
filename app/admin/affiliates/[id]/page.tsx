import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, StatusBadge, EmptyState, KpiCard } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { getAffiliate } from "@/services/yolias/affiliates";
import { AdjustForm, AffiliateStatusForm, CommissionForm, NoteForm } from "../AffiliateForms";
import { affiliateStatusLabel, affiliateStatusTone, cents, commissionKindLabel, commissionStatusLabel, commissionStatusTone, eventLabel, payoutStatusLabel, payoutStatusTone, riskFlagLabel, skipReasonLabel } from "../labels";

export default async function AffiliatePage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("affiliates.read");
  if (!connected()) return (<><PageHeader title="مسوّق" /><NotConnected /></>);
  const { id } = await params;
  const sensitive = can(bos, "affiliates.view_sensitive");
  const found = await getAffiliate(id, { sensitive });
  if (!found) notFound();
  const { affiliate: a, balances: b, stats, referrals, commissions, payouts, events, notes } = found;
  const canDecide = can(bos, "affiliates.approve", "all");
  const canCommissions = can(bos, "affiliates.update", "all");
  const answers = Object.entries((a.answers ?? {}) as Record<string, string>);
  const bal = (k: keyof NonNullable<typeof b>) => Number(b?.[k] ?? 0);
  return (
    <>
      <PageHeader
        title={<span dir="ltr">{a.email}</span>}
        subtitle={<StatusBadge tone={affiliateStatusTone[a.status]} label={affiliateStatusLabel[a.status]} />}
        actions={<Link className="admin-btn secondary small" href="/admin/affiliates/list"><Tx>كل المسوّقين</Tx></Link>}
      />
      <div className="bos-kpis">
        <KpiCard label="زيارات" value={num(stats.visits)} />
        <KpiCard label="تسجيلات" value={num(stats.signups)} />
        <KpiCard label="عملاء دفعوا" value={num(stats.paying)} />
        <KpiCard label="متاح للسحب" value={cents(bal("available_cents"))} sub={<Tx vars={{ v: cents(bal("pending_cents") + bal("approved_cents")) }}>{"معلّق: {v}"}</Tx>} />
        <KpiCard label="مدفوع" value={cents(bal("paid_cents"))} sub={<Tx vars={{ v: cents(bal("processing_cents")) }}>{"داخل طلب سحب: {v}"}</Tx>} />
      </div>
      <Card title="الملف">
        <KeyValues items={[
          { label: "كود الإحالة", value: <span dir="ltr">{a.code}</span> },
          { label: "إصدار الشروط الموافق عليها", value: <span dir="ltr">{a.terms_version} · {formatDateTime(a.terms_accepted_at)}</span> },
          { label: "تاريخ الطلب", value: formatDateTime(a.created_at) },
          { label: "آخر قرار", value: a.decided_at ? `${formatDateTime(a.decided_at)} · ${a.decided_by ?? ""}` : "—" },
          { label: "سبب القرار", value: a.decision_reason ?? "—", hidden: !a.decision_reason },
          { label: "طريقة السحب", value: a.payout_method ?? "—" },
          { label: "بيانات السحب", value: <span dir="auto" style={{ whiteSpace: "pre-wrap" }}>{a.payout_details ?? "—"}</span> },
          ...answers.map(([k, v]) => ({ label: k, value: <span dir="auto" style={{ whiteSpace: "pre-wrap" }}>{v}</span> })),
        ]} />
        {!sensitive ? <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>بيانات السحب وبريد العملاء المُحالين مخفية (تحتاج صلاحية «affiliates.view_sensitive»).</Tx></p> : null}
      </Card>
      {canDecide ? (
        <Card title="القرار والحالة">
          <AffiliateStatusForm id={a.id} status={a.status} />
        </Card>
      ) : null}
      <Card title="الإحالات">
        {referrals.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>الحساب</Tx></th><th><Tx>التسجيل</Tx></th><th><Tx>زيارة الرابط</Tx></th><th><Tx>الحملة</Tx></th><th><Tx>تنبيهات</Tx></th></tr></thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td dir="ltr">{r.email ?? `#${r.id.slice(0, 6).toUpperCase()}`}{r.workspace_id ? <span className="cell-sub"><Link className="bos-link" href={`/admin/platform/workspaces/${r.workspace_id}`}><Tx>مساحة العمل</Tx></Link></span> : null}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.visit_at ? formatDateTime(r.visit_at) : "—"}</td>
                    <td dir="ltr">{r.campaign ?? "—"}</td>
                    <td>{r.risk_flags.length ? r.risk_flags.map((f) => <span key={f} className="cell-sub"><Tx>{riskFlagLabel[f] ?? f}</Tx></span>) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد إحالات" />}
      </Card>
      <Card title="العمولات">
        {commissions.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>النوع</Tx></th><th><Tx>الدفعة</Tx></th><th><Tx>العمولة</Tx></th><th><Tx>الحالة</Tx></th>{canCommissions ? <th /> : null}</tr></thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.created_at)}</td>
                    <td><Tx>{commissionKindLabel[c.kind]}</Tx>{c.payment_seq ? <span className="cell-sub"><Tx vars={{ n: c.payment_seq }}>{"الدفعة رقم {n}"}</Tx></span> : null}</td>
                    <td dir="ltr">{c.base_cents ? cents(c.base_cents) : "—"}{c.payment_id ? <span className="cell-sub">{c.payment_id.slice(0, 8)}</span> : null}</td>
                    <td dir="ltr">{cents(c.amount_cents)}</td>
                    <td>
                      <StatusBadge tone={commissionStatusTone[c.status]} label={commissionStatusLabel[c.status]} />
                      {c.on_hold ? <span className="cell-sub"><Tx>قيد المراجعة</Tx>: {c.hold_reasons.map((h) => riskFlagLabel[h] ?? h).join("، ")}</span> : null}
                      {c.reason ? <span className="cell-sub">{c.reason}</span> : null}
                    </td>
                    {canCommissions ? <td><CommissionForm id={c.id} status={c.status} onHold={c.on_hold} /></td> : null}
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد عمولات" />}
      </Card>
      {canCommissions ? <Card title="تسوية يدوية"><AdjustForm id={a.id} /></Card> : null}
      <Card title="طلبات السحب">
        {payouts.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>المبلغ</Tx></th><th><Tx>الطريقة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المرجع</Tx></th></tr></thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id}>
                    <td style={{ whiteSpace: "nowrap" }}><Link className="bos-link" href={`/admin/affiliates/payouts/${p.id}`}>{formatDateTime(p.requested_at)}</Link></td>
                    <td dir="ltr">{cents(p.amount_cents)}</td>
                    <td>{p.method}</td>
                    <td><StatusBadge tone={payoutStatusTone[p.status]} label={payoutStatusLabel[p.status]} /></td>
                    <td dir="ltr">{p.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد طلبات سحب" />}
      </Card>
      <Card title="ملاحظات داخلية">
        {notes.map((n) => (
          <div key={n.id} className="aff-note"><span className="cell-sub">{formatDateTime(n.created_at)} · {n.author}</span><p>{n.body}</p></div>
        ))}
        {canDecide ? <NoteForm id={a.id} /> : notes.length ? null : <EmptyState title="لا توجد ملاحظات" />}
      </Card>
      <Card title="سجل الإجراءات">
        {events.length ? (
          <ul className="aff-events">
            {events.map((e) => {
              const why = (e.after as { why?: string } | null)?.why;
              return (
                <li key={e.id}>
                  <span className="cell-sub" style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.created_at)}</span>
                  <span><Tx>{eventLabel[e.action] ?? e.action}</Tx>{why ? <> · <Tx>{skipReasonLabel[why] ?? why}</Tx></> : null}</span>
                  <span className="cell-sub" dir="ltr">{e.actor}</span>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="لا توجد إجراءات" />}
      </Card>
    </>
  );
}
