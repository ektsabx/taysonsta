// Integration test (D-278) against the local Supabase: listed workspaces with
// an industry become the "Yolias members" dataset; a workspace that leaves the
// directory is gone after the next rebuild.
//   npm run test:members
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { rebuildMemberDataset } from "../lib/datasets/members.ts";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const intel = db.schema("intel");
const { data: ws } = await db.from("workspaces").select("id, name, industry, created_by").not("industry", "is", null).not("created_by", "is", null).limit(1).single();
assert.ok(ws, "a workspace with an industry");
const { data: owner } = await db.from("profiles").select("email").eq("id", ws.created_by).single();
const contactFor = async () => (await intel.from("contacts").select("value, source").eq("value", owner!.email).like("source", "dataset:%")).data ?? [];
try {
  await db.from("workspaces").update({ listed_in_directory: true }).eq("id", ws.id);
  const r = await rebuildMemberDataset();
  assert.ok(r.rows >= 1 && r.merged >= 1, JSON.stringify(r));
  const { data: ds } = await intel.from("datasets").select("id, status, customer_facing").eq("created_by", "system:members").neq("status", "deleted");
  assert.equal(ds?.length, 1); assert.equal(ds![0].status, "ready"); assert.equal(ds![0].customer_facing, true);
  assert.ok((await contactFor()).length >= 1, "the owner's email is a contact");
  await db.from("workspaces").update({ listed_in_directory: false }).eq("id", ws.id);
  await rebuildMemberDataset();
  assert.equal((await contactFor()).some((c) => c.source === `dataset:${ds![0].id}`), false, "old dataset removed");
  console.log("member dataset: ok");
} finally {
  await db.from("workspaces").update({ listed_in_directory: true }).eq("id", ws.id);
}
