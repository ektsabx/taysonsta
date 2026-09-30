import { redirect } from "next/navigation";

export default async function LegacyNewProposalPage({ searchParams }: { searchParams: Promise<{ clientId?: string }> }) {
  const { clientId } = await searchParams;
  redirect(`/admin/sales/proposals/new${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`);
}
