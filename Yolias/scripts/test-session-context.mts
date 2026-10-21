// The one-round-trip session (D-251) keeps getUser's protections:
//   npm run test:session
// A signed-in user gets profile, workspace and role; once banned in Auth
// (Admin suspend / pause / ban), the same still-valid token gets nothing.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const email = `session-${Date.now()}@yolias.local`;
const { data: u, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
if (error) throw error;
try {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const pub = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { data: s, error: e } = await pub.auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: "magiclink" });
  if (e || !s.session) throw e ?? new Error("no session");
  const as = createClient<Database>(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.session.access_token}` } } });
  const { data: ctx } = await as.rpc("session_context");
  const c = ctx as { profile: { id: string }; workspace: { id: string }; role: string; email: string } | null;
  assert.ok(c, "signed in: context");
  assert.equal(c!.profile.id, u.user.id); assert.equal(c!.role, "owner"); assert.equal(c!.email, email); assert.ok(c!.workspace.id);
  assert.equal((await createClient<Database>(url, anon, { auth: { persistSession: false } }).rpc("session_context")).data, null, "no token: nothing");
  await admin.auth.admin.updateUserById(u.user.id, { ban_duration: "24h" });
  assert.equal((await as.rpc("session_context")).data, null, "banned: the same token gets nothing");
  await admin.auth.admin.updateUserById(u.user.id, { ban_duration: "none" });
  assert.ok((await as.rpc("session_context")).data, "unbanned: back");
  console.log("✓ session context: one call, banned users refused at once");
} finally {
  const { data: p } = await admin.from("profiles").select("workspace_id").eq("id", u.user.id).maybeSingle();
  if (p?.workspace_id) await admin.from("workspaces").delete().eq("id", p.workspace_id);
  await admin.auth.admin.deleteUser(u.user.id);
}
