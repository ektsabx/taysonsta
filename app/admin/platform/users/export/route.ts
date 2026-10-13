import { NextResponse, type NextRequest } from "next/server";
import { getBosSession, can } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { csvEscape } from "@/services/bos/leads";
import { accountViews, listAccounts, type AccountView } from "@/services/yolias/accounts";

// CSV of the Users list with the same filters (D-214). platform.manage (all)
// only; audited. No secrets or payment details beyond totals.
export async function GET(request: NextRequest) {
  const session = await getBosSession();
  if (session.status !== "ok") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.bos, "platform.manage", "all")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const view = (accountViews as string[]).includes(sp.view) ? (sp.view as AccountView) : "all";
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const r = await listAccounts(view, sp, page, 200);
    rows.push(...r.rows);
    if (page >= r.pages) break;
  }
  const header = ["User ID", "Name", "Email", "Phone", "Country", "Signed up", "Account status", "Email confirmed", "Plan", "Period", "Subscription status",
    "Trial started", "Trial ends", "Period ends", "Auto-renew", "Provider", "Paid total (USD)", "Refunded (USD)", "Payments", "Renewals", "First payment",
    "Last payment attempt", "Last payment status", "Last activity", "Source", "Journey segment"];
  const data = rows.map((r) => [r.id, r.full_name, r.email, r.phone, r.country, r.created_at, r.account_status, r.email_confirmed ? "yes" : "no", r.plan, r.billing_period,
    r.subscription_status, r.trial_started_at, r.trial_ends_at, r.current_period_end, r.subscription_status === "active" ? (r.cancel_at_period_end ? "off" : "on") : "",
    r.billing_provider, r.paid_total, r.refunded_total, r.paid_count, r.renewals, r.first_paid_at, r.last_payment_at, r.last_payment_status, r.last_activity_at,
    r.acquisition_source, r.segment]);
  await audit({ actorId: session.bos.userId, action: "data.exported", entityType: "yolias_users", entityId: null, metadata: { filters: sp, rows: data.length } });
  const csv = "﻿" + [header, ...data].map((r) => r.map(csvEscape).join(",")).join("\r\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="yolias-users-${view}-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
