import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// "Was this helpful?" votes on docs, help and blog articles (D-202). One vote
// per visitor and article (a random, anonymous visitor id in a cookie); a new
// click changes the vote. No personal data is stored.
const VISITOR_COOKIE = "yolias_vid";
const input = z.object({ kind: z.enum(["docs", "help", "blog"]), slug: z.string().regex(/^[a-z0-9-]{1,120}$/), helpful: z.boolean(), locale: z.enum(["en", "ar"]).default("en") });

export async function POST(request: NextRequest) {
  const p = input.safeParse(await request.json().catch(() => null));
  if (!p.success) return NextResponse.json({ ok: false }, { status: 400 });
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitor = existing && /^[0-9a-f-]{36}$/.test(existing) ? existing : randomUUID();
  const { error } = await createAdminClient().from("content_feedback").upsert(
    { kind: p.data.kind, slug: p.data.slug, visitor_id: visitor, helpful: p.data.helpful, locale: p.data.locale, updated_at: new Date().toISOString() },
    { onConflict: "kind,slug,visitor_id" },
  );
  const res = NextResponse.json({ ok: !error });
  if (!existing) res.cookies.set(VISITOR_COOKIE, visitor, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  return res;
}
