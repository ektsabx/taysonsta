"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

// Campaigns are created by Yolias AI from a strategy, so this opens a new strategy.
export function NewCampaignButton() {
  const router = useRouter();
  return (
    <button className="btn-primary" type="button" onClick={() => router.push(`/?new=${Date.now()}`)}>
      <Plus /> New Search Campaign
    </button>
  );
}
