import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type ProposalAccess = Database["public"]["Tables"]["proposal_access"]["Row"];

export class AccessEmailInUseError extends Error {
  constructor() {
    super("This email is already used for another proposal's access");
    this.name = "AccessEmailInUseError";
  }
}

export async function getProposalAccessAdmin(proposalId: string): Promise<ProposalAccess | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("proposal_access").select("*").eq("proposal_id", proposalId).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// Creates the dedicated Supabase auth user for this proposal's client and
// links it via proposal_access. app_metadata.role is set server-side only
// (the admin API key never reaches the browser) so this account can never
// be escalated to staff — see lib/auth.ts.
export async function createProposalAccess(proposalId: string, email: string, password: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "proposal_client" },
  });

  if (createError || !created.user) {
    if (createError?.code === "email_exists") {
      throw new AccessEmailInUseError();
    }
    throw createError ?? new Error("Failed to create client access");
  }

  const { error: linkError } = await supabase.from("proposal_access").insert({
    proposal_id: proposalId,
    auth_user_id: created.user.id,
    email,
    last_login_at: null,
  });

  if (linkError) {
    // Roll back the orphaned auth user if we couldn't link it.
    await supabase.auth.admin.deleteUser(created.user.id);
    throw linkError;
  }
}

export async function resetProposalAccessPassword(proposalId: string, password: string): Promise<void> {
  const supabase = createAdminClient();
  const access = await getProposalAccessAdmin(proposalId);

  if (!access) {
    throw new Error("No access exists for this proposal yet");
  }

  const { error } = await supabase.auth.admin.updateUserById(access.auth_user_id, { password });

  if (error) {
    throw error;
  }
}
