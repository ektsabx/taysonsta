import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { ProfilesView } from "@/components/app/ws/ProfilesView";

export async function generateMetadata(): Promise<Metadata> {
  return { title: `${(await getDictionary()).ws.ai.profiles.title} — Yolias` };
}

// AI Workspace → Customer Profiles (D-195): who Yolias looks for and how to
// talk to them. Used by searches (composer), campaigns, drafts and fit checks.
export default async function ProfilesPage() {
  const session = await requireSession();
  const [t, { data: profiles }] = await Promise.all([
    getDictionary(),
    (await createClient()).from("customer_profiles").select("*").eq("workspace_id", session.workspace.id).order("is_default", { ascending: false }).order("name"),
  ]);
  const p = t.ws.ai.profiles;
  return (
    <div className="page-view">
      <header className="view-header">
        <div className="view-title-group">
          <h2>{p.title}</h2>
          <p>{p.subtitle}</p>
        </div>
      </header>
      <div className="view-content-padding">
        <ProfilesView profiles={profiles ?? []} />
      </div>
    </div>
  );
}
