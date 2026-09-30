import { RecordDocuments } from "@/components/bos/RecordDocuments";
import { Tx } from "@/components/bos/I18n";
import { nowIso } from "@/lib/bos/clock";
import Link from "next/link";
import { ActionButton } from "@/components/bos/Dialog";
import { discussAction } from "@/app/admin/communication/chat/actions";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { NotFoundError } from "@/lib/bos/errors";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getAccount360, listUpsellOpportunities } from "@/services/bos/accounts";
import { listAccountContacts } from "@/services/bos/contacts";
import { listClientOnboarding } from "@/services/bos/onboarding";
import { listCommunications } from "@/services/bos/communications";
import { canSeeSensitive, listActiveStaff, userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, Tabs, EmptyState, UserChip, ProgressBar } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { ActivityComposer } from "@/components/bos/ActivityComposer";
import { MeetingScheduler } from "@/components/bos/MeetingScheduler";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { statusLabel } from "@/lib/bos/labels";
import { crmStageLabels } from "@/lib/crm";
import { ContactModalButton } from "@/app/admin/contacts/ContactForm";
import { CommunicationList } from "@/app/admin/communications/CommunicationList";
import { ArchiveAccountButton, ArchiveContactButton, InvitePortalButton, MergeAccountButton, OnboardingItemToggle, PortalUserStatusButton, PrimaryContactButton, StartOnboardingButton } from "./AccountControls";
import { listPortalUsers } from "@/services/bos/portal-admin";
import { PortalPermissionsButton, SupportPlanButton } from "@/components/bos/PortalExtraControls";

type Row = Record<string, unknown>;

function SimpleTable({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="bos-table-scroll">
      <table className="bos-table responsive">
        <thead>
          <tr>{head.map((h) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} data-label={head[j]} className={j === 0 ? "cell-primary cell-primary-mobile" : undefined}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("clients.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  if (!(await canAccessEntity(bos, "client", id))) notFound();

  let a360;
  try {
    a360 = await getAccount360(id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { account, counts } = a360;
  const title = account.company_name ?? account.name;
  const canInvoices = can(bos, "invoices.read");
  const canPayments = can(bos, "payments.read");
  const canRevenue = canSeeSensitive(bos, "revenue");
  const canUpdate = can(bos, "clients.update") && (await canAccessEntity(bos, "client", id, "update"));

  const tabs = [
    { key: "overview", label: "نظرة عامة" },
    { key: "contacts", label: "جهات الاتصال", count: counts.contacts },
    { key: "deals", label: "الصفقات", count: counts.deals, hidden: !can(bos, "deals.read") },
    { key: "projects", label: "المشاريع", count: counts.projects, hidden: !can(bos, "projects.read") },
    { key: "contracts", label: "العقود", count: counts.contracts, hidden: !can(bos, "contracts.read") },
    { key: "invoices", label: "الفواتير", count: counts.invoices, hidden: !canInvoices },
    { key: "payments", label: "الدفعات", count: counts.payments, hidden: !canPayments },
    { key: "communications", label: "التواصل", hidden: !can(bos, "communications.read") },
    { key: "meetings", label: "الاجتماعات", count: counts.meetings, hidden: !can(bos, "meetings.read") },
    { key: "files", label: "الملفات" },
    { key: "tickets", label: "التذاكر", count: counts.openTickets || undefined, hidden: !can(bos, "tickets.read") },
    { key: "issues", label: "المشكلات", count: counts.openIssues || undefined, hidden: !can(bos, "issues.read") },
    { key: "change_requests", label: "طلبات التغيير", count: counts.changeRequests, hidden: !can(bos, "change_requests.read") },
    { key: "onboarding", label: "التهيئة" },
    { key: "upsell", label: "البيع الإضافي", hidden: !can(bos, "deals.read") },
    { key: "timeline", label: "السجل الزمني" },
    { key: "history", label: "سجل التدقيق", hidden: !can(bos, "audit.read") },
  ];
  const tab = tabs.some((t) => t.key === sp.tab && !t.hidden) ? (sp.tab as string) : "overview";

  const [staff, names] = await Promise.all([listActiveStaff(), userNameMap()]);
  const staffOptions = staff.map((s) => ({ value: s.userId, label: s.name }));
  const c = db();
  const load = <T,>(when: boolean, p: PromiseLike<{ data: T[] | null }>) => (when ? Promise.resolve(p).then((r) => r.data ?? []) : Promise.resolve([] as T[]));

  const [contacts, deals, proposals, projects, contracts, invoices, payments, meetings, tickets, issues, crs, onboarding, upsell, comms] = await Promise.all([
    tab === "contacts" || tab === "overview" ? listAccountContacts(id, tab === "contacts" && sp.archived === "1") : Promise.resolve([]),
    load<Row>(tab === "deals" || tab === "overview", c.from("deals").select("id, deal_number, name, value, currency, probability, expected_close_date, assigned_to, is_upsell, payment_status, pipeline_stages(name, category)").eq("client_id", id).is("archived_at", null).order("created_at", { ascending: false })),
    load<Row>(tab === "deals", c.from("proposals").select("id, title, status, total_amount, currency, sent_at, valid_until").eq("client_id", id).order("created_at", { ascending: false })),
    load<Row>(tab === "projects" || tab === "overview", c.from("projects").select("id, project_number, name, status, health, progress, deadline, pm_id").eq("client_id", id).order("created_at", { ascending: false })),
    load<Row>(tab === "contracts", c.from("contracts").select("id, contract_number, title, status, value, currency, signed_at, start_date, end_date").eq("client_id", id).order("created_at", { ascending: false })),
    load<Row>(tab === "invoices" && canInvoices, c.from("invoices").select("id, invoice_number, total, balance, currency, status, issue_date, due_date").eq("client_id", id).order("issue_date", { ascending: false })),
    load<Row>(tab === "payments" && canPayments, c.from("payments").select("id, payment_number, amount, refunded_amount, currency, status, method, payment_date").eq("client_id", id).order("payment_date", { ascending: false })),
    load<Row>(tab === "meetings" || tab === "overview", c.from("meetings").select("id, title, start_at, duration_minutes, status, organizer_id").eq("client_id", id).order("start_at", { ascending: false }).limit(100)),
    load<Row>(tab === "tickets", c.from("tickets").select("id, ticket_number, subject, priority, status, assigned_to, created_at").eq("client_id", id).order("created_at", { ascending: false })),
    load<Row>(tab === "issues" && a360.projectIds.length > 0, c.from("issues").select("id, title, severity, status, project_id, assigned_to, created_at").in("project_id", a360.projectIds.length ? a360.projectIds : ["00000000-0000-0000-0000-000000000000"]).order("created_at", { ascending: false })),
    load<Row>(tab === "change_requests", c.from("change_requests").select("id, cr_number, title, status, additional_cost, currency, additional_days, created_at").eq("client_id", id).order("created_at", { ascending: false })),
    tab === "onboarding" || tab === "overview" ? listClientOnboarding(id) : Promise.resolve([]),
    tab === "upsell" ? listUpsellOpportunities(id) : Promise.resolve(null),
    tab === "communications" ? listCommunications(bos, "all", { client: id, kind: sp.kind, direction: sp.direction, page: Number(sp.page) || 1 }) : Promise.resolve(null),
  ]);

  const multi = (items: { currency: string; amount: string }[]) => (items.length ? items.map((m) => <div key={m.currency}><Money value={m.amount} currency={m.currency} /></div>) : "—");
  const portalUsers = tab === "contacts" ? await listPortalUsers(id) : [];
  // Maintenance & support plans shown on the overview (docs/bos/30 §23).
  const { data: supportPlans } = tab === "overview" ? await c.from("support_plans").select("*").eq("client_id", id).order("starts_on", { ascending: false }) : { data: [] as Record<string, unknown>[] };
  const portalByContact = new Map(portalUsers.map((u) => [u.contact_id, u]));
  const canPortal = can(bos, "portal.manage");
  const accountOption = { id, label: title, sub: account.email };
  const wonDealsWithoutOnboarding = tab === "onboarding" ? ((await c.from("deals").select("id, deal_number, name, pipeline_stages!inner(category)").eq("client_id", id).eq("pipeline_stages.category", "won")).data ?? []).filter((d) => !onboarding.some((o) => o.deal_id === d.id)) : [];

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          <span className="bos-row" style={{ gap: 8 }}>
            {account.archived_at ? <StatusBadge tone="neutral" label="مؤرشف" /> : <StatusBadge map="account_status" value={account.account_status} />}
            {account.company_name ? <span>{account.name}</span> : null}
            <span className="bos-faint" dir="ltr">{account.email}</span>
          </span>
        }
        breadcrumbs={[{ label: "العملاء" }, { label: "الحسابات", href: "/admin/clients" }, { label: title }]}
        actions={
          <>
            {can(bos, "chat.create") ? <ActionButton label="مناقشة داخلية" className="admin-btn small secondary" action={discussAction.bind(null, "client", id)} /> : null}
            {canUpdate && !account.archived_at ? <Link href={`/admin/clients/${id}/edit`} className="admin-btn small secondary"><Tx>تعديل</Tx></Link> : null}
            {can(bos, "contacts.create") && !account.archived_at ? <ContactModalButton initial={{ client_id: id }} lockAccount /> : null}
            {can(bos, "deals.create") && !account.archived_at ? <Link href={`/admin/sales/deals/new?clientId=${id}`} className="admin-btn small secondary"><Tx>+ صفقة</Tx></Link> : null}
            {can(bos, "activities.create") ? <ActivityComposer related={{ client_id: id, contact_id: account.primary_contact_id }} staff={staffOptions} /> : null}
            {can(bos, "meetings.create") ? <MeetingScheduler related={{ client_id: id, contact_id: account.primary_contact_id }} staff={staffOptions} defaultTitle={`${title} — meeting`} /> : null}
            {can(bos, "tickets.create") && !account.archived_at ? <Link href={`/admin/support/tickets/new?clientId=${id}`} className="admin-btn small secondary"><Tx>+ تذكرة</Tx></Link> : null}
            {can(bos, "clients.manage") && !account.archived_at ? <MergeAccountButton id={id} name={title} /> : null}
            {can(bos, "clients.delete") ? <ArchiveAccountButton id={id} archived={!!account.archived_at} /> : null}
          </>
        }
      />
      {sp.merged ? <div className="bos-alert success"><Tx vars={{ merged: sp.merged }}>{"تم الدمج ونقل {merged} سجل إلى هذا الحساب."}</Tx></div> : null}

      <Summary
        items={[
          { label: "مدير الحساب", value: <UserChip name={account.account_manager_id ? names.get(account.account_manager_id) : null} /> },
          { label: "جهة الاتصال الرئيسية", value: a360.primaryContact ? <Link href={`/admin/contacts/${a360.primaryContact.id}`}>{a360.primaryContact.full_name}</Link> : "—" },
          { label: "الدولة", value: [account.country, account.city].filter(Boolean).join(" · ") || "—" },
          { label: "مشاريع نشطة", value: `${counts.activeProjects} / ${counts.projects}` },
          { label: "صفقات مفتوحة", value: counts.openDeals },
          ...(canRevenue ? [{ label: "إجمالي الإيراد", value: multi(a360.revenue) }] : []),
          ...(canInvoices ? [{ label: "المستحق", value: <>{multi(a360.outstanding)}{a360.overdueInvoices ? <span className="cell-sub" style={{ color: "#f87171" }}><Tx vars={{ overdueInvoices: a360.overdueInvoices }}>{"{overdueInvoices} فاتورة متأخرة"}</Tx></span> : null}</> }] : []),
          { label: "آخر نشاط", value: formatDate(a360.lastActivityAt) },
        ]}
      />

      <Tabs tabs={tabs} active={tab} baseHref={`/admin/clients/${id}`} />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="بيانات الحساب">
              <KeyValues
                items={[
                  { label: "الشركة", value: account.company_name },
                  { label: "اسم العميل", value: account.name },
                  { label: "البريد", value: <span dir="ltr">{account.email}</span> },
                  { label: "الهاتف", value: account.phone ? <span dir="ltr">{account.phone}</span> : null },
                  { label: "الموقع", value: account.website ? <a className="bos-link" href={account.website} target="_blank" rel="noreferrer">{account.website}</a> : null },
                  { label: "المجال", value: account.industry },
                  { label: "العنوان", value: account.address },
                  { label: "الرقم الضريبي", value: account.tax_id },
                  { label: "العملة الافتراضية", value: account.default_currency },
                  { label: "مرحلة CRM القديمة", value: account.crm_stage ? crmStageLabels[account.crm_stage] ?? account.crm_stage : null },
                  { label: "تاريخ الإنشاء", value: formatDate(account.created_at) },
                ]}
              />
              {account.notes ? <div className="bos-prose" style={{ marginTop: 10 }}>{account.notes}</div> : null}
            </Card>
            <Card title="خطط الصيانة والدعم" actions={canUpdate ? <SupportPlanButton clientId={id} projects={projects.map((p) => ({ value: p.id as string, label: p.name as string }))} /> : null}>
              {(supportPlans ?? []).length ? (supportPlans ?? []).map((pl) => (
                <div key={pl.id as string} className="bos-row" style={{ gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                  <strong>{pl.name as string}</strong>
                  <StatusBadge tone={pl.status === "active" ? "success" : pl.status === "expired" ? "danger" : "neutral"} label={({ active: "سارية", paused: "موقوفة", expired: "منتهية", cancelled: "ملغاة" } as Record<string, string>)[pl.status as string] ?? (pl.status as string)} />
                  <span className="bos-faint">{formatDate(pl.starts_on as string)} → {pl.ends_on ? formatDate(pl.ends_on as string) : "—"}{pl.monthly_hours != null ? ` · ${Number(pl.monthly_hours)} h` : ""}</span>
                  {canUpdate ? <SupportPlanButton clientId={id} projects={projects.map((p) => ({ value: p.id as string, label: p.name as string }))} plan={pl as never} /> : null}
                </div>
              )) : <EmptyState title="لا توجد خطط صيانة" />}
            </Card>
            <Card title="المشاريع" actions={<Link className="bos-link" href={`/admin/clients/${id}?tab=projects`}><Tx>الكل</Tx></Link>}>
              <SimpleTable
                head={["المشروع", "الحالة", "التقدم", "الموعد"]}
                empty="لا توجد مشاريع"
                rows={projects.slice(0, 5).map((p) => [
                  <Link key="n" href={`/admin/projects/${p.id}`}><Tx>{p.name as string}</Tx></Link>,
                  <StatusBadge key="s" map="project_status" value={p.status as string} />,
                  <ProgressBar key="p" value={p.progress as number} />,
                  formatDate(p.deadline as string | null),
                ])}
              />
            </Card>
            <Card title="الصفقات" actions={<Link className="bos-link" href={`/admin/clients/${id}?tab=deals`}><Tx>الكل</Tx></Link>}>
              <SimpleTable
                head={["الصفقة", "المرحلة", "القيمة"]}
                empty="لا توجد صفقات"
                rows={deals.slice(0, 5).map((d) => [
                  <Link key="n" href={`/admin/sales/deals/${d.id}`}><Tx>{d.name as string}</Tx></Link>,
                  (d.pipeline_stages as { name: string } | null)?.name ?? "—",
                  <Money key="v" value={d.value} currency={d.currency as string} />,
                ])}
              />
            </Card>
          </div>
          <div>
            <Card title="جهات الاتصال" actions={<Link className="bos-link" href={`/admin/clients/${id}?tab=contacts`}><Tx>الكل</Tx></Link>}>
              {contacts.length ? (
                <div className="bos-stack" style={{ gap: 8 }}>
                  {contacts.slice(0, 5).map((ct) => (
                    <div key={ct.id}>
                      <Link href={`/admin/contacts/${ct.id}`}>{ct.full_name}</Link>
                      {ct.id === account.primary_contact_id ? <span className="bos-badge tone-accent plain" style={{ marginInlineStart: 6 }}><Tx>رئيسية</Tx></span> : null}
                      {ct.is_decision_maker ? <span className="bos-badge tone-info plain" style={{ marginInlineStart: 6 }}><Tx>صاحب قرار</Tx></span> : null}
                      <div className="bos-faint" style={{ fontSize: 12 }}>{[ct.position, ct.email, ct.phone].filter(Boolean).join(" · ")}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="لا توجد جهات اتصال" />
              )}
            </Card>
            {onboarding.filter((o) => o.status === "in_progress").map((o) => (
              <Card key={o.id} title="التهيئة الجارية" actions={<Link className="bos-link" href={`/admin/clients/${id}?tab=onboarding`}><Tx>التفاصيل</Tx></Link>}>
                <ProgressBar value={o.percent} />
                <div className="bos-faint" style={{ fontSize: 12, marginTop: 6 }}>{o.items.filter((i) => !i.is_done).slice(0, 3).map((i) => i.label).join(" · ")}</div>
              </Card>
            ))}
            <Card title="الاجتماعات القادمة">
              {meetings.filter((m) => (m.start_at as string) >= nowIso() && m.status === "scheduled").slice(0, 4).map((m) => (
                <div key={m.id as string} style={{ marginBottom: 6 }}>
                  <Link href={`/admin/communication/meetings/${m.id}`}><Tx>{m.title as string}</Tx></Link>
                  <div className="bos-faint" style={{ fontSize: 12 }}>{formatDateTime(m.start_at as string)}</div>
                </div>
              ))}
              {!meetings.some((m) => (m.start_at as string) >= nowIso() && m.status === "scheduled") ? <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لا توجد اجتماعات قادمة.</Tx></div> : null}
            </Card>
            <Card title="ملاحظات داخلية"><Comments entityType="client" entityId={id} viewerId={bos.userId} /></Card>
          </div>
        </div>
      ) : null}

      {tab === "contacts" ? (
        <Card
          title="جهات الاتصال"
          actions={<Link className="bos-link" href={`/admin/clients/${id}?tab=contacts${sp.archived === "1" ? "" : "&archived=1"}`}><Tx>{sp.archived === "1" ? "إخفاء المؤرشفة" : "عرض المؤرشفة"}</Tx></Link>}
        >
          <SimpleTable
            head={["الاسم", "المنصب", "البريد", "الهاتف", "واتساب", "صاحب قرار", "البوابة", ""]}
            empty="لا توجد جهات اتصال"
            rows={contacts.map((ct) => [
              <span key="n">
                <Link href={`/admin/contacts/${ct.id}`}>{ct.full_name}</Link>
                {ct.id === account.primary_contact_id ? <span className="bos-badge tone-accent plain" style={{ marginInlineStart: 6 }}><Tx>رئيسية</Tx></span> : null}
                {ct.archived_at ? <span className="bos-badge tone-neutral plain" style={{ marginInlineStart: 6 }}><Tx>مؤرشفة</Tx></span> : null}
              </span>,
              ct.position ?? "—",
              ct.email ? <a key="e" className="bos-link" href={`mailto:${ct.email}`} dir="ltr">{ct.email}</a> : "—",
              ct.phone ? <span key="p" dir="ltr">{ct.phone}</span> : "—",
              ct.whatsapp ? <a key="w" className="bos-link" href={`https://wa.me/${ct.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" dir="ltr"><Tx>{ct.whatsapp}</Tx></a> : "—",
              ct.is_decision_maker ? "نعم" : "—",
              portalByContact.get(ct.id) ? (
                <span key="pt" className="bos-row" style={{ gap: 4 }}>
                  <StatusBadge tone={portalByContact.get(ct.id)!.status === "active" ? "success" : portalByContact.get(ct.id)!.status === "disabled" ? "neutral" : "warning"} label={portalByContact.get(ct.id)!.status === "active" ? "نشط" : portalByContact.get(ct.id)!.status === "disabled" ? "معطّل" : "مدعو"} />
                  {canPortal ? <PortalUserStatusButton clientId={id} portalUserId={portalByContact.get(ct.id)!.id} status={portalByContact.get(ct.id)!.status} /> : null}
                  {canPortal ? <PortalPermissionsButton clientId={id} portalUserId={portalByContact.get(ct.id)!.id} permissions={(portalByContact.get(ct.id)!.permissions ?? {}) as Record<string, boolean>} /> : null}
                </span>
              ) : canPortal && ct.email && !ct.archived_at && !account.archived_at ? <InvitePortalButton key="pi" clientId={id} contactId={ct.id} /> : "—",
              <span key="a" className="bos-row" style={{ gap: 4 }}>
                {can(bos, "contacts.update") && !ct.archived_at ? <ContactModalButton label="تعديل" className="admin-btn small ghost" lockAccount initial={{ ...ct, isPrimary: ct.id === account.primary_contact_id }} /> : null}
                {canUpdate && !ct.archived_at && ct.id !== account.primary_contact_id ? <PrimaryContactButton clientId={id} contactId={ct.id} /> : null}
                {can(bos, "contacts.delete") ? <ArchiveContactButton id={ct.id} archived={!!ct.archived_at} /> : null}
              </span>,
            ])}
          />
        </Card>
      ) : null}

      {tab === "deals" ? (
        <>
          <Card title="الصفقات">
            <SimpleTable
              head={["الصفقة", "المرحلة", "القيمة", "الاحتمالية", "الإغلاق المتوقع", "المسؤول", "الدفع"]}
              empty="لا توجد صفقات"
              rows={deals.map((d) => [
                <Link key="n" href={`/admin/sales/deals/${d.id}`}><Tx>{d.name as string}</Tx><span className="cell-sub">{d.deal_number as string}{d.is_upsell ? " · بيع إضافي" : ""}</span></Link>,
                (d.pipeline_stages as { name: string } | null)?.name ?? "—",
                <Money key="v" value={d.value} currency={d.currency as string} />,
                `${d.probability}%`,
                formatDate(d.expected_close_date as string | null),
                d.assigned_to ? names.get(d.assigned_to as string) ?? "—" : "—",
                <StatusBadge key="p" map="deal_payment_status" value={d.payment_status as string} />,
              ])}
            />
          </Card>
          {can(bos, "proposals.read") ? (
            <Card title="المقترحات">
              <SimpleTable
                head={["المقترح", "الحالة", "القيمة", "أُرسل", "صالح حتى"]}
                empty="لا توجد مقترحات"
                rows={proposals.map((p) => [
                  <Link key="n" href={`/admin/sales/proposals/${p.id}`}><Tx>{p.title as string}</Tx></Link>,
                  <StatusBadge key="s" map="proposal_status" value={p.status as string} />,
                  <Money key="v" value={p.total_amount} currency={p.currency as string} />,
                  formatDate(p.sent_at as string | null),
                  formatDate(p.valid_until as string | null),
                ])}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === "projects" ? (
        <Card>
          <SimpleTable
            head={["المشروع", "الحالة", "الصحة", "التقدم", "الموعد", "مدير المشروع"]}
            empty="لا توجد مشاريع"
            rows={projects.map((p) => [
              <Link key="n" href={`/admin/projects/${p.id}`}><Tx>{p.name as string}</Tx><span className="cell-sub"><Tx>{p.project_number as string}</Tx></span></Link>,
              <StatusBadge key="s" map="project_status" value={p.status as string} />,
              <StatusBadge key="h" map="project_health" value={p.health as string} />,
              <ProgressBar key="p" value={p.progress as number} />,
              formatDate(p.deadline as string | null),
              p.pm_id ? names.get(p.pm_id as string) ?? "—" : "—",
            ])}
          />
        </Card>
      ) : null}

      {tab === "contracts" ? (
        <Card>
          <SimpleTable
            head={["العقد", "الحالة", "القيمة", "التوقيع", "البداية", "النهاية"]}
            empty="لا توجد عقود"
            rows={contracts.map((k) => [
              <Link key="n" href={`/admin/sales/contracts/${k.id}`}><Tx>{k.title as string}</Tx><span className="cell-sub"><Tx>{k.contract_number as string}</Tx></span></Link>,
              <StatusBadge key="s" map="contract_status" value={k.status as string} />,
              <Money key="v" value={k.value} currency={k.currency as string} />,
              formatDate(k.signed_at as string | null),
              formatDate(k.start_date as string | null),
              formatDate(k.end_date as string | null),
            ])}
          />
        </Card>
      ) : null}

      {tab === "invoices" ? (
        <Card actions={can(bos, "invoices.create") ? <Link className="admin-btn small secondary" href={`/admin/finance/invoices/new?clientId=${id}`}><Tx>+ فاتورة</Tx></Link> : null}>
          <SimpleTable
            head={["الفاتورة", "الحالة", "الإجمالي", "المتبقي", "الإصدار", "الاستحقاق"]}
            empty="لا توجد فواتير"
            rows={invoices.map((i) => [
              <Link key="n" href={`/admin/finance/invoices/${i.id}`}><Tx>{i.invoice_number as string}</Tx></Link>,
              <StatusBadge key="s" map="invoice_status" value={i.status as string} />,
              <Money key="t" value={i.total} currency={i.currency as string} />,
              <Money key="b" value={i.balance} currency={i.currency as string} />,
              formatDate(i.issue_date as string | null),
              formatDate(i.due_date as string | null),
            ])}
          />
        </Card>
      ) : null}

      {tab === "payments" ? (
        <Card>
          <SimpleTable
            head={["الدفعة", "الحالة", "المبلغ", "المسترد", "الطريقة", "التاريخ"]}
            empty="لا توجد دفعات"
            rows={payments.map((p) => [
              <Link key="n" href={`/admin/finance/payments/${p.id}`}><Tx>{p.payment_number as string}</Tx></Link>,
              <StatusBadge key="s" map="payment_status" value={p.status as string} />,
              <Money key="a" value={p.amount} currency={p.currency as string} />,
              Number(p.refunded_amount) ? <Money key="r" value={p.refunded_amount} currency={p.currency as string} /> : "—",
              statusLabel("payment_method", p.method as string),
              formatDate(p.payment_date as string),
            ])}
          />
        </Card>
      ) : null}

      {tab === "communications" && comms ? (
        <Card title="سجل التواصل" actions={<Link className="bos-link" href={`/admin/communications?client=${id}`}><Tx>فتح السجل الكامل</Tx></Link>}>
          <CommunicationList items={comms.rows} names={Object.fromEntries(names)} />
        </Card>
      ) : null}

      {tab === "meetings" ? (
        <Card>
          <SimpleTable
            head={["الاجتماع", "الموعد", "المدة", "المنظم", "الحالة"]}
            empty="لا توجد اجتماعات"
            rows={meetings.map((m) => [
              <Link key="n" href={`/admin/communication/meetings/${m.id}`}><Tx>{m.title as string}</Tx></Link>,
              formatDateTime(m.start_at as string),
              `${m.duration_minutes} د`,
              m.organizer_id ? names.get(m.organizer_id as string) ?? "—" : "—",
              <StatusBadge key="s" map="meeting_status" value={m.status as string} />,
            ])}
          />
        </Card>
      ) : null}

      {tab === "files" ? (
        <Card title="ملفات الحساب">
          <FileManager entityType="client" entityId={id} canUpload={can(bos, "files.create")} allowClientVisible />
        </Card>
      ) : null}

      {tab === "tickets" ? (
        <Card>
          <SimpleTable
            head={["التذكرة", "الأولوية", "الحالة", "المسؤول", "التاريخ"]}
            empty="لا توجد تذاكر"
            rows={tickets.map((t) => [
              <Link key="n" href={`/admin/support/tickets/${t.id}`}><Tx>{t.subject as string}</Tx><span className="cell-sub"><Tx>{t.ticket_number as string}</Tx></span></Link>,
              <StatusBadge key="p" map="priority" value={t.priority as string} />,
              <StatusBadge key="s" map="ticket_status" value={t.status as string} />,
              t.assigned_to ? names.get(t.assigned_to as string) ?? "—" : "—",
              formatDate(t.created_at as string),
            ])}
          />
        </Card>
      ) : null}

      {tab === "issues" ? (
        <Card>
          <SimpleTable
            head={["المشكلة", "الخطورة", "الحالة", "المسؤول", "التاريخ"]}
            empty="لا توجد مشكلات"
            rows={issues.map((i) => [
              <Link key="n" href={`/admin/projects/issues/${i.id}`}><Tx>{i.title as string}</Tx></Link>,
              <StatusBadge key="sv" map="severity" value={i.severity as string} />,
              <StatusBadge key="s" map="issue_status" value={i.status as string} />,
              i.assigned_to ? names.get(i.assigned_to as string) ?? "—" : "—",
              formatDate(i.created_at as string),
            ])}
          />
        </Card>
      ) : null}

      {tab === "change_requests" ? (
        <Card>
          <SimpleTable
            head={["الطلب", "الحالة", "التكلفة", "أيام إضافية", "التاريخ"]}
            empty="لا توجد طلبات تغيير"
            rows={crs.map((r) => [
              <Link key="n" href={`/admin/projects/change-requests/${r.id}`}><Tx>{r.title as string}</Tx><span className="cell-sub"><Tx>{r.cr_number as string}</Tx></span></Link>,
              <StatusBadge key="s" map="change_request_status" value={r.status as string} />,
              <Money key="c" value={r.additional_cost} currency={r.currency as string} />,
              String(r.additional_days),
              formatDate(r.created_at as string),
            ])}
          />
        </Card>
      ) : null}

      {tab === "onboarding" ? (
        <>
          {canUpdate && wonDealsWithoutOnboarding.length ? (
            <Card title="صفقات مكسوبة بدون تهيئة">
              <div className="bos-row" style={{ gap: 8, flexWrap: "wrap" }}>
                {wonDealsWithoutOnboarding.map((d) => <StartOnboardingButton key={d.id} clientId={id} dealId={d.id} label={`بدء التهيئة: ${d.deal_number}`} />)}
              </div>
            </Card>
          ) : null}
          {onboarding.length === 0 ? <EmptyState title="لا توجد قوائم تهيئة" description="تبدأ التهيئة تلقائياً عند تحويل صفقة إلى «مكسوبة»." /> : null}
          {onboarding.map((o) => {
            const deal = o.deals as unknown as { id: string; deal_number: string; name: string } | null;
            const project = o.projects as unknown as { id: string; name: string } | null;
            return (
              <Card
                key={o.id}
                title={
                  <span className="bos-row" style={{ gap: 8 }}>
                    تهيئة {deal ? <Link href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : null}
                    <StatusBadge tone={o.status === "completed" ? "success" : o.status === "cancelled" ? "neutral" : "info"} label={o.status === "completed" ? "مكتملة" : o.status === "cancelled" ? "ملغاة" : "جارية"} />
                  </span>
                }
                actions={project ? <Link className="bos-link" href={`/admin/projects/${project.id}`}>{project.name}</Link> : null}
              >
                <div style={{ marginBottom: 10 }}>
                  <ProgressBar value={o.percent} tone={o.percent === 100 ? "success" : undefined} />
                  <div className="bos-faint" style={{ fontSize: 12, marginTop: 4 }}>{o.percent}% · بدأت {formatDate(o.created_at)}{o.due_date ? ` · الاستحقاق ${formatDate(o.due_date)}` : ""}{o.completed_at ? ` · اكتملت ${formatDate(o.completed_at)}` : ""}</div>
                </div>
                <table className="bos-table">
                  <tbody>
                    {o.items.map((it) => (
                      <tr key={it.id}>
                        <td style={{ width: 32 }}><OnboardingItemToggle clientId={id} itemId={it.id} done={it.is_done} auto={!!it.auto_key} disabled={!canUpdate || o.status === "cancelled"} /></td>
                        <td>
                          <span style={it.is_done ? { textDecoration: "line-through", opacity: 0.7 } : undefined}><Tx>{it.label}</Tx></span>
                          {it.auto_key ? <span className="bos-badge tone-neutral plain" style={{ marginInlineStart: 6 }}><Tx>تلقائي</Tx></span> : null}
                          {!it.required ? <span className="bos-faint" style={{ marginInlineStart: 6, fontSize: 12 }}><Tx>(اختياري)</Tx></span> : null}
                        </td>
                        <td className="bos-faint" style={{ fontSize: 12 }}><Tx>{it.responsible ?? ""}</Tx></td>
                        <td className="bos-faint" style={{ fontSize: 12 }}>{it.done_at ? `${it.done_by ? names.get(it.done_by) ?? "النظام" : "النظام"} · ${formatDate(it.done_at)}` : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === "upsell" && upsell ? (
        <>
          <Card title="مشاريع مكتملة (فرص بيع إضافي)">
            <SimpleTable
              head={["المشروع", "اكتمل", "الرضا", "الدعم حتى", ""]}
              empty="لا توجد مشاريع مكتملة بعد"
              rows={upsell.completed.map((p) => [
                <Link key="n" href={`/admin/projects/${p.id}`}>{p.name}<span className="cell-sub">{p.project_number}</span></Link>,
                formatDate(p.completed_at),
                p.satisfaction_score != null ? `${p.satisfaction_score}/10` : "—",
                formatDate(p.support_until),
                can(bos, "deals.create") && !account.archived_at ? <Link key="u" className="admin-btn small" href={`/admin/sales/deals/new?fromProject=${p.id}`}><Tx>إنشاء صفقة بيع إضافي</Tx></Link> : null,
              ])}
            />
          </Card>
          <Card title="صفقات البيع الإضافي">
            <SimpleTable
              head={["الصفقة", "المرحلة", "القيمة", "التاريخ"]}
              empty="لا توجد صفقات بيع إضافي"
              rows={upsell.upsells.map((d) => [
                <Link key="n" href={`/admin/sales/deals/${d.id}`}>{d.name}<span className="cell-sub">{d.deal_number}</span></Link>,
                (d.pipeline_stages as unknown as { name: string } | null)?.name ?? "—",
                <Money key="v" value={d.value} currency={d.currency} />,
                formatDate(d.created_at),
              ])}
            />
          </Card>
        </>
      ) : null}

      {tab === "timeline" ? (
        <Card title="السجل الزمني للحساب">
          <ActivityTimeline entityType="client" entityId={id} limit={100} />
        </Card>
      ) : null}

      {tab === "history" ? (
        <Card title="سجل التدقيق">
          <AuditLogPanel entityType="client" entityId={id} />
        </Card>
      ) : null}
      {tab === "overview" ? <RecordDocuments bos={bos} entityType="client" entityId={id} /> : null}
    </>
  );
}
