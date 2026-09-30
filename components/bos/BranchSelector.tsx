"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBranchAction } from "@/app/admin/_actions/branch";
import { useT, Opt } from "@/components/bos/I18n";

// Header branch selector (docs/bos/30 §3.2): narrows every branch-aware list
// to one branch or all branches the user may access. Enforced server-side.
export function BranchSelector({ branches, selected, allLabel }: { branches: { id: string; name: string }[]; selected: string | null; allLabel: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  const router = useRouter();
  if (branches.length < 2) return null;
  return (
    <select
      className="bos-branch-select"
      aria-label={t("الفرع")}
      value={selected ?? "all"}
      disabled={pending}
      onChange={(e) => start(async () => { await setBranchAction(e.target.value); router.refresh(); })}
    >
      <Opt value="all">{allLabel}</Opt>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
