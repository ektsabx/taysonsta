import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { eventMap } from "@/lib/bos/event-types";
import { listActiveStaff, listDepartments, listRoles, listTeams } from "@/services/bos/shared";
import { listBranches } from "@/lib/bos/branch";
import { ManualSendButton } from "./ManualSend";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { formatDateTime } from "@/lib/bos/format";
import { MarkAllReadButton, NotificationRow } from "./NotificationRow";

// Notification center page (docs/bos/24).
export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("notifications.read");
  const sp = await readParams(searchParams);
  const view = sp.view ?? "unread";
  const page = pageOf(sp);
  let q = db().from("notifications").select("*", { count: "exact" }).eq("user_id", bos.userId);
  if (view === "unread") q = q.is("read_at", null);
  if (sp.type) q = q.eq("event_type", sp.type);
  if (sp.from) q = q.gte("created_at", `${sp.from}T00:00:00Z`);
  if (sp.to) q = q.lte("created_at", `${sp.to}T23:59:59Z`);
  const [{ data, count }, { data: types }] = await Promise.all([
    q.order("created_at", { ascending: false }).range((page - 1) * 30, page * 30 - 1),
    db().from("notifications").select("event_type").eq("user_id", bos.userId).limit(1000),
  ]);
  const typeOptions = [...new Set((types ?? []).map((t) => t.event_type))].sort().map((t) => ({ value: t, label: eventMap.get(t)?.label ?? (t === "notification.manual" ? "إشعار يدوي" : t) }));
  const canSend = can(bos, "notifications.manage");
  const [staff, teams, departments, branches, roles] = canSend ? await Promise.all([listActiveStaff(), listTeams(), listDepartments(), listBranches(true), listRoles()]) : [[], [], [], [], []];
  const pages = Math.max(1, Math.ceil((count ?? 0) / 30));
  const href = (p: number) => `/admin/communication/notifications?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]), page: String(p) })}`;
  return (
    <>
      <PageHeader title="الإشعارات" subtitle={<Tx vars={{ count: count ?? 0, v: view === "unread" ? "غير مقروء" : "إشعار" }}>{"{count} {v}"}</Tx>} breadcrumbs={[{ label: "التواصل" }, { label: "الإشعارات" }]} actions={<>{canSend ? <ManualSendButton allowAll={bos.isSuperAdmin || can(bos, "notifications.manage", "all")} options={{ users: staff.map((x) => ({ value: x.userId, label: x.name })), team: teams.map((x) => ({ value: x.id, label: x.name })), department: departments.map((x) => ({ value: x.id, label: x.name })), branch: branches.map((x) => ({ value: x.id, label: x.name })), role: roles.filter((r) => !r.is_client_role).map((r) => ({ value: r.id, label: r.name })) }} /> : null}<MarkAllReadButton /><Link className="admin-btn small ghost" href="/admin/profile?tab=notifications"><Tx>تفضيلاتي</Tx></Link></>} />
      <Tabs param="view" active={view} baseHref="/admin/communication/notifications" tabs={[{ key: "unread", label: "غير المقروءة" }, { key: "all", label: "الكل" }]} />
      <FilterBar filters={[{ key: "type", label: "النوع", type: "select", options: typeOptions }, { key: "from", label: "من", type: "date" }, { key: "to", label: "إلى", type: "date" }]} />
      <Card flush>
        {(data ?? []).length ? (data ?? []).map((n) => <NotificationRow key={n.id} n={{ id: n.id, title: n.title, body: n.body, link: n.link, created: formatDateTime(n.created_at), read: !!n.read_at, type: n.event_type }} />) : <EmptyState title={view === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"} />}
      </Card>
      {pages > 1 ? (
        <div className="bos-row" style={{ justifyContent: "center", gap: 8, marginTop: 10 }}>
          {page > 1 ? <Link className="admin-btn small secondary" href={href(page - 1)}><Tx>السابق</Tx></Link> : null}
          <span className="bos-faint" style={{ fontSize: 13 }}>{page} / {pages}</span>
          {page < pages ? <Link className="admin-btn small secondary" href={href(page + 1)}><Tx>التالي</Tx></Link> : null}
        </div>
      ) : null}
    </>
  );
}
