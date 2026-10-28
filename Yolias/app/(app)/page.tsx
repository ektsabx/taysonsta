import { cookies } from "next/headers";
import { StrategyComposer } from "@/components/app/StrategyComposer";
import { TemplateOpened } from "@/components/app/TemplateOpened";
import { StartHere } from "@/components/app/StartHere";
import { requireViewer } from "@/lib/session";
import { firstName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { seoPage } from "@/lib/content/seo-store";
import { TEMPLATE_COOKIE } from "@/lib/content/seo-pages";
import { getLocale } from "@/lib/i18n/server";

export default async function YoliasAiPage({ searchParams }: PageProps<"/">) {
  const session = await requireViewer();
  const { new: fresh } = await searchParams;
  const db = await createClient();
  const ws = session.workspace.id;
  // Start here (owner, 2026-10-28): each step is done from real rows (RLS: the member's workspace).
  const [{ data: profiles }, mailboxes, searches, campaigns] = await Promise.all([
    db.from("customer_profiles").select("id, name, is_default").eq("workspace_id", ws).order("is_default", { ascending: false }).order("name"),
    db.from("mailboxes").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "connected"),
    db.from("strategies").select("id", { count: "exact", head: true }).eq("workspace_id", ws).neq("status", "chat"),
    db.from("outreach_campaigns").select("id", { count: "exact", head: true }).eq("workspace_id", ws).not("approved_at", "is", null),
  ]);
  // A prospecting template opened from the website (/start, D-257): its request waits in the composer.
  // The key stays the same when the cookie is cleared, so the request stays in the box.
  const slug = (await cookies()).get(TEMPLATE_COOKIE)?.value;
  const template = slug ? await seoPage("template", slug) : null;
  const prompt = template?.copy[await getLocale()].prompt ?? "";
  return (
    <div className="page-view">
      <header style={{ height: 44, flexShrink: 0 }} />
      <div className="chat-view">
        <StrategyComposer key={typeof fresh === "string" ? fresh : "home"} initialPrompt={prompt} profiles={profiles ?? []} firstName={firstName(session.profile.full_name)} below={<StartHere steps={{ mailbox: (mailboxes.count ?? 0) > 0, search: (searches.count ?? 0) > 0, campaign: (campaigns.count ?? 0) > 0 }} />} />
      </div>
      {slug && <TemplateOpened />}
    </div>
  );
}
