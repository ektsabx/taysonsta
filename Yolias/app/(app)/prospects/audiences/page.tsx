import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireViewer } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { AudiencesView } from "@/components/app/campaigns/AudiencesView";
import type { Targeting } from "@/lib/campaigns/targeting";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).camp.aud.title} | Yolias` };
}

// Audiences (owner, 2026-10-31, D-272): saved targeting and custom lists, in Prospects.
export default async function AudiencesPage() {
  const session = await requireViewer();
  const ws = session.workspace.id;
  const db = await createClient();
  const [t, { data: audiences }, { data: campaigns }] = await Promise.all([
    getDictionary(),
    db.from("audiences").select("id, name, kind, targeting, origin, members, updated_at").eq("workspace_id", ws).order("updated_at", { ascending: false }),
    db.from("outreach_campaigns").select("id, name").eq("workspace_id", ws).neq("status", "draft").order("created_at", { ascending: false }).limit(100),
  ]);
  return (
    <div className="sdr-page">
      <div><Link className="sdr-back" href="/prospects"><ChevronLeft className="flip-rtl" />{t.prospects.title}</Link></div>
      <header className="sdr-head"><div><h2>{t.camp.aud.title}</h2><p>{t.camp.aud.subtitle}</p></div></header>
      <AudiencesView audiences={(audiences ?? []).map((a) => ({ ...a, targeting: a.targeting as Targeting }))} campaigns={campaigns ?? []} />
    </div>
  );
}
