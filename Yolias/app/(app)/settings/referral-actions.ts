"use server";

import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { referralSettings } from "@/lib/referrals";

// Settings → Referral (owner, 2026-10-28): the workspace's invite link and
// what it brought. Names of the people who joined are shortened (first name
// and an initial): they are other customers' accounts.

export interface ReferralState {
  enabled: boolean; link: string; reward: number; monthlyCap: number;
  joined: number; earned: number; thisMonth: number;
  recent: { name: string; at: string; status: "rewarded" | "capped" | "rejected"; prospects: number }[];
}

const short = (full: string | null) => {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ""}` : "";
};

export async function referralState(): Promise<ReferralState> {
  const s = await requireUser();
  const [settings, { data: rows }] = await Promise.all([
    referralSettings(),
    (await createClient()).from("referrals").select("referred_user_id, status, prospects, created_at").eq("referrer_workspace_id", s.workspace.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const list = rows ?? [];
  const ids = list.slice(0, 20).map((r) => r.referred_user_id);
  const { data: people } = ids.length ? await createAdminClient().from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = new Map((people ?? []).map((p) => [p.id, short(p.full_name)]));
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yolias.com").replace(/\/$/, "");
  return {
    enabled: settings.enabled, link: `${site}/i/${s.workspace.referral_code}`, reward: settings.prospects, monthlyCap: settings.monthlyCap,
    joined: list.filter((r) => r.status !== "rejected").length,
    earned: list.reduce((n, r) => n + r.prospects, 0),
    thisMonth: list.filter((r) => r.status === "rewarded" && Date.parse(r.created_at) >= month.getTime()).length,
    recent: list.slice(0, 20).map((r) => ({ name: name.get(r.referred_user_id) ?? "", at: r.created_at, status: r.status, prospects: r.prospects })),
  };
}
