import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// A search's results live on its campaign page (D-166): one page, no
// duplicate. Old links and the browser's Back land there.
export default async function SearchResultsPage({ params, searchParams }: PageProps<"/search/[id]/results">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await createClient();
  const { data: campaign } = await db.from("campaigns").select("id").eq("strategy_id", id).eq("workspace_id", session.workspace.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!campaign) redirect(`/search/${id}`);
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string" && k !== "tab") sp.set(k, v);
  const q = sp.toString();
  redirect(`/campaigns/${campaign.id}${q ? `?${q}` : ""}`);
}
