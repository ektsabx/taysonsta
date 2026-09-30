// Read-only diagnostic: prints the exact state of Abdullah's proposal +
// access record so we know precisely why the client link is failing,
// instead of guessing.
//
// Usage:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   ABDULLAH_EMAIL=... npx tsx scripts/diagnose-abdullah-proposal.ts

import { createAdminClient } from "../lib/supabase/admin";

const EMAIL = process.env.ABDULLAH_EMAIL;
if (!EMAIL) {
  console.error("Missing ABDULLAH_EMAIL env var.");
  process.exit(1);
}

async function main() {
  const admin = createAdminClient();

  const { data: client, error: clientError } = await admin.from("clients").select("*").eq("email", EMAIL!).maybeSingle();
  console.log("--- clients ---");
  if (clientError) console.log("ERROR:", clientError.message);
  console.log(client ? { id: client.id, email: client.email, crm_stage: client.crm_stage } : "NOT FOUND");

  if (!client) return;

  const { data: proposals, error: propError } = await admin.from("proposals").select("*").eq("client_id", client.id);
  console.log("\n--- proposals (all for this client) ---");
  if (propError) console.log("ERROR:", propError.message);
  for (const p of proposals ?? []) {
    console.log({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      is_archived: p.is_archived,
      published_at: p.published_at,
      has_published_content: Boolean(p.published_content),
    });
  }

  const { data: access, error: accessError } = await admin
    .from("proposal_access")
    .select("*")
    .in("proposal_id", (proposals ?? []).map((p) => p.id));
  console.log("\n--- proposal_access ---");
  if (accessError) console.log("ERROR:", accessError.message);
  console.log(access);

  console.log("\n--- auth.users lookup by email ---");
  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers();
  if (usersError) console.log("ERROR:", usersError.message);
  const matches = (usersPage?.users ?? []).filter((u) => u.email === EMAIL);
  console.log(
    matches.map((u) => ({
      id: u.id,
      email: u.email,
      app_metadata: u.app_metadata,
      email_confirmed_at: u.email_confirmed_at,
      created_at: u.created_at,
    }))
  );
  if (matches.length > 1) {
    console.log(`\n⚠️  ${matches.length} auth users share this email — that's the bug if the access record points to the wrong one.`);
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
