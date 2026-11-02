"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { canManageTeam, requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary } from "@/lib/i18n/server";
import { ensurePixel } from "@/lib/pixel";

// Events Manager settings (D-274): the pixel's name and the domains it accepts events from (owners and admins).
export type EventsResult = { ok: true; message?: string } | { ok: false; error: string };

export async function savePixelSettings(input: { name: string; domains: string }): Promise<EventsResult> {
  const session = await requireSession();
  const t = await getDictionary();
  if (!canManageTeam(session)) return { ok: false, error: t.ws.outreach.errors.notFound };
  const name = z.string().trim().min(1).max(80).safeParse(input.name);
  const domains = String(input.domains ?? "").split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean);
  if (!name.success || domains.length > 20 || domains.some((d) => !/^(\*\.)?[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) return { ok: false, error: t.ag.rx.ev.invalid };
  const px = await ensurePixel(session.workspace.id);
  await createAdminClient().from("pixels").update({ name: name.data, allowed_domains: [...new Set(domains)] }).eq("id", px.id);
  revalidatePath("/events");
  return { ok: true, message: t.ag.rx.ev.saved };
}
