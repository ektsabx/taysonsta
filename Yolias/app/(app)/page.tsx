import { StrategyComposer } from "@/components/app/StrategyComposer";
import { requireSession } from "@/lib/session";

export default async function YoliasAiPage({ searchParams }: PageProps<"/">) {
  await requireSession();
  const { new: fresh } = await searchParams;
  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view">
        <StrategyComposer key={typeof fresh === "string" ? fresh : "home"} />
      </div>
    </div>
  );
}
