import { BosTable } from "@/components/bos/BosTable";
import { RecordDocuments } from "@/components/bos/RecordDocuments";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { ActionButton } from "@/components/bos/Dialog";
import { discussAction } from "@/app/admin/communication/chat/actions";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getDeal } from "@/services/bos/deals";
import { listEntityActivities } from "@/services/bos/activities";
import { getPipeline, listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, Tabs, EmptyState, UserChip } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { ActivityList } from "@/components/bos/ActivityList";
import { ActivityComposer } from "@/components/bos/ActivityComposer";
import { MeetingScheduler } from "@/components/bos/MeetingScheduler";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { percentOf, toDecimalString } from "@/lib/bos/money";
import { DealStageControl, MarkWonButton, ArchiveDealButton } from "./DealControls";

const tabs = [
  { key: "overview", label: "نظرة عامة" },
  { key: "proposals", label: "المقترحات" },
  { key: "contract", label: "العقد" },
  { key: "payments", label: "الدفعات والفواتير" },
  { key: "commission", label: "العمولة" },
  { key: "activities", label: "الأنشطة" },
  { key: "communications", label: "التواصل" },
  { key: "files", label: "الملفات" },
  { key: "notes", label: "الملاحظات" },
  { key: "timeline", label: "السجل الزمني" },
  { key: "history", label: "سجل التدقيق" },
];

const triggerLabels: Record<string, string> = { on_signing: "عند التوقيع", on_date: "بتاريخ", };

export default async function DealDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("deals.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab : "overview";
  if (!(await canAccessEntity(bos, "deal", id))) notFound();

  let deal;
  try {
    deal = await getDeal(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const client = deal.clients as unknown as { id: string; name: string; company_name: string | null; email: string; country: string | null } | null;
  const contact = deal.contacts as unknown as { id: string; full_name: string; email: string | null; phone: string | null } | null;
  const stage = deal.pipeline_stages as unknown as { id: string; name: string; key: string; category: string };
  const lead = deal.leads as unknown as { id: string; name: string; lead_number: string } | null;

  const [{ stages }, staff, names] = await Promise.all([getPipeline("deal"), listActiveStaff(), userNameMap()]);
  const canUpdate = can(bos, "deals.update") && (await canAccessEntity(bos, "deal", id, "update"));
  const staffOptions = staff.map((s) => ({ value: s.userId, label: s.name }));
  const terms = (deal.payment_terms as unknown as { label: string; percent: number | string; trigger?: string; due_offset_days?: number }[]) ?? [];
  const canSeeCommission = can(bos, "commissions.read");

  const [proposals, contracts, schedules, invoices, payments, commissions, activities] = await Promise.all([
    tab === "proposals" || tab === "overview" ? db().from("proposals").select("id, title, status, total_amount, currency, sent_at, view_count, valid_until").eq("deal_id", id).order("created_at", { ascending: false }).then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "contract" || tab === "overview" ? db().from("contracts").select("id, contract_number, title, status, value, currency, signed_at, start_date, end_date").eq("deal_id", id).order("created_at", { ascending: false }).then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "payments" ? db().from("payment_schedules").select("*").eq("deal_id", id).order("sort_order").then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "payments" ? db().from("bos_invoices").select("id, invoice_number, total, balance, currency, status, due_date").eq("deal_id", id).order("issue_date").then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "payments" ? db().from("bos_payments").select("id, payment_number, amount, currency, status, payment_date, method").eq("deal_id", id).order("payment_date").then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "commission" && canSeeCommission ? db().from("commissions").select("*, commission_rules(name, trigger, basis, rate)").eq("deal_id", id).then((r) => r.data ?? []) : Promise.resolve([]),
    tab === "activities" || tab === "communications" ? listEntityActivities({ deal_id: id }, tab === "communications") : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={deal.name}
        subtitle={
          <span className="bos-row" style={{ gap: 8 }}>
            <span>{deal.deal_number}</span>
            <StatusBadge label={stage.name} tone={stage.category === "won" ? "success" : stage.category === "lost" ? "danger" : "info"} />
            <StatusBadge map="deal_payment_status" value={deal.payment_status} />
            {deal.is_upsell ? <StatusBadge tone="accent" label="بيع إضافي" /> : null}
          </span>
        }
       
        actions={
          <>
            {can(bos, "chat.create") ? <ActionButton label="مناقشة داخلية" className="admin-btn small secondary" action={discussAction.bind(null, "deal", id)} /> : null}
            {canUpdate ? (
              <Link href={`/admin/sales/deals/${id}/edit`} className="admin-btn small secondary">
                <Tx>تعديل</Tx>
              </Link>
            ) : null}
            {can(bos, "activities.create") ? <ActivityComposer related={{ deal_id: id, client_id: deal.client_id, contact_id: deal.contact_id }} staff={staffOptions} /> : null}
            {can(bos, "meetings.create") ? <MeetingScheduler related={{ deal_id: id, client_id: deal.client_id, contact_id: deal.contact_id }} staff={staffOptions} defaultTitle={`${deal.name} — meeting`} /> : null}
            {can(bos, "proposals.create") && stage.category === "open" ? (
              <Link href={`/admin/sales/proposals/new?dealId=${id}`} className="admin-btn small secondary">
                <Tx>+ مقترح</Tx>
              </Link>
            ) : null}
            {can(bos, "contracts.create") && stage.category !== "lost" ? (
              <Link href={`/admin/sales/contracts/new?dealId=${id}`} className="admin-btn small secondary">
                <Tx>+ عقد</Tx>
              </Link>
            ) : null}
            {canUpdate && stage.category === "open" ? <MarkWonButton dealId={id} /> : null}
            {can(bos, "deals.delete") && !deal.won_at ? <ArchiveDealButton dealId={id} /> : null}
          </>
        }
      />

      <Summary
        items={[
          { label: "المرحلة", value: canUpdate ? <DealStageControl dealId={id} currentStageId={stage.id} stages={stages.filter((s) => s.is_active || s.id === stage.id)} canReopen={can(bos, "deals.approve") || can(bos, "deals.manage")} /> : stage.name },
          { label: "القيمة", value: <Money value={deal.value} currency={deal.currency} /> },
          { label: "الاحتمالية", value: `${deal.probability}%` },
          { label: "القيمة الموزونة", value: stage.category === "open" ? <Money value={toDecimalString(percentOf(deal.value, deal.probability, deal.currency), 2)} currency={deal.currency} /> : "—" },
          { label: "الإغلاق المتوقع", value: formatDate(deal.expected_close_date) },
          { label: "المسؤول", value: <UserChip name={deal.assigned_to ? names.get(deal.assigned_to) : null} /> },
          { label: "الحساب", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "جهة الاتصال", value: contact ? <Link href={`/admin/contacts/${contact.id}`}>{contact.full_name}</Link> : "—" },
        ]}
      />

      <Tabs tabs={tabs.map((t) => (t.key === "commission" ? { ...t, hidden: !canSeeCommission } : t.key === "history" ? { ...t, hidden: !can(bos, "audit.read") } : t))} active={tab} baseHref={`/admin/sales/deals/${id}`} />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="النطاق المعتمد">{deal.scope ? <div className="bos-prose"><Tx>{deal.scope}</Tx></div> : <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لم يُحدد النطاق بعد.</Tx></div>}</Card>
            <Card title="شروط الدفع">
              {terms.length ? (
                <BosTable className="bos-table responsive">
                  <thead>
                    <tr>
                      <th><Tx>الدفعة</Tx></th>
                      <th><Tx>النسبة</Tx></th>
                      <th><Tx>المبلغ</Tx></th>
                      <th><Tx>الاستحقاق</Tx></th>
                    </tr>
                  </thead>
                  <tbody>
                    {terms.map((t, i) => (
                      <tr key={i}>
                        <td className="cell-primary cell-primary-mobile" data-label="الدفعة"><Tx>{t.label}</Tx></td>
                        <td data-label="النسبة">{t.percent}%</td>
                        <td data-label="المبلغ"><Money value={toDecimalString(percentOf(deal.value, t.percent, deal.currency), 2)} currency={deal.currency} /></td>
                        <td data-label="الاستحقاق">{triggerLabels[t.trigger ?? "on_date"]}{t.due_offset_days ? <> (+<Tx vars={{ v: t.due_offset_days }}>{"{v} يوم"}</Tx>)</> : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : (
                <div className="bos-form-error" style={{ fontSize: 12.5 }}><Tx>لم تُحدد شروط الدفع — مطلوبة قبل كسب الصفقة.</Tx></div>
              )}
            </Card>
            {deal.notes ? <Card title="ملاحظات"><div className="bos-prose">{deal.notes}</div></Card> : null}
          </div>
          <div>
            <Card title="الارتباطات">
              <KeyValues
                items={[
                  { label: "العميل المحتمل", value: lead ? <Link className="bos-link" href={`/admin/sales/leads/${lead.id}`}><Tx>{lead.lead_number}</Tx></Link> : null },
                  { label: "المصدر", value: (deal.lead_sources as unknown as { name: string } | null)?.name },
                  { label: "آخر مقترح", value: proposals[0] ? <Link className="bos-link" href={`/admin/sales/proposals/${proposals[0].id}`}><Tx>{proposals[0].title}</Tx></Link> : null },
                  { label: "العقد", value: contracts[0] ? <Link className="bos-link" href={`/admin/sales/contracts/${contracts[0].id}`}>{contracts[0].contract_number} · <StatusBadge map="contract_status" value={contracts[0].status} /></Link> : null },
                  { label: "تاريخ الكسب", value: deal.won_at ? formatDateTime(deal.won_at) : null, hidden: !deal.won_at },
                  { label: "سبب الخسارة", value: deal.lost_reason, hidden: !deal.lost_reason },
                ]}
              />
            </Card>
            <Card title="آخر الأحداث">
              <ActivityTimeline entityType="deal" entityId={id} limit={8} moreHref={`/admin/sales/deals/${id}?tab=timeline`} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "proposals" ? (
        <Card title="المقترحات" actions={can(bos, "proposals.create") ? <Link href={`/admin/sales/proposals/new?dealId=${id}`} className="admin-btn small"><Tx>+ مقترح</Tx></Link> : null}>
          {proposals.length ? (
            <BosTable className="bos-table responsive">
              <thead>
                <tr>
                  <th><Tx>المقترح</Tx></th>
                  <th><Tx>الحالة</Tx></th>
                  <th><Tx>الإجمالي</Tx></th>
                  <th><Tx>أُرسل</Tx></th>
                  <th><Tx>المشاهدات</Tx></th>
                  <th><Tx>صالح حتى</Tx></th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <tr key={p.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="المقترح"><Link href={`/admin/sales/proposals/${p.id}`}><Tx>{p.title}</Tx></Link></td>
                    <td data-label="الحالة"><StatusBadge map="proposal_status" value={p.status} /></td>
                    <td data-label="الإجمالي">{p.total_amount ? <Money value={p.total_amount} currency={p.currency} /> : "—"}</td>
                    <td data-label="أُرسل">{formatDate(p.sent_at)}</td>
                    <td data-label="المشاهدات"><Tx>{p.view_count}</Tx></td>
                    <td data-label="صالح حتى">{formatDate(p.valid_until)}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد مقترحات" description="أنشئ مقترحاً من الصفقة ليُملأ العميل والأسعار وشروط الدفع تلقائياً." />
          )}
        </Card>
      ) : null}

      {tab === "contract" ? (
        <Card title="العقود" actions={can(bos, "contracts.create") ? <Link href={`/admin/sales/contracts/new?dealId=${id}`} className="admin-btn small"><Tx>+ عقد</Tx></Link> : null}>
          {contracts.length ? (
            <BosTable className="bos-table responsive">
              <thead>
                <tr>
                  <th><Tx>العقد</Tx></th>
                  <th><Tx>الحالة</Tx></th>
                  <th><Tx>القيمة</Tx></th>
                  <th><Tx>البداية</Tx></th>
                  <th><Tx>النهاية</Tx></th>
                  <th><Tx>التوقيع</Tx></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr key={c.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="العقد"><Link href={`/admin/sales/contracts/${c.id}`}>{c.contract_number} — {c.title}</Link></td>
                    <td data-label="الحالة"><StatusBadge map="contract_status" value={c.status} /></td>
                    <td data-label="القيمة"><Money value={c.value} currency={c.currency} /></td>
                    <td data-label="البداية">{formatDate(c.start_date)}</td>
                    <td data-label="النهاية">{formatDate(c.end_date)}</td>
                    <td data-label="التوقيع">{c.signed_at ? formatDateTime(c.signed_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا يوجد عقد" />
          )}
        </Card>
      ) : null}

      {tab === "payments" ? (
        <>
          <Card title="جدول الدفعات">
            {schedules.length ? (
              <BosTable className="bos-table responsive">
                <thead>
                  <tr>
                    <th><Tx>الدفعة</Tx></th>
                    <th><Tx>النسبة</Tx></th>
                    <th><Tx>المبلغ</Tx></th>
                    <th><Tx>الاستحقاق</Tx></th>
                    <th><Tx>الحالة</Tx></th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((s) => (
                    <tr key={s.id}>
                      <td className="cell-primary cell-primary-mobile" data-label="الدفعة"><Tx>{s.label}</Tx></td>
                      <td data-label="النسبة">{s.percent}%</td>
                      <td data-label="المبلغ"><Money value={s.amount} currency={s.currency} /></td>
                      <td data-label="الاستحقاق">{formatDate(s.due_date)} · {triggerLabels[s.trigger]}</td>
                      <td data-label="الحالة"><StatusBadge map="schedule_status" value={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </BosTable>
            ) : (
              <EmptyState title="لم يُنشأ جدول الدفعات بعد" description="يُنشأ تلقائياً من شروط الدفع عند كسب الصفقة." />
            )}
          </Card>
          <div className="bos-grid cols-2">
            <Card title="الفواتير">
              {invoices.length ? (
                <BosTable className="bos-table responsive">
                  <thead>
                    <tr>
                      <th><Tx>الفاتورة</Tx></th>
                      <th><Tx>الإجمالي</Tx></th>
                      <th><Tx>المتبقي</Tx></th>
                      <th><Tx>الحالة</Tx></th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الفاتورة">{can(bos, "invoices.read") ? <Link href={`/admin/finance/invoices/${i.id}`}>{i.invoice_number}</Link> : i.invoice_number}</td>
                        <td data-label="الإجمالي"><Money value={i.total} currency={i.currency} /></td>
                        <td data-label="المتبقي"><Money value={i.balance} currency={i.currency} /></td>
                        <td data-label="الحالة"><StatusBadge map="invoice_status" value={i.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : (
                <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد فواتير.</Tx></div>
              )}
            </Card>
            <Card title="المدفوعات">
              {payments.length ? (
                <BosTable className="bos-table responsive">
                  <thead>
                    <tr>
                      <th><Tx>الدفعة</Tx></th>
                      <th><Tx>المبلغ</Tx></th>
                      <th><Tx>التاريخ</Tx></th>
                      <th><Tx>الحالة</Tx></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الدفعة">{can(bos, "payments.read") ? <Link href={`/admin/finance/payments/${p.id}`}>{p.payment_number}</Link> : p.payment_number}</td>
                        <td data-label="المبلغ"><Money value={p.amount} currency={p.currency} /></td>
                        <td data-label="التاريخ">{formatDate(p.payment_date)}</td>
                        <td data-label="الحالة"><StatusBadge map="payment_status" value={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : (
                <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد مدفوعات.</Tx></div>
              )}
            </Card>
          </div>
        </>
      ) : null}

      {tab === "commission" && canSeeCommission ? (
        <Card title="العمولة">
          {commissions.length ? (
            <BosTable className="bos-table responsive">
              <thead>
                <tr>
                  <th><Tx>الموظف</Tx></th>
                  <th><Tx>القاعدة</Tx></th>
                  <th><Tx>الأساس</Tx></th>
                  <th><Tx>العمولة</Tx></th>
                  <th><Tx>المستحق حالياً</Tx></th>
                  <th><Tx>الحالة</Tx></th>
                </tr>
              </thead>
              <tbody>
                {commissions
                  .filter((c) => c.user_id === bos.userId || can(bos, "commissions.read", "team"))
                  .map((c) => {
                    const rule = c.commission_rules as unknown as { name: string; trigger: string } | null;
                    return (
                      <tr key={c.id}>
                        <td className="cell-primary cell-primary-mobile" data-label="الموظف">{names.get(c.user_id)}</td>
                        <td data-label="القاعدة">{rule?.name ?? "—"}</td>
                        <td data-label="الأساس"><Money value={c.base_amount} currency={deal.currency} /></td>
                        <td data-label="العمولة"><Money value={c.amount} currency={c.currency} /></td>
                        <td data-label="المستحق"><Money value={c.eligible_amount} currency={c.currency} /></td>
                        <td data-label="الحالة"><StatusBadge map="commission_status" value={c.status} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد عمولة محسوبة" description="تُحسب العمولة تلقائياً عند كسب الصفقة حسب قواعد العمولة المعتمدة." />
          )}
        </Card>
      ) : null}

      {tab === "activities" || tab === "communications" ? (
        <Card title={tab === "activities" ? "الأنشطة" : "سجل التواصل"} actions={can(bos, "activities.create") ? <ActivityComposer related={{ deal_id: id, client_id: deal.client_id, contact_id: deal.contact_id }} staff={staffOptions} /> : null}>
          <ActivityList activities={activities} names={names} />
        </Card>
      ) : null}

      {tab === "files" ? (
        <Card title="الملفات">
          <FileManager entityType="deal" entityId={id} canUpload={can(bos, "files.create")} />
        </Card>
      ) : null}

      {tab === "notes" ? (
        <Card title="الملاحظات">
          <Comments entityType="deal" entityId={id} viewerId={bos.userId} />
        </Card>
      ) : null}

      {tab === "timeline" ? (
        <Card title="السجل الزمني">
          <ActivityTimeline entityType="deal" entityId={id} limit={200} />
        </Card>
      ) : null}

      {tab === "history" && can(bos, "audit.read") ? (
        <Card title="سجل التدقيق">
          <AuditLogPanel entityType="deal" entityId={id} />
        </Card>
      ) : null}
      {tab === "overview" ? <RecordDocuments bos={bos} entityType="deal" entityId={id} /> : null}
    </>
  );
}
