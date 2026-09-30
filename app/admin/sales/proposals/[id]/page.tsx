import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { getProposalAccessAdmin } from "@/services/proposal-access";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Summary, Card, KeyValues, StatusBadge, Money, Tabs } from "@/components/bos/ui";
import { ActivityTimeline } from "@/components/bos/ActivityTimeline";
import { ApprovalPanel } from "@/components/bos/ApprovalPanel";
import { Comments } from "@/components/bos/Comments";
import { FileManager } from "@/components/bos/FileManager";
import { AuditLogPanel } from "@/components/bos/AuditLogPanel";
import { StatusActions } from "@/app/admin/proposals/[id]/edit/StatusActions";
import { formatDate, formatDateTime } from "@/lib/bos/format";

const tabs = [
  { key: "overview", label: "نظرة عامة" },
  { key: "approvals", label: "المراجعة الداخلية" },
  { key: "notes", label: "الملاحظات" },
  { key: "files", label: "الملفات" },
  { key: "timeline", label: "السجل الزمني" },
  { key: "history", label: "سجل التدقيق" },
];

export default async function ProposalDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { bos } = await requirePermission("proposals.read");
  const { id } = await params;
  const sp = await readParams(searchParams);
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab : "overview";
  if (!(await canAccessEntity(bos, "proposal", id))) notFound();

  const { data: p, error } = await db().from("proposals").select("*, clients(id, name, company_name), deals(id, name, deal_number)").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!p) notFound();
  const [access, names, history] = await Promise.all([
    getProposalAccessAdmin(id),
    userNameMap(),
    db().from("status_history").select("*").eq("entity_type", "proposal").eq("entity_id", id).order("changed_at").then((r) => r.data ?? []),
  ]);
  const client = p.clients as unknown as { id: string; name: string; company_name: string | null } | null;
  const deal = p.deals as unknown as { id: string; name: string; deal_number: string } | null;
  const schedule = (p.payment_schedule as unknown as { label: string; percent: string | number; amount: string | number }[]) ?? [];
  const canUpdate = can(bos, "proposals.update") && (await canAccessEntity(bos, "proposal", id, "update"));

  const milestones: { label: string; at: string | null }[] = [
    { label: "أُنشئ", at: p.created_at },
    { label: "مراجعة داخلية", at: history.find((h) => h.to_status === "ready")?.changed_at ?? null },
    { label: "أُرسل", at: p.sent_at },
    { label: "شوهد", at: p.first_viewed_at },
    { label: p.status === "rejected" ? "رُفض" : "قُبل", at: p.status === "rejected" ? p.rejected_at : p.accepted_at },
    { label: "انتهاء الصلاحية", at: p.expired_at ?? (p.valid_until ? `${p.valid_until}T00:00:00Z` : null) },
  ];

  return (
    <>
      <PageHeader
        title={p.title}
        subtitle={
          <span className="bos-row" style={{ gap: 8 }}>
            <StatusBadge map="proposal_status" value={p.status} />
            <span>v{p.version}</span>
            {p.is_archived ? <StatusBadge tone="neutral" label="مؤرشف" /> : null}
          </span>
        }
       
        actions={
          canUpdate ? (
            <Link href={`/admin/sales/proposals/${id}/edit`} className="admin-btn small">
              <Tx>فتح المنشئ</Tx>
            </Link>
          ) : null
        }
      />
      <Summary
        items={[
          { label: "الحساب", value: client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : "—" },
          { label: "الصفقة", value: deal ? <Link href={`/admin/sales/deals/${deal.id}`}>{deal.deal_number}</Link> : "—" },
          { label: "الإجمالي", value: p.total_amount ? <Money value={p.total_amount} currency={p.currency} /> : "—" },
          { label: "صالح حتى", value: formatDate(p.valid_until) },
          { label: "المشاهدات", value: p.view_count },
          { label: "المسؤول", value: p.owner_id ? names.get(p.owner_id) : "—" },
        ]}
      />
      <Tabs tabs={tabs.map((t) => (t.key === "history" ? { ...t, hidden: !can(bos, "audit.read") } : t))} active={tab} baseHref={`/admin/sales/proposals/${id}`} />

      {tab === "overview" ? (
        <div className="bos-grid main-side">
          <div>
            <Card title="مراحل المقترح">
              <ol className="bos-timeline">
                {milestones.map((m) => (
                  <li key={m.label} className={m.at ? "kind-user" : ""}>
                    <div className="bos-timeline-summary" style={{ color: m.at ? undefined : "rgba(var(--bos-fg-rgb), 0.35)" }}><Tx>{m.label}</Tx></div>
                    <div className="bos-timeline-meta">{m.at ? formatDateTime(m.at) : "—"}</div>
                  </li>
                ))}
              </ol>
              {p.rejection_reason ? <div className="bos-form-error"><Tx vars={{ rejection_reason: p.rejection_reason }}>{"سبب الرفض: {rejection_reason}"}</Tx></div> : null}
            </Card>
            <Card title="جدول الدفعات">
              {schedule.length ? (
                <BosTable className="bos-table responsive">
                  <thead>
                    <tr>
                      <th><Tx>الدفعة</Tx></th>
                      <th><Tx>النسبة</Tx></th>
                      <th><Tx>المبلغ</Tx></th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s, i) => (
                      <tr key={i}>
                        <td className="cell-primary cell-primary-mobile" data-label="الدفعة"><Tx>{s.label}</Tx></td>
                        <td data-label="النسبة">{s.percent}%</td>
                        <td data-label="المبلغ"><Money value={s.amount} currency={p.currency} /></td>
                      </tr>
                    ))}
                  </tbody>
                </BosTable>
              ) : (
                <div className="bos-faint" style={{ fontSize: 13 }}><Tx>لم يُحدد جدول الدفعات.</Tx></div>
              )}
            </Card>
            {p.assumptions ? <Card title="الافتراضات"><div className="bos-prose"><Tx>{p.assumptions}</Tx></div></Card> : null}
            {p.terms ? <Card title="الشروط"><div className="bos-prose"><Tx>{p.terms}</Tx></div></Card> : null}
          </div>
          <div>
            {canUpdate ? (
              <StatusActions
                proposalId={id}
                status={p.status}
                isArchived={p.is_archived}
                publishedAt={p.published_at}
                lastViewedAt={p.last_viewed_at}
                viewCount={p.view_count}
                dealId={p.deal_id}
                validUntil={p.valid_until}
                version={p.version}
              />
            ) : null}
            <Card title="دخول العميل">
              <KeyValues items={[{ label: "بريد الدخول", value: access?.email ?? "لم يُنشأ بعد" }, { label: "آخر دخول", value: access?.last_login_at ? formatDateTime(access.last_login_at) : null }]} />
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "approvals" ? (
        <Card title="المراجعة الداخلية">
          <ApprovalPanel entityType="proposal" entityId={id} bos={bos} />
        </Card>
      ) : null}
      {tab === "notes" ? (
        <Card title="الملاحظات">
          <Comments entityType="proposal" entityId={id} viewerId={bos.userId} />
        </Card>
      ) : null}
      {tab === "files" ? (
        <Card title="الملفات">
          <FileManager entityType="proposal" entityId={id} canUpload={can(bos, "files.create")} />
        </Card>
      ) : null}
      {tab === "timeline" ? (
        <Card title="السجل الزمني">
          <ActivityTimeline entityType="proposal" entityId={id} limit={200} />
        </Card>
      ) : null}
      {tab === "history" && can(bos, "audit.read") ? (
        <Card title="سجل التدقيق">
          <AuditLogPanel entityType="proposal" entityId={id} />
        </Card>
      ) : null}
    </>
  );
}
