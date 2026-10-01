"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { retryStrategy, saveToProspects } from "@/app/(app)/actions";
import { useI18n } from "@/lib/i18n/client";

export function SaveToProspectsButton({ campaignId, alreadySaved, disabled }: { campaignId: string; alreadySaved: boolean; disabled: boolean }) {
  const { t } = useI18n();
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
      <span>{saved ? t.discovery.savedToProspects : t.discovery.saveToProspects}</span>
    </button>
  );
}

export function RetryStrategyButton({ strategyId }: { strategyId: string }) {
  const { t } = useI18n();
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
      <span>{pending ? t.common.retrying : t.common.tryAgain}</span>
    </button>
  );
}
