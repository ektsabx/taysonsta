import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AgentThread } from "@/components/app/AgentThread";
import { DiscoveryCard } from "@/components/app/DiscoveryCard";
import { YoliasMark } from "@/components/YoliasMark";
import { canManageTeam, requireSession } from "@/lib/session";
import { planLabel } from "@/lib/plans";
import { getDictionary } from "@/lib/i18n/server";
import { getStrategyView } from "@/services/strategies";
import { conversationFor } from "@/services/conversations";

export async function generateMetadata({ params }: PageProps<"/search/[id]">): Promise<Metadata> {
  const { id } = await params;
  const view = /^[0-9a-f-]{36}$/i.test(id) ? await getStrategyView(id) : null;
  return { title: view ? `${view.strategy.title} — Yolias` : "Yolias" };
}

export default async function StrategyPage({ params }: PageProps<"/search/[id]">) {
  const session = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const view = await getStrategyView(id);
  if (!view || view.strategy.workspace_id !== session.workspace.id) notFound();
  const [turns, t] = await Promise.all([conversationFor(view.strategy.id), getDictionary()]);
  // Campaigns Yolias AI started in this conversation show as cards under the reply that started them.
  const cards: Record<number, React.ReactNode> = {};
  for (const turn of turns) {
    if (!turn.campaigns?.length) continue;
    const views = (await Promise.all(turn.campaigns.map((c) => getStrategyView(view.strategy.id, c)))).filter((v) => v?.campaign);
    if (views.length) cards[turn.id] = <div className="thread-cards">{views.map((v) => <DiscoveryCard key={v!.campaign!.id} view={v!} />)}</div>;
  }

  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view search-chat">
        {/* One conversation (owner decision): the request, Yolias's search card,
            then every follow-up in the same thread with one composer below. */}
        <AgentThread
          key={`thread-${view.strategy.id}`}
          strategyId={view.strategy.id}
          initial={turns}
          cards={cards}
          plan={{ label: planLabel(session.workspace.plan, t), canUpgrade: session.workspace.plan !== "growth" && canManageTeam(session) }}
          lead={
            <>
              <li className="agent-turn user">
                <div className="agent-turn-body"><div className="agent-turn-text" dir="auto">{view.strategy.prompt}</div></div>
              </li>
              <li className="agent-turn assistant">
                <YoliasMark size={18} />
                <div className="agent-turn-body search-card-turn"><DiscoveryCard view={view} /></div>
              </li>
            </>
          }
        />
      </div>
    </div>
  );
}
