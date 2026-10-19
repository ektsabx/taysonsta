import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerDirectoryRow, PartnerRole } from "@/types/database";

// Partner network on /affiliates (owner brief 2026-10-19). Only partners who
// chose to be listed (Partners → Profile) and are approved appear. Name and
// photo are their own; level and success rate come from real referrals and
// confirmed payments — never typed in by hand.

export const PARTNER_ROLES: PartnerRole[] = ["influencer", "creator", "entrepreneur", "agency", "consultant", "educator", "community"];
export const isPartnerRole = (v: unknown): v is PartnerRole => typeof v === "string" && (PARTNER_ROLES as string[]).includes(v);

/** Partnership level by paying customers referred. */
export type PartnerTier = "partner" | "silver" | "gold" | "platinum";
export const TIER_MIN_PAYING: Record<PartnerTier, number> = { partner: 0, silver: 3, gold: 10, platinum: 25 };
export function partnerTier(paying: number): PartnerTier {
  return paying >= TIER_MIN_PAYING.platinum ? "platinum" : paying >= TIER_MIN_PAYING.gold ? "gold" : paying >= TIER_MIN_PAYING.silver ? "silver" : "partner";
}

/** A success rate is shown only once there are enough referrals for it to mean something. */
export const MIN_REFERRALS_FOR_RATE = 5;
export function successRate(referrals: number, paying: number): number | null {
  return referrals >= MIN_REFERRALS_FOR_RATE ? Math.round((Math.min(paying, referrals) / referrals) * 100) : null;
}

export interface DirectoryPartner {
  id: string;
  name: string;
  photo: string | null;
  role: PartnerRole | null;
  country: string | null;
  tier: PartnerTier;
  rate: number | null;
}

const MAX = 24;

export async function partnerDirectory(): Promise<DirectoryPartner[]> {
  try {
    const { data } = await createAdminClient().from("partner_directory_v").select("*").limit(200);
    return ((data ?? []) as PartnerDirectoryRow[])
      .filter((r) => r.full_name?.trim())
      .map((r) => ({
        id: r.id,
        name: r.full_name!.trim(),
        photo: r.avatar_url,
        role: r.partner_role,
        country: r.country,
        tier: partnerTier(Number(r.paying)),
        rate: successRate(Number(r.referrals), Number(r.paying)),
        paying: Number(r.paying),
        since: r.created_at,
      }))
      // Most paying customers first, then the longest-standing partners.
      .sort((a, b) => b.paying - a.paying || a.since.localeCompare(b.since))
      .slice(0, MAX)
      .map((p): DirectoryPartner => ({ id: p.id, name: p.name, photo: p.photo, role: p.role, country: p.country, tier: p.tier, rate: p.rate }));
  } catch {
    return [];
  }
}
