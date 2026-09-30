import { redirect } from "next/navigation";

export default async function LegacyEditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/sales/proposals/${id}/edit`);
}
