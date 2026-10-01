"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/lib/i18n/server";

export type ContactState = { status: "idle" } | { status: "sent" } | { status: "error"; message: string; field?: string };

const topics = ["sales", "support", "partnerships", "press", "other"] as const;

// Stores a message from the public Contact page (service role; the table has
// no public policies).
export async function submitContact(_prev: ContactState, formData: FormData): Promise<ContactState> {
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

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { error } = await createAdminClient().from("contact_messages").insert({
    ...parsed.data,
    company: parsed.data.company ?? null,
    locale: await getLocale(),
    user_id: (data?.claims?.sub as string | undefined) ?? null,
  });
  if (error) return { status: "error", message: t.failed };
  return { status: "sent" };
}
