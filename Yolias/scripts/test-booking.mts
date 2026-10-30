// Booking page (D-267), against the local Supabase: npm run test:booking
// A guest books a free time: a lead and a meeting appear, the host and the
// guest get one email each (canceled at once: nothing is sent); the same time
// can't be booked twice; the guest's cancel link frees it; the agent's next
// free times come from the same page.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const { ensureBookingPage, slotsFor, slotsByType, book, bookForLead, offerRebooking, cancelMeeting, nextSlots } = await import("@/lib/meetings/index.ts");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
assert.match(url, /127\.0\.0\.1|localhost/, "local database only");
const db = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
let userId = "", ws = "";
try {
  const { data: u, error } = await db.auth.admin.createUser({ email: `host-${Date.now()}@yolias.local`, email_confirm: true });
  if (error) throw error;
  userId = u.user.id;
  ws = (await db.from("profiles").select("workspace_id").eq("id", userId).single()).data!.workspace_id!;
  const page = await ensureBookingPage(userId, ws, "Sara Host", u.user.email!, "Africa/Cairo");
  assert.match(page.slug, /^sara-host/);
  const again = await ensureBookingPage(userId, ws, "Sara Host", u.user.email!, "Africa/Cairo");
  assert.equal(again.slug, page.slug, "one page per member");
  const all = Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, [["09:00", "18:00"]]]));
  await db.from("booking_pages").update({ hours: all as never, min_notice_hours: 1 }).eq("user_id", userId);
  const fresh = (await db.from("booking_pages").select("*").eq("user_id", userId).single()).data!;
  const days = await slotsFor(fresh);
  assert.ok(days.length > 0, "free times");
  const slot = days[0].slots[0];
  const guest = `guest-${Date.now()}@example.com`;

  const r = await book({ slug: page.slug, start: slot, name: "Omar Guest", email: guest, note: "Pricing" });
  assert.ok(r.ok, "booked");
  const { data: m } = await db.from("sales_meetings").select("id, lead_id, status, source, host_id, cancel_token").eq("host_id", userId).single();
  assert.equal(m!.source, "booking");
  const { data: lead } = await db.from("sales_leads").select("email, stage").eq("id", m!.lead_id).single();
  assert.equal(lead!.email, guest);
  assert.equal(lead!.stage, "meeting_booked", "the guest is a lead with a booked meeting");
  const mails = (await db.from("email_log").select("kind, to_email").eq("workspace_id", ws)).data ?? [];
  assert.ok(mails.some((x) => x.kind === "meeting_booked"), "host email");
  assert.ok(mails.some((x) => x.kind === "meeting_guest" && x.to_email === guest), "guest email");
  await db.from("email_log").update({ status: "canceled" }).eq("workspace_id", ws).neq("status", "sent");

  const twice = await book({ slug: page.slug, start: slot, name: "Someone Else", email: `x-${Date.now()}@example.com` });
  assert.deepEqual(twice, { ok: false, error: "taken" }, "no double booking");
  assert.ok(!(await slotsFor(fresh)).flatMap((d) => d.slots).includes(slot), "the time is gone from the page");
  const odd = await book({ slug: page.slug, start: new Date(Date.parse(slot) + 7 * 60_000).toISOString(), name: "Odd", email: `o-${Date.now()}@example.com` });
  assert.deepEqual(odd, { ok: false, error: "taken" }, "only offered times");
  const agent = await nextSlots(userId);
  assert.ok(agent && agent.slots.length === 2 && agent.url.endsWith(`/meet/${page.slug}`), "the agent offers two times and the page");

  assert.ok(await cancelMeeting({ token: m!.cancel_token }, "Moved"), "guest cancels");
  assert.equal((await db.from("sales_meetings").select("status").eq("id", m!.id).single()).data!.status, "canceled");
  assert.ok((await slotsFor(fresh)).flatMap((d) => d.slots).includes(slot), "the time is free again");
  assert.ok(!(await cancelMeeting({ token: m!.cancel_token })), "a used link does nothing");

  // Meeting types (D-269): a 60-minute type has its own times and books its own length.
  await db.from("booking_pages").update({ types: [{ key: "demo", title: "Demo", duration_min: 60, description: null }] as never }).eq("user_id", userId);
  const typed = (await db.from("booking_pages").select("*").eq("user_id", userId).single()).data!;
  const byType = await slotsByType(typed);
  assert.deepEqual(byType.map((x) => x.type.key), ["main", "demo"], "the main type and the extra one");
  const demoSlot = byType[1].days[0].slots.at(-1)!;
  assert.ok((await book({ slug: page.slug, start: demoSlot, name: "Demo Guest", email: `d-${Date.now()}@example.com`, type: "demo" })).ok, "a demo is booked");
  const demo = (await db.from("sales_meetings").select("starts_at, ends_at").eq("host_id", userId).eq("status", "scheduled").order("created_at", { ascending: false }).limit(1).single()).data!;
  assert.equal(Date.parse(demo.ends_at!) - Date.parse(demo.starts_at), 60 * 60_000, "a 60-minute meeting");
  assert.deepEqual(await book({ slug: page.slug, start: demoSlot, name: "X", email: "x@example.com", type: "nope" }), { ok: false, error: "invalid" });

  // A time the lead named in a reply (D-269): booked when free, even off the offered grid.
  const { data: replied } = await db.from("sales_leads").insert({ workspace_id: ws, name: "Reply Lead", lead_key: `test:r-${Date.now()}`, email: `r-${Date.now()}@example.com`, source: "manual" } as never).select("id").single();
  const named = new Date(Date.parse(days.at(-1)!.slots[0]) + 5 * 60_000).toISOString();
  const auto = await bookForLead(userId, replied!.id, named);
  assert.ok(auto.ok, "the named time is booked");
  assert.equal((await db.from("sales_leads").select("stage").eq("id", replied!.id).single()).data!.stage, "meeting_booked");
  assert.deepEqual(await bookForLead(userId, replied!.id, named), { ok: false, error: "taken" }, "not twice");

  // No-show (D-269): the guest gets the booking page once.
  const { data: missed } = await db.from("sales_meetings").select("id").eq("lead_id", replied!.id).single();
  await db.from("sales_meetings").update({ status: "no_show" }).eq("id", missed!.id);
  assert.ok(await offerRebooking(missed!.id), "rebooking offered");
  await offerRebooking(missed!.id);
  const rebook = (await db.from("email_log").select("to_email").eq("workspace_id", ws).eq("kind", "meeting_rebook")).data ?? [];
  assert.equal(rebook.length, 1, "one rebooking email per meeting");
  await db.from("email_log").update({ status: "canceled" }).eq("workspace_id", ws).neq("status", "sent");

  await db.from("booking_pages").update({ enabled: false }).eq("user_id", userId);
  assert.deepEqual(await book({ slug: page.slug, start: slot, name: "Late", email: `l-${Date.now()}@example.com` }), { ok: false, error: "closed" });
  await db.from("email_log").update({ status: "canceled" }).eq("workspace_id", ws).neq("status", "sent");
  console.log("✓ booking page: book, double booking, cancel, types, named time, no-show, closed, agent times");
} finally {
  if (ws) { await db.from("email_log").update({ status: "canceled" }).eq("workspace_id", ws).neq("status", "sent"); await db.from("workspaces").delete().eq("id", ws); }
  if (userId) await db.auth.admin.deleteUser(userId).catch(() => {});
}
