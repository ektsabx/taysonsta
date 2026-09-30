import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { ActionButton } from "@/components/bos/Dialog";
import { discussAction } from "@/app/admin/communication/chat/actions";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getLead } from "@/services/bos/leads";
import { listEntityActivities } from "@/services/bos/activities";
import { listEntityMeetings } from "@/services/bos/meetings";
import { getPipeline, listActiveStaff, listCurrencies, listProducts, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, Tabs, EmptyState, UserChip } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { ActivityList } from "@/components/bos/ActivityList";
import { ActivityComposer } from "@/components/bos/ActivityComposer";
import { MeetingScheduler } from "@/components/bos/MeetingScheduler";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { NotFoundError } from "@/lib/bos/errors";
import { LeadStageControl, LeadAssignControl, ConvertLeadButton, ArchiveLeadButton } from "./LeadControls";

const tabs = [
  { key: "overview", label: "نظرة عامة" },
  { key: "activities", label: "الأنشطة" },
  { key: "communications", label: "التواصل" },
  { key: "notes", label: "الملاحظات" },
  { key: "files", label: "الملفات" },
  { key: "deals", label: "الصفقات" },
  { key: "meetings", label: "الاجتماعات" },
  { key: "timeline", label: "السجل الزمني" },
];

export default async function LeadDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("leads.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab : "overview";

  if (!(await canAccessEntity(bos, "lead", id))) notFound();
  let lead;
  try {
    lead = await getLead(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [{ stages }, staff, names, currencies, products] = await Promise.all([getPipeline("lead"), listActiveStaff(), userNameMap(), listCurrencies(), listProducts()]);
  const stage = lead.pipeline_stages as unknown as { id: string; name: string; key: string; category: string };
  const canUpdate = can(bos, "leads.update") && (await canAccessEntity(bos, "lead", id, "update"));
  const staffOptions = staff.map((s) => ({ value: s.userId, label: s.name }));
  const client = lead.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const contact = lead.contacts as unknown as { id: string; full_name: string; email: string | null } | null;

  const [activities, communications, meetings, deals] = await Promise.all([
    tab === "activities" ? listEntityActivities({ lead_id: id }) : Promise.resolve([]),
    tab === "communications" ? listEntityActivities({ lead_id: id }, true) : Promise.resolve([]),
    tab === "meetings" ? listEntityMeetings({ lead_id: id }) : Promise.resolve([]),
    tab === "deals" || tab === "overview"
      ? db().from("deals").select("id, name, deal_number, value, currency, probability, pipeline_stages(name, category)").eq("lead_id", id).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title={lead.name}
        subtitle={
          <span className="bos-row" style={{ gap: 8 }}>
            <span><Tx>{lead.lead_number}</Tx></span>
            {lead.company_name ? <span>· {lead.company_name}</span> : null}
            <StatusBadge label={stage.name} tone={stage.category === "won" ? "success" : stage.category === "lost" ? "danger" : "info"} />
            <StatusBadge map="priority" value={lead.priority} />
            {lead.archived_at ? <StatusBadge tone="neutral" label="مؤرشف" /> : null}
          </span>
        }
       
        actions={
          <>
            {can(bos, "chat.create") ? <ActionButton label="مناقشة داخلية" className="admin-btn small secondary" action={discussAction.bind(null, "lead", id)} /> : null}
            {canUpdate ? (
              <Link href={`/admin/sales/leads/${id}/edit`} className="admin-btn small secondary">
                <Tx>تعديل</Tx>
              </Link>
            ) : null}
            {can(bos, "activities.create") ? <ActivityComposer related={{ lead_id: id, client_id: lead.client_id, contact_id: lead.contact_id }} staff={staffOptions} /> : null}
            {can(bos, "meetings.create") ? <MeetingScheduler related={{ lead_id: id, client_id: lead.client_id, contact_id: lead.contact_id }} staff={staffOptions} defaultTitle={`Discovery — ${lead.company_name ?? lead.name}`} /> : null}
            {can(bos, "activities.create") ? <ActivityComposer related={{ lead_id: id }} staff={staffOptions} label="+ ملاحظة" defaultType="note" className="admin-btn small ghost" /> : null}
            {canUpdate && can(bos, "deals.create") && !lead.converted_deal_id && stage.category === "open" ? (
              <ConvertLeadButton
                leadId={id}
                currencies={currencies}
                products={products.filter((p) => p.is_active).map((p) => ({ value: p.id, label: p.name }))}
                initialClient={client ? { id: client.id, label: client.company_name ?? client.name } : null}
                defaults={{
                  dealName: lead.company_name ? `${lead.company_name} — ${lead.name}` : lead.name,
                  value: lead.estimated_budget ? String(lead.estimated_budget) : "",
                  currency: lead.budget_currency ?? "USD",
                  newClientName: lead.company_name ?? lead.name,
                  newClientEmail: lead.email ?? "",
                }}
              />
            ) : null}
            {lead.converted_deal_id ? (
              <Link href={`/admin/sales/deals/${lead.converted_deal_id}`} className="admin-btn small secondary">
                <Tx>فتح الصفقة</Tx>
              </Link>
            ) : null}
            {can(bos, "leads.delete") ? <ArchiveLeadButton leadId={id} archived={Boolean(lead.archived_at)} /> : null}
          </>
        }
      />

      <Summary
        items={[
          { label: "الحالة", value: canUpdate ? <LeadStageControl leadId={id} currentStageId={stage.id} stages={stages.filter((s) => s.is_active || s.id === stage.id)} /> : stage.name },
          { label: "التقييم", value: `${lead.total_score}/100` },
          { label: "المسؤول", value: can(bos, "leads.assign") ? <LeadAssignControl leadId={id} current={lead.assigned_to} staff={staffOptions} /> : <UserChip name={lead.assigned_to ? names.get(lead.assigned_to) : null} /> },
          { label: "المصدر", value: (lead.lead_sources as unknown as { name: string } | null)?.name ?? "—" },
          { label: "الدولة", value: lead.country ?? "—" },
          { label: "القطاع", value: lead.industry ?? "—" },
          { label: "الميزانية التقديرية", value: lead.estimated_budget ? <Money value={lead.estimated_budget} currency={lead.budget_currency} /> : "—" },
          { label: "النشاط التالي", value: lead.next_activity_at ? formatDateTime(lead.next_activity_at) : <span className="bos-faint"><Tx>غير مجدول</Tx></span> },
        ]}
      />

      <Tabs tabs={tabs} active={tab} baseHref={`/admin/sales/leads/${id}`} />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="البيانات الأساسية">
              <KeyValues
                items={[
                  { label: "الشركة", value: lead.company_name },
                  { label: "جهة الاتصال", value: lead.contact_name },
                  { label: "البريد", value: lead.email ? <a className="bos-link" href={`mailto:${lead.email}`}>{lead.email}</a> : null },
                  { label: "الهاتف", value: lead.phone ? <a className="bos-link" href={`tel:${lead.phone}`}>{lead.phone}</a> : null },
                  { label: "الموقع", value: lead.website ? <a className="bos-link" href={lead.website} target="_blank" rel="noreferrer">{lead.website}</a> : null },
                  { label: "المدينة", value: lead.city },
                  { label: "تاريخ الإنشاء", value: formatDate(lead.created_at) },
                  { label: "آخر نشاط", value: lead.last_activity_at ? formatDateTime(lead.last_activity_at) : null },
                ]}
              />
            </Card>
            <Card title="التأهيل">
              <KeyValues
                items={[
                  { label: "المنتج/الخدمة", value: (lead.products as unknown as { name: string } | null)?.name },
                  { label: "مرحلة العمل", value: lead.business_stage },
                  { label: "الإطار الزمني", value: lead.timeline },
                  { label: "صاحب القرار", value: lead.decision_maker },
                  { label: "الأولوية", value: statusLabel("priority", lead.priority) },
                  { label: "سبب الخسارة", value: lead.lost_reason, hidden: !lead.lost_reason },
                ]}
              />
              {lead.current_solution ? (
                <>
                  <div className="bos-divider" />
                  <div className="bos-kv-label"><Tx>الحل الحالي</Tx></div>
                  <div className="bos-prose"><Tx>{lead.current_solution}</Tx></div>
                </>
              ) : null}
              {lead.problem ? (
                <>
                  <div className="bos-divider" />
                  <div className="bos-kv-label"><Tx>المشكلة / الفرصة</Tx></div>
                  <div className="bos-prose"><Tx>{lead.problem}</Tx></div>
                </>
              ) : null}
              {lead.notes ? (
                <>
                  <div className="bos-divider" />
                  <div className="bos-kv-label"><Tx>ملاحظات</Tx></div>
                  <div className="bos-prose">{lead.notes}</div>
                </>
              ) : null}
            </Card>
          </div>
          <div>
            <Card title="التقييم">
              {[
                ["الميزانية", lead.budget_score],
                ["الملاءمة", lead.fit_score],
                ["النية", lead.intent_score],
                ["التفاعل", lead.engagement_score],
              ].map(([label, value]) => (
                <div key={label as string} style={{ marginBottom: 8 }}>
                  <div className="bos-row" style={{ justifyContent: "space-between", fontSize: 12.5 }}>
                    <span><Tx>{label}</Tx></span>
                    <span className="bos-num">{value}/25</span>
                  </div>
                  <div className="bos-progress">
                    <span style={{ width: `${(Number(value) / 25) * 100}%` }} />
                  </div>
                </div>
              ))}
            </Card>
            <Card title="الحساب والصفقات">
              <KeyValues
                items={[
                  { label: "الحساب", value: client ? <Link className="bos-link" href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "لم يُربط بعد" },
                  { label: "جهة الاتصال", value: contact ? <Link className="bos-link" href={`/admin/contacts/${contact.id}`}>{contact.full_name}</Link> : null },
                ]}
              />
              {deals.length ? (
                <div className="bos-stack" style={{ marginTop: 10 }}>
                  {deals.map((d) => (
                    <Link key={d.id} href={`/admin/sales/deals/${d.id}`} className="bos-row" style={{ justifyContent: "space-between" }}>
                      <span>{d.name}</span>
                      <Money value={d.value} currency={d.currency} />
                    </Link>
                  ))}
                </div>
              ) : null}
            </Card>
            <Card title="آخر الأحداث">
              <ActivityTimeline entityType="lead" entityId={id} limit={6} moreHref={`/admin/sales/leads/${id}?tab=timeline`} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "activities" ? (
        <Card title="الأنشطة" actions={can(bos, "activities.create") ? <ActivityComposer related={{ lead_id: id, client_id: lead.client_id }} staff={staffOptions} /> : null}>
          <ActivityList activities={activities} names={names} />
        </Card>
      ) : null}

      {tab === "communications" ? (
        <Card title="سجل التواصل" actions={can(bos, "activities.create") ? <ActivityComposer related={{ lead_id: id, client_id: lead.client_id }} staff={staffOptions} label="+ تواصل" defaultType="email" /> : null}>
          <ActivityList activities={communications} names={names} emptyTitle="لا يوجد تواصل مسجل" />
        </Card>
      ) : null}

      {tab === "notes" ? (
        <Card title="الملاحظات">
          <Comments entityType="lead" entityId={id} viewerId={bos.userId} />
        </Card>
      ) : null}

      {tab === "files" ? (
        <Card title="الملفات">
          <FileManager entityType="lead" entityId={id} canUpload={can(bos, "files.create")} />
        </Card>
      ) : null}

      {tab === "deals" ? (
        <Card title="الصفقات">
          {deals.length ? (
            <BosTable className="bos-table responsive">
              <thead>
                <tr>
                  <th><Tx>الصفقة</Tx></th>
                  <th><Tx>المرحلة</Tx></th>
                  <th><Tx>القيمة</Tx></th>
                  <th><Tx>الاحتمالية</Tx></th>
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => (
                  <tr key={d.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="الصفقة">
                      <Link href={`/admin/sales/deals/${d.id}`}>{d.name}</Link>
                      <span className="cell-sub">{d.deal_number}</span>
                    </td>
                    <td data-label="المرحلة">{(d.pipeline_stages as unknown as { name: string } | null)?.name}</td>
                    <td data-label="القيمة"><Money value={d.value} currency={d.currency} /></td>
                    <td data-label="الاحتمالية">{d.probability}%</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد صفقات لهذا العميل المحتمل" description="عند تأهيل العميل حوّله إلى صفقة من زر “تحويل إلى صفقة”." />
          )}
        </Card>
      ) : null}

      {tab === "meetings" ? (
        <Card title="الاجتماعات" actions={can(bos, "meetings.create") ? <MeetingScheduler related={{ lead_id: id, client_id: lead.client_id, contact_id: lead.contact_id }} staff={staffOptions} /> : null}>
          {meetings.length ? (
            <BosTable className="bos-table responsive">
              <thead>
                <tr>
                  <th><Tx>الاجتماع</Tx></th>
                  <th><Tx>الموعد</Tx></th>
                  <th><Tx>الحالة</Tx></th>
                  <th><Tx>النتيجة</Tx></th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => (
                  <tr key={m.id}>
                    <td className="cell-primary cell-primary-mobile" data-label="الاجتماع">
                      <Link href={`/admin/communication/meetings/${m.id}`}><Tx>{m.title}</Tx></Link>
                    </td>
                    <td data-label="الموعد">{formatDateTime(m.start_at)}</td>
                    <td data-label="الحالة"><StatusBadge map="meeting_status" value={m.status} /></td>
                    <td data-label="النتيجة"><Tx>{m.outcome ?? "—"}</Tx></td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          ) : (
            <EmptyState title="لا توجد اجتماعات" />
          )}
        </Card>
      ) : null}

      {tab === "timeline" ? (
        <Card title="السجل الزمني">
          <ActivityTimeline entityType="lead" entityId={id} limit={200} />
        </Card>
      ) : null}
    </>
  );
}
