import { StrategyComposer } from "@/components/app/StrategyComposer";
import { requireViewer } from "@/lib/session";
import { firstName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default async function YoliasAiPage({ searchParams }: PageProps<"/">) {
  const session = await requireViewer();
  const { new: fresh } = await searchParams;
  const { data: profiles } = await (await createClient()).from("customer_profiles").select("id, name, is_default").eq("workspace_id", session.workspace.id).order("is_default", { ascending: false }).order("name");
  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view">
        <StrategyComposer key={typeof fresh === "string" ? fresh : "home"} profiles={profiles ?? []} firstName={firstName(session.profile.full_name)} />
      </div>
    </div>
  );
}
