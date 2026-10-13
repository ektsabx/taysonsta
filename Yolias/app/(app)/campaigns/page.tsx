import { redirect } from "next/navigation";

// The Campaigns page moved into Prospects → Search results (D-204).
export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { status } = await searchParams;
  redirect(typeof status === "string" && status ? `/prospects?view=searches&status=${encodeURIComponent(status)}` : "/prospects?view=searches");
}
