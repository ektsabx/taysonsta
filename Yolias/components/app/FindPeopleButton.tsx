"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/config";
import { useToast } from "@/components/Toast";
import { findDecisionMakersAction } from "@/app/(app)/prospects/actions";

export function FindPeopleButton({ id, tab, disabled }: { id: string; tab: "companies" | "local"; disabled: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn-primary" type="button" disabled={disabled || pending} onClick={() => start(async () => {
      const r = await findDecisionMakersAction({ ids: [id] }, tab);
      if (r.ok) toast(fmt(t.prospects.findPeopleQueued, { count: 1 }));
      router.refresh();
    })}>
      <UsersRound /> {t.prospects.findPeople}
    </button>
  );
}
