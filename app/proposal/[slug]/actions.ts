"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProposalForClient } from "@/services/proposals-public";
import { acceptProposal, rejectProposal } from "@/services/bos/proposal-lifecycle";
import { toUserMessage } from "@/lib/bos/errors";

export interface ProposalLoginState {
  error: string | null;
}

export async function signInProposalAction(
  slug: string,
  _prevState: ProposalLoginState,
  formData: FormData
): Promise<ProposalLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "أدخل البريد الإلكتروني وكلمة المرور" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "بيانات الدخول غير صحيحة" };
  }

  redirect(`/proposal/${slug}`);
}

export interface DecisionState {
  ok: boolean;
  error: string | null;
}

// The client's decision. Ownership is re-proved via the RLS-scoped query
// (the session can only read its own proposal) before any write.
export async function clientDecisionAction(slug: string, _prev: DecisionState, formData: FormData): Promise<DecisionState> {
  const decision = String(formData.get("decision") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "انتهت الجلسة، سجّل الدخول مرة أخرى." };

  const proposal = await getProposalForClient(slug);
  if (!proposal) return { ok: false, error: "لا يمكنك الوصول إلى هذا المقترح." };

  try {
    if (decision === "accept") {
      await acceptProposal(proposal.id, { userId: null, onBehalf: false, clientUserId: user.id });
    } else if (decision === "reject") {
      if (!reason) return { ok: false, error: "يرجى كتابة سبب الرفض لمساعدتنا على تحسين العرض." };
      await rejectProposal(proposal.id, reason, { userId: null, onBehalf: false, clientUserId: user.id });
    } else {
      return { ok: false, error: "قرار غير صالح." };
    }
  } catch (error) {
    return { ok: false, error: toUserMessage(error) };
  }
  revalidatePath(`/proposal/${slug}`);
  return { ok: true, error: null };
}
