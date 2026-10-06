"use server";

import { createClient } from "@/lib/supabase/server";
import { requireSession } from "@/lib/session";
import type { NotificationRow } from "@/types/database";

// In-app notifications (final spec phase 9): the member's own, via RLS.

export async function listNotifications(): Promise<Pick<NotificationRow, "id" | "kind" | "title" | "link" | "read_at" | "created_at">[]> {
  const session = await requireSession();
  const db = await createClient();
  const { data } = await db.from("notifications").select("id, kind, title, link, read_at, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(30);
  return data ?? [];
}

export async function markRead(ids: number[] | "all"): Promise<{ ok: boolean }> {
  const session = await requireSession();
  const db = await createClient();
  let q = db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", session.userId).is("read_at", null);
  if (ids !== "all") q = q.in("id", ids.filter((i) => Number.isInteger(i)).slice(0, 100));
  const { error } = await q;
  return { ok: !error };
}
