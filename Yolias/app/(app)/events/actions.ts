"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireMember, canEdit, viewOnly } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/config";
import { createPixel } from "@/lib/pixel";
import { testEvents, type TestEvent } from "@/services/events";

// Events Manager actions (D-274, D-275): create, edit and delete a pixel, its
// settings (name, website, allowed and blocked domains; owners and admins),
// and the live list of test events.
export type EventsResult<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };

const domainList = (v: string) => [...new Set(String(v ?? "").split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean))];
const validDomain = (d: string) => /^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/.test(d);

/** A pixel's website, as typed: "example.com" or a full URL; "" = none. null when it isn't a website. */
function websiteOf(v: string): string | null | undefined {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!/^https?:$/.test(u.protocol) || !validDomain(u.hostname.toLowerCase()) || raw.length > 300) return undefined;
    return u.origin + (u.pathname === "/" ? "" : u.pathname);
  } catch { return undefined; }
}

/** Create a pixel from the "Create a pixel" window: its name and (optional) website, like Facebook's and TikTok's. */
export async function createPixelAction(input: { name: string; website: string }): Promise<EventsResult<{ id: string }>> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.ws.outreach.errors.notFound };
  const n = z.string().trim().min(1).max(80).safeParse(input.name);
  const website = websiteOf(input.website);
  if (!n.success) return { ok: false, error: t.ag.rx.ev.invalidName };
  if (website === undefined) return { ok: false, error: t.ag.rx.ev.invalidSite };
  const { count } = await createAdminClient().from("pixels").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id);
  if ((count ?? 0) >= 20) return { ok: false, error: t.ag.rx.ev.tooMany };
  const px = await createPixel(session.workspace.id, n.data, session.userId, website);
  revalidatePath("/events");
  return { ok: true, id: px.id, message: t.ag.rx.ev.created };
}

/** Edit a pixel's name and website (the card's ⋯ menu and the pixel page's title). */
export async function editPixelAction(pixelId: string, input: { name: string; website?: string }): Promise<EventsResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!canManageTeam(session) || !z.string().uuid().safeParse(pixelId).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const n = z.string().trim().min(1).max(80).safeParse(input.name);
  if (!n.success) return { ok: false, error: t.ag.rx.ev.invalidName };
  const patch: { name: string; website_url?: string | null } = { name: n.data };
  if (input.website !== undefined) {
    const website = websiteOf(input.website);
    if (website === undefined) return { ok: false, error: t.ag.rx.ev.invalidSite };
    patch.website_url = website;
  }
  const { error } = await createAdminClient().from("pixels").update(patch).eq("id", pixelId).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.ag.rx.ev.invalid };
  revalidatePath("/events", "layout");
  return { ok: true, message: t.ag.rx.ev.saved };
}

/**
 * Delete a pixel with its events. Not while a campaign measures with it (its
 * results would be lost), and not the last one (website campaigns need a pixel).
 */
export async function deletePixelAction(pixelId: string): Promise<EventsResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!canManageTeam(session) || !z.string().uuid().safeParse(pixelId).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const db = createAdminClient();
  const [{ count: pixels }, { data: used }] = await Promise.all([
    db.from("pixels").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspace.id),
    db.from("outreach_campaigns").select("name").eq("workspace_id", session.workspace.id).eq("pixel_id", pixelId).limit(3),
  ]);
  if ((pixels ?? 0) <= 1) return { ok: false, error: t.ag.rx.ev.lastPixel };
  if (used?.length) return { ok: false, error: fmt(t.ag.rx.ev.inUse, { names: used.map((c) => c.name).join((await getLocale()) === "ar" ? "، " : ", ") }) };
  const { error } = await db.from("pixels").delete().eq("id", pixelId).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.ag.rx.ev.invalid };
  revalidatePath("/events", "layout");
  return { ok: true, message: t.ag.rx.ev.deleted };
}

export async function savePixelSettings(pixelId: string, input: { name: string; website: string; allowed: string; blocked: string }): Promise<EventsResult> {
  const session = await requireMember();
  if (!canEdit(session)) return await viewOnly() as never;
  const t = await getDictionary();
  if (!canManageTeam(session) || !z.string().uuid().safeParse(pixelId).success) return { ok: false, error: t.ws.outreach.errors.notFound };
  const name = z.string().trim().min(1).max(80).safeParse(input.name);
  const allowed = domainList(input.allowed), blocked = domainList(input.blocked);
  const website = websiteOf(input.website);
  if (website === undefined) return { ok: false, error: t.ag.rx.ev.invalidSite };
  if (!name.success || allowed.length > 20 || blocked.length > 20 || ![...allowed, ...blocked].every(validDomain)) return { ok: false, error: t.ag.rx.ev.invalid };
  const { error } = await createAdminClient().from("pixels").update({ name: name.data, website_url: website, allowed_domains: allowed, blocked_domains: blocked }).eq("id", pixelId).eq("workspace_id", session.workspace.id);
  if (error) return { ok: false, error: t.ag.rx.ev.invalid };
  revalidatePath("/events", "layout");
  return { ok: true, message: t.ag.rx.ev.saved };
}

/** Test events as they arrive (polled by the Test events tab). */
export async function pollTestEvents(pixelId: string, code: string): Promise<TestEvent[]> {
  const session = await requireMember();
  if (!z.string().uuid().safeParse(pixelId).success) return [];
  return testEvents(session.workspace.id, pixelId, code);
}
