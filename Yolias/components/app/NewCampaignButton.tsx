"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

// Campaigns are created by Yolias AI from a strategy, so this opens a new strategy.
export function NewCampaignButton() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <button className="btn-primary" type="button" onClick={() => router.push(`/?new=${Date.now()}`)}>
      <Plus /> {t.campaigns.newCampaign}
    </button>
  );
}
