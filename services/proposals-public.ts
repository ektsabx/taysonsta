import { nowIso } from "@/lib/bos/clock";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProposalRow } from "@/services/proposals";

// Reads via the session-scoped (anon-key) client so RLS — not app code — is
// what decides whether this visitor may see this proposal. See the
// "client reads own published proposal" policy in the CRM migration.
export async function getProposalForClient(slug: string): Promise<ProposalRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("proposals").select("*").eq("slug", slug).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// Only called after getProposalForClient already proved (via RLS) that the
// current session owns this proposal, so it's safe to write with the
// service-role client here rather than adding a broader authenticated
// UPDATE policy.
export async function recordProposalView(proposal: ProposalRow): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from("proposals")
    .update({
      view_count: proposal.view_count + 1,
      first_viewed_at: proposal.first_viewed_at ?? nowIso(),
      last_viewed_at: nowIso(),
      status: proposal.status === "published" ? "viewed" : proposal.status,
    })
    .eq("id", proposal.id);

  if (proposal.status === "published") {
    const { data: client } = await supabase.from("clients").select("id, crm_stage").eq("id", proposal.client_id).maybeSingle();
    if (client && client.crm_stage === "proposal_sent") {
      await supabase.from("clients").update({ crm_stage: "proposal_viewed" }).eq("id", client.id);
    }
  }
}
