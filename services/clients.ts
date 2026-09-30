import { createAdminClient } from "@/lib/supabase/admin";
import type { CrmStage, Database } from "@/types/database";

export type Client = Database["public"]["Tables"]["clients"]["Row"];

export interface ClientWithProposalStats extends Client {
  proposalCount: number;
}

export async function listClientsAdmin(): Promise<ClientWithProposalStats[]> {
  const supabase = createAdminClient();

  const { data: clients, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const clientIds = (clients ?? []).map((c) => c.id);
  const { data: proposals, error: proposalsError } = clientIds.length
    ? await supabase.from("proposals").select("client_id").in("client_id", clientIds)
    : { data: [], error: null };

  if (proposalsError) {
    throw proposalsError;
  }

  const countByClient = new Map<string, number>();
  for (const row of proposals ?? []) {
    countByClient.set(row.client_id, (countByClient.get(row.client_id) ?? 0) + 1);
  }

  return (clients ?? []).map((c) => ({ ...c, proposalCount: countByClient.get(c.id) ?? 0 }));
}

export async function getClientByIdAdmin(id: string): Promise<Client | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export interface ClientFormInput {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  notes: string;
}

export async function createClientAdmin(input: ClientFormInput, createdBy: string | null): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      company_name: input.companyName || null,
      email: input.email,
      phone: input.phone || null,
      country: input.country || null,
      website: input.website || null,
      notes: input.notes || null,
      crm_stage: "lead",
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function updateClientAdmin(id: string, input: ClientFormInput): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("clients")
    .update({
      name: input.name,
      company_name: input.companyName || null,
      email: input.email,
      phone: input.phone || null,
      country: input.country || null,
      website: input.website || null,
      notes: input.notes || null,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function updateClientCrmStageAdmin(id: string, stage: CrmStage): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("clients").update({ crm_stage: stage }).eq("id", id);

  if (error) {
    throw error;
  }
}
