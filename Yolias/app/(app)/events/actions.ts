"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { createPixel } from "@/lib/pixel";
import { testEvents, type TestEvent } from "@/services/events";

// Events Manager actions (D-274): create a pixel, its settings (name, allowed
// and blocked domains; owners and admins), and the live list of test events.
export type EventsResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };

const domainList = (v: string) => [...new Set(String(v ?? "").split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean))];
const validDomain = (d: string) => /^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/.test(d);

export async function createPixelAction(name: string): Promise<EventsResult<{ id: string }>> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.ws.outreach.errors.notFound };
  const n = z.string().trim().min(1).max(80).safeParse(name);
  if (!n.success) return { ok: false, error: t.ag.rx.ev.invalid };
  const { count } = await createAdminClient().from("pixels").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id);
  if ((count ?? 0) >= 20) return { ok: false, error: t.ag.rx.ev.invalid };
  const px = await createPixel(session.workspace.id, n.data, session.userId);
  revalidatePath("/events");
  return { ok: true, id: px.id, message: t.ag.rx.ev.created };
}

export async function savePixelSettings(pixelId: string, input: { name: string; allowed: string; blocked: string }): Promise<EventsResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!canManageTeam(session) || !z.string().uuid().safeParse(pixelId).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const name = z.string().trim().min(1).max(80).safeParse(input.name);
  const allowed = domainList(input.allowed), blocked = domainList(input.blocked);
  if (!name.success || allowed.length > 20 || blocked.length > 20 || ![...allowed, ...blocked].every(validDomain)) return { ok: false, error: t.ag.rx.ev.invalid };
  const { error } = await createAdminClient().from("pixels").update({ name: name.data, allowed_domains: allowed, blocked_domains: blocked }).eq("id", pixelId).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.ag.rx.ev.invalid };
  revalidatePath("/events", "layout");
  return { ok: true, message: t.ag.rx.ev.saved };
}

/** Test events as they arrive (polled by the Test events tab). */
export async function pollTestEvents(pixelId: string, code: string): Promise<TestEvent[]> {
  const session = await requireSession();
  if (!z.string().uuid().safeParse(pixelId).success) return [];
  return testEvents(session.workspace.id, pixelId, code);
}
