"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

// Filter a list by campaign (D-270): Prospects and Conversations. The choice is
// a query parameter, so links and the back button keep it.
export function CampaignFilter({ campaigns, param = "campaign" }: { campaigns: { id: string; name: string }[]; param?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  if (!campaigns.length) return null;
  const value = sp.get(param) ?? "";
  return (
    <label className="campaign-filter">
      <span>{t.camp.prospects.campaign}</span>
      <select className="sdr-input sm" value={value} onChange={(e) => {
        const q = new URLSearchParams(sp.toString());
        if (e.target.value) q.set(param, e.target.value); else q.delete(param);
        q.delete("page");
        router.push(`${pathname}${q.toString() ? `?${q}` : ""}`);
      }}>
        <option value="">{t.camp.prospects.anyCampaign}</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}
