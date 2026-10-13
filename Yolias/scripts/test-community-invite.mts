// Community invitation email (lib/email/events.ts communityInvite):
//   npm run test:community-invite
// Queued once per account even when the event repeats (a one-time onboarding
// email, so it doesn't wait for "Product updates"); not queued when Admin
// switched it off; the email links to the group.
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { communityInvite } from "@/lib/email/events.ts";
import { renderEmail } from "@/lib/email/catalog.ts";
import { COMMUNITY_URL } from "@/lib/community.ts";
import type { Database } from "@/types/database.ts";

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ids: string[] = [];
const rows = async (id: string) => (await db.from("email_log").select("id, status").eq("kind", "community_invite").eq("user_id", id)).data ?? [];

try {
  for (const n of ["on", "off"]) {
    const { data, error } = await db.auth.admin.createUser({ email: `community-${n}-${Date.now()}@example.org`, email_confirm: true });
    if (error) throw error;
    ids.push(data.user.id);
  }
  const [on, off] = ids;
  await Promise.all([communityInvite(on, "Sara"), communityInvite(on, "Sara")]);
  await communityInvite(on, "Sara");
  assert.equal((await rows(on)).length, 1, "one invitation per account, however often the event fires");

  const { data: sw } = await db.from("email_settings").select("*").eq("kind", "community_invite").maybeSingle();
  await db.from("email_settings").upsert({ kind: "community_invite", email_enabled: false, in_app_enabled: false });
  await new Promise((r) => setTimeout(r, 31_000)); // the switch is cached for 30 s
  await communityInvite(off, null);
  if (sw) await db.from("email_settings").upsert(sw); else await db.from("email_settings").delete().eq("kind", "community_invite");
  assert.equal((await rows(off)).length, 0, "Admin's off switch is honoured");

  const html = renderEmail("community_invite", "en", { name: "Sara", communityUrl: COMMUNITY_URL, siteUrl: "https://www.yolias.com" }).html;
  assert.ok(html.includes(COMMUNITY_URL));
  assert.ok(html.includes("one-time invitation"), "says it is sent once");

  console.log("✓ community invite: once per account (concurrent and repeated events), Admin switch honoured, links to the group");
} finally {
  for (const id of ids) {
    await db.from("email_log").delete().eq("user_id", id);
    const { data: prof } = await db.from("profiles").select("workspace_id").eq("id", id).maybeSingle();
    if (prof?.workspace_id) await db.from("workspaces").delete().eq("id", prof.workspace_id);
    await db.auth.admin.deleteUser(id);
  }
}
