"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { book, type BookError } from "@/lib/meetings";

// A visitor books a time on a member's page (D-267). No account: a hidden
// field catches bots, and one email can hold at most three bookings a day.
export async function bookAction(input: { slug: string; start: string; name: string; email: string; note: string; website: string; type: string }): Promise<{ ok: true; start: string; url: string | null; location: string | null } | { ok: false; error: BookError | "busy" }> {
  if (input.website) return { ok: false, error: "invalid" };
  const email = String(input.email ?? "").trim().toLowerCase();
  const { count } = await createAdminClient().from("sales_meetings").select("id", { count: "exact", head: true }).eq("guest_email", email).gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
  if ((count ?? 0) >= 3) return { ok: false, error: "busy" };
  try {
    const r = await book({ slug: String(input.slug), start: String(input.start), name: String(input.name ?? ""), email, note: String(input.note ?? ""), type: String(input.type ?? "main") });
    return r.ok ? { ok: true, start: r.start, url: r.url, location: r.location } : r;
  } catch (e) {
    console.error("[meet] booking failed", e);
    return { ok: false, error: "invalid" };
  }
}
