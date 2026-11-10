// Integration test (audit, 2026-11-10): a team invitation is accepted, never
// applied. An account created for the invited address without the
// invitation's token gets its own workspace; one created from the invitation
// link (token in the signup metadata) joins the team with the invited role.
// The /join page shows the invitation to a visitor.
//   YOLIAS_TEST_APP_URL=http://localhost:3201 npm run test:team-invite
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const app = process.env.YOLIAS_TEST_APP_URL ?? "http://localhost:3200";
const stamp = Date.now();
const users: string[] = [];
const make = async (email: string, meta: Record<string, unknown> = {}) => {
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  users.push(data.user!.id);
  return data.user!.id;
};
const wsOf = async (id: string) => (await db.from("profiles").select("workspace_id").eq("id", id).single()).data!.workspace_id!;

try {
  const owner = await make(`invite-owner-${stamp}@yolias.local`);
  const team = await wsOf(owner);
  await db.from("workspaces").update({ name: "Invite Test Co" }).eq("id", team);

  // 1. Invited, but the account is made some other way: no team, its own workspace.
  const a = `invite-a-${stamp}@yolias.local`;
  const { data: invA } = await db.from("workspace_invitations").insert({ workspace_id: team, email: a, role: "member", invited_by: owner }).select("token, accepted_at").single();
  const ua = await make(a);
  assert.notEqual(await wsOf(ua), team, "no join without accepting");
  assert.equal((await db.from("workspace_members").select("user_id").eq("workspace_id", team).eq("user_id", ua).maybeSingle()).data, null);
  assert.equal((await db.from("workspace_invitations").select("accepted_at").eq("token", invA!.token).single()).data!.accepted_at, null, "still pending");

  // 2. Account created from the invitation link: joins with the role, invitation accepted.
  const b = `invite-b-${stamp}@yolias.local`;
  const { data: invB } = await db.from("workspace_invitations").insert({ workspace_id: team, email: b, role: "analyst", invited_by: owner }).select("token").single();
  const ub = await make(b, { invite_token: invB!.token });
  assert.equal(await wsOf(ub), team, "joined from the link");
  assert.equal((await db.from("workspace_members").select("role").eq("workspace_id", team).eq("user_id", ub).single()).data!.role, "analyst");
  assert.ok((await db.from("workspace_invitations").select("accepted_at").eq("token", invB!.token).single()).data!.accepted_at);

  // 3. Another address can't use someone's token.
  const c = `invite-c-${stamp}@yolias.local`;
  const uc = await make(c, { invite_token: invA!.token });
  assert.notEqual(await wsOf(uc), team, "a token works only for its own email");

  // 4. The invitation page.
  const page = await (await fetch(`${app}/join/${invA!.token}`)).text();
  assert.match(page, /Invite Test Co/, "shows the team");
  assert.match(page, new RegExp(`join/${invA!.token}/start\\?to=signup`), "offers to create the account from the invitation");
  const bad = await (await fetch(`${app}/join/00000000-0000-4000-8000-000000000000`)).text();
  assert.match(bad, /can(’|'|&#x27;)t be used|لا يمكن استخدام/, "an unknown invitation says so");
  console.log("✓ team invitations: accepted only from the link, role kept, token bound to its email, join page");
} finally {
  for (const id of users.reverse()) {
    const ws = (await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle()).data?.workspace_id;
    await db.auth.admin.deleteUser(id);
    if (ws) await db.from("workspaces").delete().eq("id", ws);
  }
}
