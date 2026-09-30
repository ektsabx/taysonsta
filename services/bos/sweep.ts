import { nowMs } from "@/lib/bos/clock";
import "server-only";
import { db } from "@/lib/bos/db";
import { dispatchPendingEvents, emitEvent } from "@/lib/bos/events";
import { getSetting } from "@/lib/bos/settings";
import { logServerError } from "@/lib/bos/errors";
import { todayIn, addDays } from "@/lib/bos/format";

// Scheduled sweep (docs/bos/01 §6, 20): every periodic check in one
// idempotent pass. Safe to run every 5–15 minutes (cron) or manually from
// Automation → Logs. Each step is isolated so one failure never blocks others.

export interface SweepResult {
  step: string;
  count: number | null;
  error?: string;
}

async function step(results: SweepResult[], name: string, fn: () => Promise<number | null | void>) {
  try {
    const n = await fn();
    results.push({ step: name, count: typeof n === "number" ? n : null });
  } catch (error) {
    logServerError(`sweep:${name}`, error);
    results.push({ step: name, count: null, error: error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error) });
  }
}

async function rpcCount(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await db().rpc(fn as "bos_mark_overdue_invoices", args as never);
  if (error) throw error;
  return Number(data ?? 0);
}

export async function runScheduledSweep(opts: { actor?: string | null } = {}): Promise<SweepResult[]> {
  const results: SweepResult[] = [];
  const c = db();
  const company = (await getSetting("company")) as { timezone?: string };
  const tz = company.timezone ?? "Africa/Cairo";
  const today = todayIn(tz);
  const now = new Date(nowMs());

  await step(results, "overdue_work", () => rpcCount("bos_mark_overdue_work", { p_today: today }));
  await step(results, "overdue_invoices", () => rpcCount("bos_mark_overdue_invoices"));
  await step(results, "sla_breaches", () => rpcCount("bos_check_sla_breaches"));
  await step(results, "open_attendance_sessions", () => rpcCount("bos_detect_open_sessions"));
  await step(results, "absences_yesterday", () => rpcCount("bos_mark_absences", { p_date: addDays(today, -1) }));
  await step(results, "project_health", () => rpcCount("bos_recompute_all_project_health"));

  // Follow-up / activity reminders (activity.reminder_due).
  await step(results, "activity_reminders", async () => {
    const { data } = await c.from("activities").select("id, title, assigned_to, lead_id, deal_id, client_id").lte("reminder_at", now.toISOString()).is("reminder_sent_at", null).in("status", ["pending", "in_progress", "overdue"]).is("archived_at", null).limit(500);
    for (const a of data ?? []) {
      await c.from("activities").update({ reminder_sent_at: now.toISOString() }).eq("id", a.id);
      await emitEvent({ type: "activity.reminder_due", entityType: "activity", entityId: a.id, summary: `Follow-up due: ${a.title}`, actorType: "system", payload: { assignee_user_id: a.assigned_to, deal_id: a.deal_id, lead_id: a.lead_id, client_id: a.client_id }, dedupeKey: `activity.reminder_due:${a.id}` });
    }
    return (data ?? []).length;
  });

  // Meeting reminders (meeting.upcoming) N minutes before start.
  await step(results, "meeting_reminders", async () => {
    const minutes = ((await getSetting("notifications")) as { meeting_reminder_minutes?: number }).meeting_reminder_minutes ?? 30;
    const until = new Date(now.getTime() + minutes * 60_000).toISOString();
    const { data } = await c.from("meetings").select("id, title, start_at, organizer_id, project_id, client_id").eq("status", "scheduled").gte("start_at", now.toISOString()).lte("start_at", until).is("reminder_sent_at", null).limit(200);
    for (const m of data ?? []) {
      await c.from("meetings").update({ reminder_sent_at: now.toISOString() }).eq("id", m.id);
      const { data: att } = await c.from("meeting_attendees").select("user_id").eq("meeting_id", m.id).not("user_id", "is", null);
      const users = new Set([m.organizer_id, ...(att ?? []).map((a) => a.user_id)].filter(Boolean) as string[]);
      for (const u of users) {
        await emitEvent({ type: "meeting.upcoming", entityType: "meeting", entityId: m.id, summary: `Meeting at ${new Date(m.start_at).toISOString().slice(11, 16)} UTC: ${m.title}`, actorType: "system", payload: { assignee_user_id: u, project_id: m.project_id, client_id: m.client_id }, dedupeKey: `meeting.upcoming:${m.id}:${u}` });
      }
    }
    return (data ?? []).length;
  });

  // Attendance reminder: work day, not clocked in by start + grace + reminder_after_minutes.
  await step(results, "attendance_reminders", async () => {
    const policy = (await getSetting("attendance_policy")) as { reminder_after_minutes?: number };
    const after = policy.reminder_after_minutes ?? 30;
    const { data: emps } = await c.from("employees").select("id, user_id, timezone, work_schedule_id, full_name").not("user_id", "is", null).in("lifecycle_status", ["active", "onboarding"]).is("archived_at", null);
    const { data: schedules } = await c.from("work_schedules").select("*");
    const def = (schedules ?? []).find((s) => s.is_default);
    let n = 0;
    for (const e of emps ?? []) {
      const s = (schedules ?? []).find((x) => x.id === e.work_schedule_id) ?? def;
      if (!s) continue;
      const localDate = todayIn(s.timezone);
      const dow = new Date(`${localDate}T00:00:00Z`).getUTCDay();
      if (!s.work_days.includes(dow)) continue;
      const localNow = new Intl.DateTimeFormat("en-GB", { timeZone: s.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const [h, mi] = localNow.split(":").map(Number);
      const [sh, sm] = s.start_time.split(":").map(Number);
      const endH = Number(s.end_time.split(":")[0]);
      const minsNow = h * 60 + mi;
      if (minsNow < sh * 60 + sm + s.grace_minutes + after || h >= endH) continue;
      const { data: rec } = await c.from("attendance_records").select("id, status").eq("user_id", e.user_id as string).eq("work_date", localDate).maybeSingle();
      if (rec) continue; // clocked in, on leave or holiday already recorded
      const { data: holiday } = await c.from("holidays").select("id").eq("date", localDate).limit(1);
      if (holiday?.length) continue;
      const { data: leave } = await c.from("leave_requests").select("id").eq("user_id", e.user_id as string).eq("status", "approved").lte("start_date", localDate).gte("end_date", localDate).limit(1);
      if (leave?.length) continue;
      await emitEvent({ type: "attendance.reminder", entityType: "employee", entityId: e.id, summary: "You have not started work yet today — press START WORK when you begin.", actorType: "system", payload: { employee_user_id: e.user_id }, dedupeKey: `attendance.reminder:${e.id}:${localDate}` });
      n++;
    }
    return n;
  });

  // Access grants past expires_at → expired.
  await step(results, "access_expiry", async () => {
    const { expireGrants } = await import("@/services/bos/it-access");
    return expireGrants();
  });

  // MFA required but not enabled 3 days after account creation.
  await step(results, "mfa_reminders", async () => {
    const security = (await getSetting("security")) as { require_2fa_role_keys?: string[] };
    const keys = security.require_2fa_role_keys ?? [];
    if (!keys.length) return 0;
    const { data: roles } = await c.from("roles").select("id").in("key", keys);
    const { data: ur } = await c.from("user_roles").select("user_id").in("role_id", (roles ?? []).map((r) => r.id));
    const users = [...new Set((ur ?? []).map((u) => u.user_id))];
    if (!users.length) return 0;
    const cutoff = new Date(now.getTime() - 3 * 86400_000).toISOString();
    const { data: emps } = await c.from("employees").select("id, user_id").in("user_id", users).neq("mfa_status", "enabled").lt("created_at", cutoff).is("archived_at", null);
    const week = `${today.slice(0, 8)}${String(Math.floor(Number(today.slice(8)) / 7))}`;
    for (const e of emps ?? []) await emitEvent({ type: "security.mfa_required", entityType: "employee", entityId: e.id, summary: "Two-factor authentication is required for your role — enable it from your profile.", actorType: "system", payload: { employee_user_id: e.user_id }, dedupeKey: `security.mfa_required:${e.id}:${week}` });
    return (emps ?? []).length;
  });

  // Device security check older than 90 days → IT reminder.
  await step(results, "device_security_checks", async () => {
    const cutoff = new Date(now.getTime() - 90 * 86400_000).toISOString();
    const { data } = await c.from("devices").select("id, asset_id").eq("status", "assigned").not("type", "in", "(monitor,headset)").or(`last_security_check_at.is.null,last_security_check_at.lt.${cutoff}`);
    for (const d of data ?? []) await emitEvent({ type: "device.security_check_due", entityType: "device", entityId: d.id, summary: `Security check due for ${d.asset_id}`, actorType: "system", dedupeKey: `device.security_check_due:${d.id}:${today.slice(0, 7)}` });
    return (data ?? []).length;
  });

  // Onboarding checklists past due → responsible people notified.
  await step(results, "onboarding_overdue", async () => {
    const { data } = await c.from("onboarding_checklists").select("id, subject, client_id, employee_id, due_date, template_key").eq("status", "in_progress").lt("due_date", today);
    for (const o of data ?? []) {
      await emitEvent({ type: "onboarding.overdue", entityType: o.subject === "client" ? "client" : "employee", entityId: (o.client_id ?? o.employee_id) as string, summary: `${o.template_key.replace(/_/g, " ")} overdue since ${o.due_date}`, actorType: "system", payload: { checklist_id: o.id }, dedupeKey: `onboarding.overdue:${o.id}:${today}` });
    }
    return (data ?? []).length;
  });

  // Leads owned by inactive employees.
  await step(results, "orphaned_leads", async () => {
    const { data: inactive } = await c.from("employees").select("user_id").in("lifecycle_status", ["suspended", "offboarding", "archived"]).not("user_id", "is", null);
    const ids = (inactive ?? []).map((e) => e.user_id as string);
    if (!ids.length) return 0;
    const { data } = await c.from("leads").select("id, name, assigned_to").in("assigned_to", ids).is("archived_at", null).is("converted_deal_id", null).limit(200);
    for (const l of data ?? []) await emitEvent({ type: "lead.unassigned_owner_inactive", entityType: "lead", entityId: l.id, summary: `Lead ${l.name} is owned by an inactive employee — reassign`, actorType: "system", payload: { previous_assignee_user_id: l.assigned_to }, dedupeKey: `lead.owner_inactive:${l.id}:${today}` });
    return (data ?? []).length;
  });

  await step(results, "auto_close_resolved_tickets", async () => {
    const { autoCloseResolved } = await import("@/services/bos/support");
    return autoCloseResolved(7);
  });

  // KPI values for the current periods (daily snapshot).
  await step(results, "kpi_values", async () => {
    const { data: last } = await c.from("kpi_values").select("computed_at").order("computed_at", { ascending: false }).limit(1).maybeSingle();
    if (last && last.computed_at.slice(0, 10) === now.toISOString().slice(0, 10)) return 0;
    const { computeAllKpis } = await import("@/services/bos/kpis");
    return computeAllKpis(today);
  });

  // Delivery queue (docs/bos/30 §9): email through the hub with retry and
  // backoff; channels without a provider are marked skipped with the reason.
  await step(results, "notification_deliveries", async () => {
    const { processDeliveries } = await import("@/services/bos/notification-delivery");
    const r = await processDeliveries(300);
    return r.sent + r.failed + r.skipped;
  });

  // Social: scheduled posts that are due + safe retries; metrics refresh (docs/bos/30 §12).
  await step(results, "social_publish_due", async () => {
    const { publishDue } = await import("@/services/bos/social");
    return publishDue(20);
  });
  await step(results, "social_metrics", async () => {
    const { syncSocialMetrics } = await import("@/services/bos/social");
    return syncSocialMetrics(40);
  });

  // Location points past the retention period (docs/bos/30 §28).
  await step(results, "location_retention", async () => {
    const { purgeLocations } = await import("@/services/bos/location");
    return purgeLocations();
  });

  // Assets: expiring warranties/licences, maintenance due, low stock (docs/bos/30 §21).
  await step(results, "asset_alerts", async () => {
    const { assetAlerts } = await import("@/services/bos/assets");
    return assetAlerts();
  });

  // E-signature status fallback (webhooks unreachable) + signed-copy download retry (docs/bos/30 §19).
  await step(results, "esign_poll", async () => {
    const { pollSignatureRequests } = await import("@/services/bos/esign");
    return pollSignatureRequests(20);
  });

  // Deal Radar alerts to deal owners, once a day per deal (docs/bos/30 §17, §20).
  await step(results, "deal_radar_alerts", async () => {
    const { radarAlerts } = await import("@/services/bos/deal-radar");
    return radarAlerts();
  });

  // Ads: read-only sync of API ad accounts every 6 h (docs/bos/30 §14).
  await step(results, "ads_sync", async () => {
    const { syncDueAdAccounts } = await import("@/services/bos/ads");
    return syncDueAdAccounts(10);
  });

  // WhatsApp/SMS sends that failed with a retryable error (docs/bos/30 §11).
  await step(results, "outbound_messages_retry", async () => {
    const { processOutbound } = await import("@/services/bos/messaging");
    return processOutbound(100);
  });

  // Approvals past their due date: reminder to the approver, escalation to
  // their manager after the configured delay (docs/bos/30 §18).
  await step(results, "approval_reminders", async () => {
    const { remindOverdueApprovals } = await import("@/services/bos/approvals");
    return remindOverdueApprovals();
  });

  // Abandoned uploads (never finalized) older than 24h: remove row + object.
  await step(results, "abandoned_uploads", async () => {
    const cutoff = new Date(now.getTime() - 24 * 3600_000).toISOString();
    const { data } = await c.from("files").select("id, storage_path").eq("is_finalized", false).lt("created_at", cutoff).limit(500);
    if (!data?.length) return 0;
    await c.storage.from("bos-files").remove(data.map((f) => f.storage_path));
    await c.from("files").delete().in("id", data.map((f) => f.id));
    return data.length;
  });

  // HR & Workforce (docs/bos/28 §8, §10, §22): expiring documents and
  // contracts, expired job offers, probation end reminders.
  await step(results, "hr_document_contract_expiry", async () => {
    const { runHrExpirySweep } = await import("@/services/bos/hr/documents");
    const r = await runHrExpirySweep(today);
    return r.documents + r.contracts;
  });
  await step(results, "job_offer_expiry", async () => {
    const { expireOffers } = await import("@/services/bos/hr/recruitment");
    return expireOffers(today);
  });
  await step(results, "probation_ending", async () => {
    const soon = addDays(today, 14);
    const { data } = await c.from("employees").select("id, user_id, full_name, manager_id, probation_end_date").eq("probation_status", "in_probation").gte("probation_end_date", today).lte("probation_end_date", soon);
    for (const e of data ?? []) {
      const { data: mgr } = e.manager_id ? await c.from("employees").select("user_id").eq("id", e.manager_id).maybeSingle() : { data: null };
      await emitEvent({ type: "employee.probation_ending", entityType: "employee", entityId: e.id, summary: `Probation of ${e.full_name} ends on ${e.probation_end_date}`, payload: { employee_user_id: e.user_id, assignee_user_id: mgr?.user_id ?? null }, dedupeKey: `employee.probation_ending:${e.id}:${e.probation_end_date}` });
    }
    return data?.length ?? 0;
  });

  await step(results, "dispatch_events", () => dispatchPendingEvents());

  await c.from("audit_logs").insert({ actor_user_id: opts.actor ?? null, actor_type: opts.actor ? "user" : "system", action: "system.sweep", entity_type: "system", entity_id: null, new_value: results as never });
  return results;
}
