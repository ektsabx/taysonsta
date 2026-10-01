"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { retryStrategy, saveToProspects } from "@/app/(app)/actions";

export function SaveToProspectsButton({ campaignId, alreadySaved, disabled }: { campaignId: string; alreadySaved: boolean; disabled: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(alreadySaved);
  const [pending, start] = useTransition();

  return (
    <button
      className="btn-primary"
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        if (saved) return router.push("/prospects");
        start(async () => {
          await saveToProspects(campaignId);
          setSaved(true);
          setTimeout(() => router.push("/prospects"), 500);
        });
      }}
    >
      <Check />
      <span>{saved ? "Saved to Prospects" : "Save to Prospects"}</span>
    </button>
  );
}

export function RetryStrategyButton({ strategyId }: { strategyId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-primary"
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await retryStrategy(strategyId); router.refresh(); })}
    >
      <RotateCcw />
      <span>{pending ? "Retrying…" : "Try again"}</span>
    </button>
  );
}
