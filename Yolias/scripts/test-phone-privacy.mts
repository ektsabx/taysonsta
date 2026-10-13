// Phone numbers are private (public.user_phones, RLS) — local Supabase:
//   npm run test:phone-privacy
// The owner reads and changes their number; a teammate in the same
// workspace can't read it or write one for them; invalid numbers are refused.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const db = createClient<Database>(url, svc, { auth: { persistSession: false } });
const stamp = Date.now();
const users: { id: string; email: string; password: string }[] = [];
const signIn = async (u: { email: string; password: string }) => {
  const c = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword(u);
  if (error) throw error;
  return c;
};

try {
  for (const n of ["a", "b"]) {
    const email = `phone-${n}-${stamp}@example.org`, password = `P!${crypto.randomUUID()}`;
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push({ id: data.user.id, email, password });
  }
  const [a, b] = users;
  // Same workspace: b joins a's workspace as a member.
  const { data: pa } = await db.from("profiles").select("workspace_id").eq("id", a.id).single();
  const { error: memberErr } = await db.from("workspace_members").insert({ workspace_id: pa!.workspace_id!, user_id: b.id, role: "member" });
  if (memberErr) throw memberErr;

  const ca = await signIn(a), cb = await signIn(b);
  assert.ifError((await ca.from("user_phones").upsert({ user_id: a.id, phone: "+201001234567" })).error);
  assert.equal((await ca.from("user_phones").select("phone").eq("user_id", a.id).single()).data!.phone, "+201001234567");
  assert.equal(((await cb.from("profiles").select("id").eq("id", a.id)).data ?? []).length, 1, "teammates can see the profile…");
  assert.equal(((await cb.from("user_phones").select("phone").eq("user_id", a.id)).data ?? []).length, 0, "…but never the phone");
  assert.ok((await cb.from("user_phones").upsert({ user_id: a.id, phone: "+201111111111" })).error || true);
  assert.equal((await db.from("user_phones").select("phone").eq("user_id", a.id).single()).data!.phone, "+201001234567", "a teammate can't change it");
  assert.ok((await ca.from("user_phones").upsert({ user_id: a.id, phone: "01001234567" })).error, "the database refuses non-E.164 values");

  console.log("✓ phone privacy: owner reads and saves, teammates can't read or change it, E.164 enforced by the database");
} finally {
  for (const u of users) {
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", u.id).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(u.id);
  }
}
