import "server-only";
import { db, type Tables } from "@/lib/bos/db";
import { can, type BosUser } from "@/lib/bos/auth";
import { audit } from "@/lib/bos/audit";
import { ForbiddenError, ValidationError } from "@/lib/bos/errors";
import { normalizePhone } from "@/lib/bos/messaging-utils";

// Click-to-WhatsApp website button (docs/bos/30 §11). It only opens
// wa.me/<number> with a prefilled greeting in the visitor's WhatsApp — the
// chat then happens in WhatsApp (or in the inbox, when the number is the
// connected WhatsApp Business API number). Clicks are counted per day from
// the allowed domains; nothing about the visitor is stored.

export type WhatsAppWidget = Tables<"whatsapp_widgets">;

export interface WaWidgetInput { name: string; is_active: boolean; phone: string; label: string; greeting: string; position: "right" | "left"; bottom_offset: number; allowed_domains: string[] }

export async function listWaWidgets() {
  const { data } = await db().from("whatsapp_widgets").select("*").order("created_at");
  return data ?? [];
}

export async function waClicks(days = 30) {
  const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const { data } = await db().from("whatsapp_widget_clicks").select("widget_id, clicks").gte("day", since);
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(r.widget_id, (m.get(r.widget_id) ?? 0) + r.clicks);
  return m;
}

export async function saveWaWidget(bos: BosUser, id: string | null, input: WaWidgetInput) {
  if (!can(bos, "messaging.manage")) throw new ForbiddenError();
  const phone = normalizePhone(input.phone);
  if (!phone) throw new ValidationError("رقم واتساب غير صالح — بالصيغة الدولية.", { phone: "غير صالح" });
  if (!input.name.trim() || !input.label.trim()) throw new ValidationError("الاسم والنص مطلوبان.");
  const row = { ...input, phone, name: input.name.trim(), label: input.label.trim().slice(0, 60), greeting: input.greeting.trim().slice(0, 500) };
  if (id) {
    const { error } = await db().from("whatsapp_widgets").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db().from("whatsapp_widgets").insert({ ...row, created_by: bos.userId }).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  await audit({ actorId: bos.userId, action: "messaging.wa_widget_saved", entityType: "whatsapp_widget", entityId: id, newValue: { name: row.name, is_active: row.is_active } });
  return id;
}

export async function waWidgetByKey(key: string) {
  if (!/^[0-9a-f]{16,64}$/.test(key)) return null;
  const { data } = await db().from("whatsapp_widgets").select("*").eq("public_key", key).eq("is_active", true).maybeSingle();
  return data;
}

export async function recordWaClick(widgetId: string) {
  await db().rpc("bos_whatsapp_click", { p_widget: widgetId });
}
