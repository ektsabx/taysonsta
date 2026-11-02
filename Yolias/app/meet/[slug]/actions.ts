"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { book, recordProgress, recordVisit, visitBooked, type BookError } from "@/lib/meetings";

// A visitor books a time on a member's page (D-267). No account: a hidden
// field catches bots, and one email can hold at most three bookings a day.
export async function bookAction(input: { slug: string; start: string; name: string; email: string; note: string; website: string; type: string; visitId?: string | null; visitor?: string | null }): Promise<{ ok: true; start: string; url: string | null; location: string | null } | { ok: false; error: BookError | "busy" }> {
  if (input.website) return { ok: false, error: "invalid" };
  const email = String(input.email ?? "").trim().toLowerCase();
  const { count } = await createAdminClient().from("sales_meetings").select("id", { count: "exact", head: true }).eq("guest_email", email).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 3) return { ok: false, error: "busy" };
  try {
    const r = await book({ slug: String(input.slug), start: String(input.start), name: String(input.name ?? ""), email, note: String(input.note ?? ""), type: String(input.type ?? "main") });
    if (r.ok) await visitBooked(input.visitId, input.visitor, r.meetingId).catch((e) => console.error("[meet] visit", e));
    return r.ok ? { ok: true, start: r.start, url: r.url, location: r.location } : r;
  } catch (e) {
    console.error("[meet] booking failed", e);
    return { ok: false, error: "invalid" };
  }
}

/** D-274: the page loaded in a browser (one visit per visitor per day); a campaign link carries its lead. */
export async function visitAction(input: { slug: string; visitor: string; lead: string | null }): Promise<string | null> {
  try {
    // The page's own team opening it (to check or share it) isn't a visit.
    const { data: { user } } = await (await createClient()).auth.getUser();
    if (user) {
      const admin = createAdminClient();
      const { data: page } = await admin.from("booking_pages").select("workspace_id").eq("slug", String(input.slug)).maybeSingle();
      if (page) {
        const { data: member } = await admin.from("workspace_members").select("user_id").eq("workspace_id", page.workspace_id).eq("user_id", user.id).maybeSingle();
        if (member) return null;
      }
    }
    return await recordVisit(String(input.slug), String(input.visitor), input.lead ? String(input.lead) : null);
  } catch (e) {
    console.error("[meet] visit", e);
    return null;
  }
}

/** D-274: what the visitor typed so far (name, email), kept like an abandoned checkout until they book. */
export async function progressAction(input: { visitId: string; visitor: string; name: string; email: string }): Promise<void> {
  await recordProgress(String(input.visitId), String(input.visitor), { name: String(input.name ?? ""), email: String(input.email ?? "") }).catch((e) => console.error("[meet] progress", e));
}
