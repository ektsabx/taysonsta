import { nowIso } from "@/lib/bos/clock";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { Database, ProposalStatus } from "@/types/database";
import { parseProposalContent, validateProposalForPublish, type ProposalContent } from "@/types/proposal";
import { snapshotCaseStudiesAdmin } from "@/services/case-studies-admin";
import { getProposalAccessAdmin } from "@/services/proposal-access";
import { updateClientCrmStageAdmin, getClientByIdAdmin } from "@/services/clients";

export type ProposalRow = Database["public"]["Tables"]["proposals"]["Row"];

export interface ProposalWithClient extends ProposalRow {
  clientName: string;
  clientCompany: string | null;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function listProposalsAdmin(): Promise<ProposalWithClient[]> {
  const supabase = createAdminClient();

  const { data: proposals, error } = await supabase.from("proposals").select("*").order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const clientIds = Array.from(new Set((proposals ?? []).map((p) => p.client_id)));
  const { data: clients, error: clientsError } = clientIds.length
    ? await supabase.from("clients").select("id, name, company_name").in("id", clientIds)
    : { data: [], error: null };

  if (clientsError) {
    throw clientsError;
  }

  const clientById = new Map((clients ?? []).map((c) => [c.id, c]));

  return (proposals ?? []).map((p) => ({
    ...p,
    clientName: clientById.get(p.client_id)?.name ?? "",
    clientCompany: clientById.get(p.client_id)?.company_name ?? null,
  }));
}

export async function listProposalsForClientAdmin(clientId: string): Promise<ProposalRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getProposalByIdAdmin(id: string): Promise<ProposalRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("proposals").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSelectedProjectIdsAdmin(proposalId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("proposal_projects")
    .select("case_study_id")
    .eq("proposal_id", proposalId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((r) => r.case_study_id);
}

export async function createProposal(params: {
  clientId: string;
  title: string;
  subtitle: string;
  createdBy: string | null;
}): Promise<string> {
  const supabase = createAdminClient();
  const client = await getClientByIdAdmin(params.clientId);
  const baseSlug = slugify(client?.name || params.title) || "proposal";

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${baseSlug}-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("proposals")
      .insert({
        client_id: params.clientId,
        slug,
        title: params.title,
        subtitle: params.subtitle || null,
        status: "draft",
        content: {},
        published_content: null,
        published_projects_snapshot: [],
        created_by: params.createdBy,
      })
      .select("id")
      .single();

    if (!error) {
      return data.id as string;
    }
    if (error.code !== "23505") {
      throw error;
    }
  }

  throw new Error("Could not generate a unique proposal slug, try again");
}

export async function updateProposalBasics(
  id: string,
  input: { title: string; subtitle: string; content: ProposalContent }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("proposals")
    .update({
      title: input.title,
      subtitle: input.subtitle || null,
      content: input.content as unknown as Json,
    })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

export async function setSelectedProjects(proposalId: string, caseStudyIds: string[]): Promise<void> {
  const supabase = createAdminClient();

  const { error: deleteError } = await supabase.from("proposal_projects").delete().eq("proposal_id", proposalId);
  if (deleteError) {
    throw deleteError;
  }

  if (caseStudyIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("proposal_projects").insert(
    caseStudyIds.map((caseStudyId, index) => ({
      proposal_id: proposalId,
      case_study_id: caseStudyId,
      sort_order: index,
    }))
  );

  if (insertError) {
    throw insertError;
  }
}

export async function markProposalReady(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("proposals").update({ status: "ready" }).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function backToDraft(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("proposals").update({ status: "draft" }).eq("id", id);
  if (error) {
    throw error;
  }
}

export class ProposalValidationFailedError extends Error {
  errors: { field: string; message: string }[];

  constructor(errors: { field: string; message: string }[]) {
    super("Proposal is missing required fields");
    this.errors = errors;
    this.name = "ProposalValidationFailedError";
  }
}

export async function publishProposal(id: string): Promise<void> {
  const supabase = createAdminClient();
  const proposal = await getProposalByIdAdmin(id);
  if (!proposal) {
    throw new Error("Proposal not found");
  }

  const content = parseProposalContent(proposal.content);
  const access = await getProposalAccessAdmin(id);

  const errors = validateProposalForPublish({ title: proposal.title, content, hasAccess: Boolean(access) });
  if (errors.length > 0) {
    throw new ProposalValidationFailedError(errors);
  }

  const selectedIds = await getSelectedProjectIdsAdmin(id);
  const projectsSnapshot = await snapshotCaseStudiesAdmin(selectedIds);

  const wasEverPublished = Boolean(proposal.published_at);

  const { error } = await supabase
    .from("proposals")
    .update({
      status: "published",
      published_content: content as unknown as Json,
      published_projects_snapshot: projectsSnapshot as unknown as Json,
      published_at: wasEverPublished ? proposal.published_at : nowIso(),
    })
    .eq("id", id);

  if (error) {
    throw error;
  }

  const client = await getClientByIdAdmin(proposal.client_id);
  if (client && ["lead", "qualified", "call_booked", "call_completed", "proposal_requested"].includes(client.crm_stage)) {
    await updateClientCrmStageAdmin(client.id, "proposal_sent");
  }
}

export async function archiveProposal(id: string, archived: boolean): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("proposals").update({ is_archived: archived }).eq("id", id);
  if (error) {
    throw error;
  }
}

export async function duplicateProposal(id: string): Promise<string> {
  const supabase = createAdminClient();
  const original = await getProposalByIdAdmin(id);
  if (!original) {
    throw new Error("Proposal not found");
  }

  const selectedIds = await getSelectedProjectIdsAdmin(id);
  const baseSlug = slugify(original.title) || "proposal";

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${baseSlug}-copy-${randomSuffix()}`;
    const { data, error } = await supabase
      .from("proposals")
      .insert({
        client_id: original.client_id,
        slug,
        title: `${original.title} (Copy)`,
        subtitle: original.subtitle,
        status: "draft",
        content: original.content,
        published_content: null,
        published_projects_snapshot: [],
        created_by: original.created_by,
      })
      .select("id")
      .single();

    if (!error) {
      if (selectedIds.length > 0) {
        await setSelectedProjects(data.id as string, selectedIds);
      }
      return data.id as string;
    }
    if (error.code !== "23505") {
      throw error;
    }
  }

  throw new Error("Could not generate a unique proposal slug, try again");
}

export { getStatusBadgeInfo } from "@/lib/proposal-status";
