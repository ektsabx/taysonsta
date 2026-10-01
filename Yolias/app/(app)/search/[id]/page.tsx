import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DiscoveryCard } from "@/components/app/DiscoveryCard";
import { StrategyComposer } from "@/components/app/StrategyComposer";
import { speechLang } from "@/lib/speech";
import { getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";
import { getStrategyView } from "@/services/strategies";

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

  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view">
        <StrategyComposer key={view.strategy.id} initialPrompt={view.strategy.prompt} speechLang={speechLang(await getLocale(), session.profile.country)} />
        <DiscoveryCard view={view} />
      </div>
    </div>
  );
}
