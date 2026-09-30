import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { getProposalByIdAdmin, getSelectedProjectIdsAdmin } from "@/services/proposals";
import { getClientByIdAdmin } from "@/services/clients";
import { snapshotCaseStudiesAdmin } from "@/services/case-studies-admin";
import { parseProposalContent } from "@/types/proposal";
import { ProposalDocument } from "@/components/proposal/ProposalDocument";

interface PageProps {
  params: Promise<{ id: string }>;
}

// Admin-only, chrome-free preview of a proposal's current DRAFT content —
// exactly the shared template the client sees, fed with live data instead of
// the frozen published snapshot. Deliberately a sibling of /admin rather than
// nested under it so the admin dashboard sidebar never leaks into it.
export default async function ProposalPreviewPage({ params }: PageProps) {
  await requireAdminUser();
  const { id } = await params;

  const proposal = await getProposalByIdAdmin(id);
  if (!proposal) {
    notFound();
  }

  const [client, selectedProjectIds] = await Promise.all([
    getClientByIdAdmin(proposal.client_id),
    getSelectedProjectIdsAdmin(id),
  ]);
  const projects = await snapshotCaseStudiesAdmin(selectedProjectIds);
  const content = parseProposalContent(proposal.content);

  return (
    <ProposalDocument
      title={proposal.title}
      subtitle={proposal.subtitle}
      clientName={client?.name ?? ""}
      clientCompany={client?.company_name ?? null}
      content={content}
      projects={projects}
      isDraftPreview
    />
  );
}
