import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { canAccessEntity } from "@/lib/bos/access";
import { getProposalByIdAdmin, getSelectedProjectIdsAdmin } from "@/services/proposals";
import { getClientByIdAdmin } from "@/services/clients";
import { listCaseStudiesAdmin } from "@/services/case-studies-admin";
import { getProposalAccessAdmin } from "@/services/proposal-access";
import { listCurrencies } from "@/services/bos/shared";
import { parseProposalContent } from "@/types/proposal";
import { siteUrl } from "@/lib/seo";
import { PageHeader, Card } from "@/components/bos/ui";
import { ProposalContentForm } from "@/app/admin/proposals/[id]/edit/ProposalContentForm";
import { StatusActions } from "@/app/admin/proposals/[id]/edit/StatusActions";
import { AccessPanel } from "@/app/admin/proposals/[id]/edit/AccessPanel";
import { CommercialTermsForm } from "../CommercialTermsForm";

// Proposal Builder (§15): content sections (existing builder), commercial
// terms with automatic totals, client access and lifecycle actions.
export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("proposals.update");
  const { id } = await params;
  if (!(await canAccessEntity(bos, "proposal", id, "update"))) notFound();

  const proposal = await getProposalByIdAdmin(id);
  if (!proposal) notFound();

  const [client, caseStudies, selectedProjectIds, access, currencies] = await Promise.all([
    getClientByIdAdmin(proposal.client_id),
    listCaseStudiesAdmin(),
    getSelectedProjectIdsAdmin(id),
    getProposalAccessAdmin(id),
    listCurrencies(),
  ]);
  const content = parseProposalContent(proposal.content);
  const publicUrl = `${siteUrl}/proposal/${proposal.slug}`;
  const schedule = ((proposal.payment_schedule as unknown as { label: string; percent: string | number }[]) ?? []).map((r) => ({ label: r.label, percent: String(r.percent) }));
  const closed = ["accepted", "rejected", "expired"].includes(proposal.status);

  return (
    <>
      <PageHeader
        title={<Tx vars={{ title: proposal.title }}>{"منشئ المقترح: {title}"}</Tx>}
        subtitle={client ? <Link href={`/admin/clients/${client.id}`}>{client.company_name ?? client.name}</Link> : null}
        breadcrumbs={[{ label: "المقترحات", href: "/admin/sales/proposals" }, { label: proposal.title, href: `/admin/sales/proposals/${id}` }, { label: "تحرير" }]}
        actions={
          <Link href={`/admin/sales/proposals/${id}`} className="admin-btn small secondary">
            <Tx>صفحة المقترح</Tx>
          </Link>
        }
      />
      <div className="bos-card">
        <div className="bos-card-body bos-row" style={{ justifyContent: "space-between" }}>
          <span className="bos-muted" style={{ fontSize: 13 }}><Tx>رابط المقترح الخاص بالعميل</Tx></span>
          <code style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{publicUrl}</code>
        </div>
      </div>
      {closed ? <div className="bos-form-error" style={{ marginBottom: 12 }}><Tx vars={{ status: proposal.status }}>{"هذا المقترح مغلق ({status}). للتعديل أنشئ نسخة جديدة."}</Tx></div> : null}

      <div className="bos-grid main-side">
        <div>
          <ProposalContentForm
            proposalId={id}
            initialTitle={proposal.title}
            initialSubtitle={proposal.subtitle ?? ""}
            initialContent={content}
            caseStudies={caseStudies}
            initialSelectedProjectIds={selectedProjectIds}
          />
          <Card title="التسعير وشروط الدفع">
            <CommercialTermsForm
              proposalId={id}
              currencies={currencies}
              disabled={closed}
              initial={{
                total: proposal.total_amount !== null ? String(proposal.total_amount) : "",
                currency: proposal.currency ?? "USD",
                schedule,
                validUntil: proposal.valid_until,
                assumptions: proposal.assumptions,
                terms: proposal.terms,
              }}
            />
          </Card>
        </div>
        <div>
          <StatusActions
            proposalId={id}
            status={proposal.status}
            isArchived={proposal.is_archived}
            publishedAt={proposal.published_at}
            lastViewedAt={proposal.last_viewed_at}
            viewCount={proposal.view_count}
            dealId={proposal.deal_id}
            validUntil={proposal.valid_until}
            version={proposal.version}
          />
          <AccessPanel proposalId={id} existingEmail={access?.email ?? null} />
        </div>
      </div>
    </>
  );
}
