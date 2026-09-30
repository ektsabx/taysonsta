import { createClient } from "@/lib/supabase/server";
import { getProposalForClient, recordProposalView } from "@/services/proposals-public";
import { getClientByIdAdmin } from "@/services/clients";
import { parseProposalContent, parseProjectsSnapshot, emptyProposalContent } from "@/types/proposal";
import { ProposalDocument } from "@/components/proposal/ProposalDocument";
import { ProposalLoginForm } from "./ProposalLoginForm";
import { ClientDecision } from "./ClientDecision";
import { recordFirstView } from "@/services/bos/proposal-lifecycle";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ClientProposalPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="proposal-login-shell">
        <div className="proposal-login-card">
          <h1>Taysonsta</h1>
          <p>سجّل الدخول لعرض المقترح الخاص بك</p>
          <ProposalLoginForm slug={slug} />
        </div>
      </div>
    );
  }

  // Authorization happens entirely inside this query via the RLS policy on
  // `proposals` — it only returns a row when auth.uid() is linked through
  // proposal_access to THIS proposal, and only once it's left draft/ready.
  const proposal = await getProposalForClient(slug);

  if (!proposal) {
    return (
      <div className="proposal-login-shell">
        <p className="proposal-noaccess">لا يمكنك الوصول إلى هذا المقترح، أو أنه غير جاهز بعد.</p>
      </div>
    );
  }

  const firstView = proposal.status === "published" && !proposal.first_viewed_at;
  await recordProposalView(proposal);
  if (firstView) {
    await recordFirstView(proposal.id);
  }

  const client = await getClientByIdAdmin(proposal.client_id);
  const content = proposal.published_content ? parseProposalContent(proposal.published_content) : emptyProposalContent;
  const projects = parseProjectsSnapshot(proposal.published_projects_snapshot);

  return (
    <>
      <ProposalDocument
        title={proposal.title}
        subtitle={proposal.subtitle}
        clientName={client?.name ?? ""}
        clientCompany={client?.company_name ?? null}
        content={content}
        projects={projects}
      />
      <ClientDecision slug={slug} status={proposal.status === "published" ? "viewed" : proposal.status} validUntil={proposal.valid_until} />
    </>
  );
}
