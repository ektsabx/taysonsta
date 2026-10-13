import { StrategyComposer } from "@/components/app/StrategyComposer";
import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export default async function YoliasAiPage({ searchParams }: PageProps<"/">) {
  const session = await requireSession();
  const { new: fresh } = await searchParams;
  const { data: profiles } = await (await createClient()).from("customer_profiles").select("id, name, is_default").eq("workspace_id", session.workspace.id).order("is_default", { ascending: false }).order("name");
  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view">
        <StrategyComposer key={typeof fresh === "string" ? fresh : "home"} profiles={profiles ?? []} />
      </div>
    </div>
  );
}
