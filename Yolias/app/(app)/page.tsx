import { StrategyComposer } from "@/components/app/StrategyComposer";
import { speechLang } from "@/lib/speech";
import { getLocale } from "@/lib/i18n/server";
import { requireSession } from "@/lib/session";

export default async function YoliasAiPage({ searchParams }: PageProps<"/">) {
  const session = await requireSession();
  const { new: fresh } = await searchParams;
  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view">
        <StrategyComposer key={typeof fresh === "string" ? fresh : "home"} speechLang={speechLang(await getLocale(), session.profile.country)} />
      </div>
    </div>
  );
}
