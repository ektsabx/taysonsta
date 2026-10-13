"use server";

import { after } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { verifyImageFile } from "@/lib/uploads/image";
import { requireSession } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDictionary, getLocale } from "@/lib/i18n/server";
import { notifyTeam, recentDuplicate, reportsLimited } from "@/lib/support/messages";

// Feedback / Report a Bug from inside the app (2026-10-12). Signed-in users
// only. Stored with the support messages (kind = bug_report) and handled in
// Yolias Admin → Support → Website messages. Only what the user typed plus
// non-sensitive technical context (page path without its query, release,
// browser, screen size) — never form contents, tokens or payment data.

export type FeedbackResult = { ok: true } | { ok: false; error: string };

const categories = ["bug", "feedback", "billing", "data", "account", "other"] as const;

/** Strips anything that could carry a secret from a page path. */
function cleanPath(v: unknown): string | null {
  if (typeof v !== "string" || !v.startsWith("/")) return null;
  return v.split(/[?#]/)[0].slice(0, 300);
}

export async function submitFeedback(formData: FormData): Promise<FeedbackResult> {
  const session = await requireSession();
  const t = (await getDictionary()).feedback.errors;
  // Honeypot.
  if (String(formData.get("website") ?? "")) return { ok: true };

  const parsed = z.object({
    category: z.enum(categories),
    message: z.string().trim().min(10, t.message).max(5000),
    steps: z.string().trim().max(3000).optional(),
  }).safeParse({ category: formData.get("category"), message: formData.get("message"), steps: formData.get("steps") || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const db = createAdminClient();
  if (await recentDuplicate(db, "bug_report", session.email, parsed.data.message)) return { ok: true };
  if (await reportsLimited(db, session.userId)) return { ok: false, error: t.tooMany };

  // Optional screenshot: private bucket, images only.
  let screenshot: string | null = null;
  const file = formData.get("screenshot");
  if (file instanceof File && file.size > 0) {
    // PNG, JPEG or WebP up to 10 MB, by the file's real bytes (D-182).
    const checked = await verifyImageFile(file);
    if (!checked.ok) return { ok: false, error: checked.error === "size" ? t.screenshotSize : t.screenshotType };
    const type = checked.type;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const path = `${session.userId}/${crypto.randomUUID()}.${type.split("/")[1]}`;
    const { error } = await db.storage.from("bug-screenshots").upload(path, bytes, { contentType: type, upsert: false });
    if (error) {
      Sentry.captureMessage("Bug report screenshot upload failed", { level: "warning", tags: { area: "feedback" } });
      return { ok: false, error: t.failed };
    }
    screenshot = path;
  }

  const text = (k: string, max: number) => String(formData.get(k) ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) || null;
  const { data: row, error } = await db.from("contact_messages").insert({
    kind: "bug_report",
    topic: "support",
    name: session.profile.full_name || session.email,
    email: session.email,
    company: session.workspace.name ?? null,
    category: parsed.data.category,
    message: parsed.data.message,
    steps: parsed.data.steps ?? null,
    page_path: cleanPath(formData.get("page")),
    app_release: text("release", 60),
    browser: text("browser", 300),
    viewport: text("viewport", 40),
    screenshot_path: screenshot,
    locale: await getLocale(),
    user_id: session.userId,
    workspace_id: session.workspace.id,
  }).select("id, kind, name, email, topic, category, subject, message, page_path").single();
  if (error || !row) {
    if (screenshot) await db.storage.from("bug-screenshots").remove([screenshot]);
    Sentry.captureMessage("Bug report could not be saved", { level: "error", tags: { area: "feedback" }, extra: { code: error?.code } });
    return { ok: false, error: t.failed };
  }
  after(() => notifyTeam(db, row));
  return { ok: true };
}
