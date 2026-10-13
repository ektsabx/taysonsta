"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCaptcha } from "@/lib/auth/captcha";
import { contactLimited, hashIp, notifyTeam, recentDuplicate } from "@/lib/support/messages";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export type ContactValues = Partial<Record<"name" | "email" | "company" | "topic" | "message", string>>;
export type ContactState = { status: "idle" } | { status: "sent" } | { status: "error"; message: string; field?: string; values?: ContactValues };

const topics = ["sales", "support", "partnerships", "press", "other"] as const;

// Stores a message from the public Contact page (service role; the table has
// no public policies). The team reads it in Yolias Admin → Support → Website
// messages and gets an email when an address is set there (lib/support).
export async function submitContact(prev: ContactState, formData: FormData): Promise<ContactState> {
  const r = await saveContact(formData);
  // React clears the form after an action: hand the text back so nothing typed is lost.
  if (r.status !== "error") return r;
  const values: ContactValues = {};
  for (const k of ["name", "email", "company", "topic", "message"] as const) values[k] = String(formData.get(k) ?? "").slice(0, 5000);
  void prev;
  return { ...r, values };
}

async function saveContact(formData: FormData): Promise<ContactState> {
  const t = (await getDictionary()).contact.errors;
  // Honeypot: real visitors never fill this hidden field.
  if (String(formData.get("website") ?? "")) return { status: "sent" };

  const schema = z.object({
    name: z.string().trim().min(2, t.name).max(120),
    email: z.string().trim().toLowerCase().email(t.email).max(200),
    company: z.string().trim().max(160).optional(),
    topic: z.enum(topics),
    message: z.string().trim().min(10, t.message).max(5000),
  });
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    company: formData.get("company") || undefined,
    topic: formData.get("topic"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: issue.message, field: String(issue.path[0]) };
  }

  const h = await headers();
  const ip = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const token = formData.get("cf-turnstile-response");
  const captcha = await verifyCaptcha(typeof token === "string" ? token : null, ip);
  if (captcha !== "ok" && captcha !== "not_configured") return { status: "error", message: captcha === "unavailable" ? t.failed : t.captcha };

  const db = createAdminClient();
  // A double submit (or a retry after a dropped connection) is stored once.
  if (await recentDuplicate(db, "contact", parsed.data.email, parsed.data.message)) return { status: "sent" };
  const ipHash = hashIp(ip);
  if (await contactLimited(db, ipHash, parsed.data.email)) return { status: "error", message: t.tooMany };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { data: row, error } = await db.from("contact_messages").insert({
    ...parsed.data,
    company: parsed.data.company ?? null,
    locale: await getLocale(),
    user_id: (data?.claims?.sub as string | undefined) ?? null,
    kind: "contact",
    ip_hash: ipHash,
  }).select("id, kind, name, email, topic, category, subject, message, page_path").single();
  if (error || !row) {
    console.error("[contact] save failed", error?.message);
    Sentry.captureMessage("Contact message could not be saved", { level: "error", tags: { area: "contact_form" }, extra: { code: error?.code } });
    return { status: "error", message: t.failed };
  }
  after(() => notifyTeam(db, row));
  return { status: "sent" };
}
