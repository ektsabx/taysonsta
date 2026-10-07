import "server-only";
import { db } from "@/lib/bos/db";
import { nowMs } from "@/lib/bos/clock";
import { scopeUserIds, type BosUser } from "@/lib/bos/auth";
import { myClientIds } from "@/lib/bos/access";
import type { Scope } from "@/lib/bos/permissions";
import { userNameMap } from "@/services/bos/shared";

type Filters = Record<string, string>;
interface Exporter {
  permission: string;
  run: (bos: BosUser, f: Filters) => Promise<{ header: string[]; rows: unknown[][] }>;
}

const MAX = 10000;

async function ownerUsers(bos: BosUser, perm: string) {
  const scope = bos.permissions.get(perm as never) as Scope | undefined;
  return scope ? scopeUserIds(bos, scope) : [bos.userId];
}

export const exporters: Record<string, Exporter> = {
  // Headers match the import field names, so an export can be re-imported
  // in "update matching records" mode (docs/bos/39 §4).
  vendors: {
    permission: "vendors.export",
    async run(_bos, f) {
      let q = db().from("vendors").select("name, type, contact_name, email, phone, services, notes, created_at").is("archived_at", null).order("name").limit(MAX);
      if (f.q) q = q.or(`name.ilike.%${f.q.replace(/[%_,()]/g, " ")}%,email.ilike.%${f.q.replace(/[%_,()]/g, " ")}%`);
      const { data } = await q;
      return { header: ["name", "type", "contact_name", "email", "phone", "services", "notes", "created"], rows: (data ?? []).map((v) => [v.name, v.type, v.contact_name, v.email, v.phone, v.services, v.notes, v.created_at]) };
    },
  },
  assets: {
    permission: "devices.export",
    async run(_bos, f) {
      let q = db().from("devices").select("asset_id, name, type, model, serial_number, purchase_date, warranty_until, purchase_value, currency, quantity, license_seats, location, notes, status").order("asset_id").limit(MAX);
      if (f.status) q = q.eq("status", f.status as never);
      if (f.type) q = q.eq("type", f.type as never);
      const { data } = await q;
      return { header: ["asset_id", "name", "type", "model", "serial_number", "purchase_date", "warranty_until", "purchase_value", "currency", "quantity", "license_seats", "location", "notes", "status"], rows: (data ?? []).map((d) => [d.asset_id, d.name, d.type, d.model, d.serial_number, d.purchase_date, d.warranty_until, d.purchase_value, d.currency, d.quantity, d.license_seats, d.location, d.notes, d.status]) };
    },
  },
  deals: {
    permission: "deals.export",
    async run(bos, f) {
      const users = await ownerUsers(bos, "deals.read");
      let q = db().from("deals").select("deal_number, name, value, currency, probability, expected_close_date, payment_status, won_at, lost_at, lost_reason, created_at, assigned_to, clients(name), pipeline_stages(name)").is("archived_at", null).limit(MAX);
      if (users) q = q.in("assigned_to", users);
      if (f.stage) q = q.eq("stage_id", f.stage);
      const { data } = await q;
      const names = await userNameMap();
      return {
        header: ["Deal #", "Deal", "Account", "Stage", "Value", "Currency", "Probability", "Expected close", "Payment status", "Owner", "Won at", "Lost at", "Lost reason", "Created"],
        rows: (data ?? []).map((d) => [d.deal_number, d.name, (d.clients as unknown as { name: string } | null)?.name, (d.pipeline_stages as unknown as { name: string } | null)?.name, d.value, d.currency, d.probability, d.expected_close_date, d.payment_status, d.assigned_to ? names.get(d.assigned_to) : "", d.won_at, d.lost_at, d.lost_reason, d.created_at]),
      };
    },
  },
  invoices: {
    permission: "invoices.export",
    async run(_bos, f) {
      let q = db().from("bos_invoices").select("invoice_number, issue_date, due_date, status, currency, subtotal, discount_amount, tax_amount, total, amount_paid, amount_refunded, balance, clients(name)").limit(MAX).order("issue_date", { ascending: false });
      if (f.status) q = q.eq("status", f.status as never);
      const { data } = await q;
      return {
        header: ["Invoice #", "Issue date", "Due date", "Status", "Client", "Currency", "Subtotal", "Discount", "Tax", "Total", "Paid", "Refunded", "Balance"],
        rows: (data ?? []).map((i) => [i.invoice_number, i.issue_date, i.due_date, i.status, (i.clients as unknown as { name: string } | null)?.name, i.currency, i.subtotal, i.discount_amount, i.tax_amount, i.total, i.amount_paid, i.amount_refunded, i.balance]),
      };
    },
  },
  payments: {
    permission: "payments.export",
    async run() {
      const { data } = await db().from("bos_payments").select("payment_number, payment_date, amount, currency, method, status, reference, refunded_amount, clients(name), invoices:bos_invoices(invoice_number)").limit(MAX).order("payment_date", { ascending: false });
      return {
        header: ["Payment #", "Date", "Client", "Invoice", "Amount", "Currency", "Method", "Status", "Reference", "Refunded"],
        rows: (data ?? []).map((p) => [p.payment_number, p.payment_date, (p.clients as unknown as { name: string } | null)?.name, (p.invoices as unknown as { invoice_number: string } | null)?.invoice_number, p.amount, p.currency, p.method, p.status, p.reference, p.refunded_amount]),
      };
    },
  },
  expenses: {
    permission: "expenses.export",
    async run() {
      const { data } = await db().from("expenses").select("expense_date, description, amount, currency, approval_status, expense_categories(name), vendors(name)").is("archived_at", null).limit(MAX).order("expense_date", { ascending: false });
      return {
        header: ["Date", "Description", "Category", "Vendor", "Amount", "Currency", "Approval"],
        rows: (data ?? []).map((e) => [e.expense_date, e.description, (e.expense_categories as unknown as { name: string } | null)?.name, (e.vendors as unknown as { name: string } | null)?.name, e.amount, e.currency, e.approval_status]),
      };
    },
  },
  commissions: {
    permission: "commissions.export",
    async run(bos) {
      const users = await ownerUsers(bos, "commissions.read");
      let q = db().from("commissions").select("amount, eligible_amount, currency, status, eligible_at, approved_at, paid_at, payment_reference, user_id, deals(deal_number, name)").limit(MAX);
      if (users) q = q.in("user_id", users);
      const { data } = await q;
      const names = await userNameMap();
      return {
        header: ["Employee", "Deal #", "Deal", "Amount", "Eligible", "Currency", "Status", "Eligible at", "Approved at", "Paid at", "Reference"],
        rows: (data ?? []).map((c) => [names.get(c.user_id), (c.deals as unknown as { deal_number: string } | null)?.deal_number, (c.deals as unknown as { name: string } | null)?.name, c.amount, c.eligible_amount, c.currency, c.status, c.eligible_at, c.approved_at, c.paid_at, c.payment_reference]),
      };
    },
  },
  clients: {
    permission: "clients.export",
    async run(bos, f) {
      const scope = (bos.permissions.get("clients.read") ?? "own") as Scope;
      const ids = await myClientIds(bos, scope);
      let q = db().from("clients").select("name, company_name, email, phone, country, city, industry, account_status, account_manager_id, tax_id, default_currency, created_at").is("archived_at", null).limit(MAX);
      if (ids) q = ids.length ? q.in("id", ids) : q.eq("id", "00000000-0000-0000-0000-000000000000");
      if (f.status) q = q.eq("account_status", f.status as "active");
      const { data } = await q;
      const names = await userNameMap();
      return {
        header: ["Account", "Company", "Email", "Phone", "Country", "City", "Industry", "Status", "Account manager", "Tax ID", "Currency", "Created"],
        rows: (data ?? []).map((c) => [c.name, c.company_name, c.email, c.phone, c.country, c.city, c.industry, c.account_status, c.account_manager_id ? names.get(c.account_manager_id) : "", c.tax_id, c.default_currency, c.created_at]),
      };
    },
  },
  contacts: {
    permission: "contacts.export",
    async run(bos) {
      const scope = (bos.permissions.get("contacts.read") ?? "own") as Scope;
      const ids = await myClientIds(bos, scope);
      let q = db().from("contacts").select("full_name, position, email, phone, whatsapp, is_decision_maker, created_at, clients!contacts_client_id_fkey(name, company_name)").is("archived_at", null).limit(MAX);
      if (ids) q = ids.length ? q.in("client_id", ids) : q.eq("created_by", bos.userId);
      const { data } = await q;
      return {
        header: ["Name", "Position", "Account", "Email", "Phone", "WhatsApp", "Decision maker", "Created"],
        rows: (data ?? []).map((c) => { const a = c.clients as unknown as { name: string; company_name: string | null } | null; return [c.full_name, c.position, a?.company_name ?? a?.name ?? "", c.email, c.phone, c.whatsapp, c.is_decision_maker ? "yes" : "no", c.created_at]; }),
      };
    },
  },
  attendance: {
    permission: "attendance.export",
    async run(bos, f) {
      const users = await ownerUsers(bos, "attendance.read");
      let q = db().from("attendance_records").select("user_id, work_date, status, first_clock_in, last_clock_out, worked_minutes, expected_minutes, overtime_minutes, late_minutes, break_minutes, requires_review").order("work_date", { ascending: false }).limit(MAX);
      if (users) q = q.in("user_id", users);
      if (f.from) q = q.gte("work_date", f.from);
      if (f.to) q = q.lte("work_date", f.to);
      const { data } = await q;
      const names = await userNameMap();
      return {
        header: ["Employee", "Date", "Status", "Clock in", "Clock out", "Worked (min)", "Expected (min)", "Overtime (min)", "Late (min)", "Break (min)", "Needs review"],
        rows: (data ?? []).map((r) => [names.get(r.user_id), r.work_date, r.status, r.first_clock_in, r.last_clock_out, r.worked_minutes, r.expected_minutes, r.overtime_minutes, r.late_minutes, r.break_minutes, r.requires_review]),
      };
    },
  },
  tickets: {
    permission: "tickets.export",
    async run() {
      const { data } = await db().from("tickets").select("ticket_number, subject, category, priority, status, created_at, resolved_at, sla_breached_at, clients(name)").order("created_at", { ascending: false }).limit(MAX);
      return {
        header: ["Ticket #", "Subject", "Client", "Category", "Priority", "Status", "Created", "Resolved", "SLA breached"],
        rows: (data ?? []).map((t) => [t.ticket_number, t.subject, (t.clients as unknown as { name: string } | null)?.name, t.category, t.priority, t.status, t.created_at, t.resolved_at, t.sla_breached_at]),
      };
    },
  },
  employees: {
    permission: "employees.export",
    async run() {
      const { data } = await db().from("employees").select("employee_code, full_name, email, position, lifecycle_status, employment_type, start_date, country, timezone, departments(name)").is("archived_at", null).order("full_name").limit(MAX);
      return {
        header: ["Code", "Name", "Email", "Position", "Department", "Status", "Employment", "Start date", "Country", "Timezone"],
        rows: (data ?? []).map((e) => [e.employee_code, e.full_name, e.email, e.position, (e.departments as unknown as { name: string } | null)?.name, e.lifecycle_status, e.employment_type, e.start_date, e.country, e.timezone]),
      };
    },
  },
  // Report tables (docs/bos/21) — same numbers as the report page.
  report: {
    permission: "reports.export",
    async run(bos, f) {
      const { runReport } = await import("@/services/bos/reports");
      const name = String(f.name ?? "");
      const tables: Record<string, { header: string[]; pick: (d: unknown) => Record<string, unknown>[]; keys: string[] }> = {
        bd: { header: ["BD", "Leads", "Qualified", "Outreach", "Meetings", "Proposals", "Pipeline", "Weighted", "Won", "Won value", "Commission"], keys: ["name", "leads", "qualified", "outreach", "meetings", "proposals", "pipeline", "weighted_pipeline", "won", "won_value", "commission"], pick: (d) => d as Record<string, unknown>[] },
        countries: { header: ["Country", "Leads", "Qualified", "Deals", "Won", "Won revenue", "Conversion %", "Avg deal"], keys: ["country", "leads", "qualified", "deals", "won", "won_revenue", "conversion", "avg_deal_value"], pick: (d) => d as Record<string, unknown>[] },
        team: { header: ["Employee", "Department", "Present days", "Late days", "Absent days", "Leave days", "Worked h", "Capacity h", "Overtime min"], keys: ["name", "department", "present_days", "late_days", "absent_days", "leave_days", "worked_hours", "capacity_hours", "overtime_minutes"], pick: (d) => d as Record<string, unknown>[] },
        clients: { header: ["Client", "Country", "Revenue", "Upsells", "Open upsell value"], keys: ["name", "country", "revenue", "upsells", "open_upsell_value"], pick: (d) => ((d as { clients?: Record<string, unknown>[] }).clients ?? []) },
        sales: { header: ["Month", "Leads", "Won", "Revenue"], keys: ["month", "leads", "won", "revenue"], pick: (d) => ((d as { trend?: Record<string, unknown>[] }).trend ?? []) },
        revenue: { header: ["Month", "Invoiced", "Collected", "Expenses"], keys: ["month", "invoiced", "collected", "expenses"], pick: (d) => ((d as { trend?: Record<string, unknown>[] }).trend ?? []) },
      };
      const t = tables[name];
      if (!t) return { header: ["error"], rows: [["unknown report"]] };
      const sensitive = ["revenue", "cost", "profit", "margin", "won_value", "won_revenue", "commission", "pipeline", "weighted_pipeline", "avg_deal_value", "open_upsell_value", "invoiced", "collected", "expenses"];
      const canMoney = bos.permissions.has("revenue.view_sensitive" as never);
      const { data } = await runReport(bos, name as "sales", f);
      const keys = t.keys.map((k) => (sensitive.includes(k) && !canMoney ? null : k));
      return { header: t.header.filter((_, i) => keys[i]), rows: t.pick(data).map((r) => keys.filter(Boolean).map((k) => r[k as string])) };
    },
  },
  // HR reports (docs/bos/28 §28) — same registry as /admin/reports/hr.
  hr_report: {
    permission: "reports.export",
    async run(bos, f) {
      const { runHrReport } = await import("@/services/bos/hr/reports");
      const today = new Date(nowMs()).toISOString().slice(0, 10);
      const r = await runHrReport(bos, String(f.r ?? ""), { from: String(f.from || `${today.slice(0, 7)}-01`), to: String(f.to || today), department: f.department ? String(f.department) : undefined, employee: f.employee ? String(f.employee) : undefined });
      if (!r) return { header: ["error"], rows: [["report not available"]] };
      return { header: r.def.columns.map((c) => c.label), rows: r.rows.map((row) => r.def.columns.map((c) => row[c.key] as unknown)) };
    },
  },
  audit: {
    permission: "audit.export",
    async run(_bos, f) {
      let q = db().from("audit_logs").select("created_at, actor_user_id, actor_type, action, entity_type, entity_id, old_value, new_value, reason, ip").order("created_at", { ascending: false }).limit(MAX);
      if (f.action) q = q.ilike("action", `%${f.action}%`);
      if (f.entity_type) q = q.eq("entity_type", f.entity_type);
      if (f.from) q = q.gte("created_at", `${f.from}T00:00:00Z`);
      if (f.to) q = q.lte("created_at", `${f.to}T23:59:59Z`);
      const { data } = await q;
      const names = await userNameMap();
      return {
        header: ["Time", "User", "Actor type", "Action", "Entity", "Entity ID", "Old value", "New value", "Reason", "IP"],
        rows: (data ?? []).map((a) => [a.created_at, a.actor_user_id ? names.get(a.actor_user_id) : "", a.actor_type, a.action, a.entity_type, a.entity_id, JSON.stringify(a.old_value ?? ""), JSON.stringify(a.new_value ?? ""), a.reason, a.ip]),
      };
    },
  },
};
