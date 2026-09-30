"use client";

import { Tx } from "@/components/bos/I18n";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProposalStatus } from "@/types/database";
import { getStatusBadgeInfo } from "@/lib/proposal-status";
import { ConfirmButton } from "@/components/bos/Dialog";
import {
  markReadyAction,
  backToDraftAction,
  publishProposalAction,
  archiveProposalAction,
  duplicateProposalAction,
  recordClientDecisionAction,
  type PublishState,
} from "../../actions";

const initialPublishState: PublishState = { errors: [] };

export function StatusActions({
  proposalId,
  status,
  isArchived,
  publishedAt,
  lastViewedAt,
  viewCount,
  dealId,
  validUntil,
  version,
}: {
  proposalId: string;
  status: ProposalStatus;
  isArchived: boolean;
  publishedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  dealId?: string | null;
  validUntil?: string | null;
  version?: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [publishState, publishAction, publishPending] = useActionState(publishProposalAction, initialPublishState);
  const router = useRouter();
  const badge = getStatusBadgeInfo(status);
  const closed = ["accepted", "rejected", "expired"].includes(status);
  const sent = ["published", "viewed"].includes(status);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "تعذر التنفيذ");
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="bos-card">
      <div className="bos-card-header">
        <h2><Tx>الحالة والإجراءات</Tx></h2>
        <span className={`admin-badge ${badge.className}`}><Tx>{badge.label}</Tx></span>
      </div>
      <div className="bos-card-body bos-stack">
        {isArchived ? <span className="admin-badge"><Tx>مؤرشف</Tx></span> : null}
        <div className="bos-faint" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
          {publishedAt ? <div>أول إرسال: {new Date(publishedAt).toLocaleString("en-GB")}</div> : null}
          <div>
            المشاهدات: {viewCount}
            {lastViewedAt ? ` · آخر مشاهدة: ${new Date(lastViewedAt).toLocaleString("en-GB")}` : ""}
          </div>
          {validUntil ? <div><Tx vars={{ validUntil }}>{"صالح حتى: {validUntil}"}</Tx></div> : null}
          {version ? <div><Tx vars={{ version }}>{"الإصدار: v{version}"}</Tx></div> : null}
        </div>

        {status === "draft" ? (
          <button type="button" className="admin-btn secondary" disabled={pending} onClick={() => run(() => markReadyAction(proposalId))}>
            <Tx>إرسال للمراجعة الداخلية</Tx>
          </button>
        ) : null}
        {status === "ready" || sent ? (
          <button type="button" className="admin-btn ghost" disabled={pending} onClick={() => run(() => backToDraftAction(proposalId))}>
            <Tx>الرجوع إلى مسودة</Tx>
          </button>
        ) : null}

        {!closed ? (
          <form action={publishAction}>
            <input type="hidden" name="proposalId" value={proposalId} />
            <button type="submit" className="admin-btn" disabled={publishPending} style={{ width: "100%", justifyContent: "center" }} aria-busy={publishPending}>
              <Tx>{publishPending ? "جارِ الإرسال..." : sent ? "تحديث وإعادة الإرسال" : "إرسال للعميل (نشر)"}</Tx>
            </button>
          </form>
        ) : null}
        {publishState.errors.length > 0 ? (
          <div className="bos-form-error">
            {publishState.errors.map((err) => (
              <div key={err}><Tx>{err}</Tx></div>
            ))}
          </div>
        ) : null}

        {sent ? (
          <div className="bos-row">
            <ConfirmButton
              label="تسجيل قبول العميل"
              className="admin-btn small success"
              message="تسجيل أن العميل قبل المقترح (نيابةً عنه)؟ سيتم إغلاق المقترحات الأخرى لنفس الصفقة ونقل الصفقة لمرحلة التفاوض."
              action={() => recordClientDecisionAction(proposalId, "accepted")}
            />
            <ConfirmButton
              label="تسجيل رفض العميل"
              className="admin-btn small danger"
              message="تسجيل رفض العميل للمقترح؟"
              requireReason
              reasonLabel="سبب الرفض"
              action={(reason) => recordClientDecisionAction(proposalId, "rejected", reason)}
            />
          </div>
        ) : null}

        {status === "accepted" && dealId ? (
          <Link href={`/admin/sales/contracts/new?dealId=${dealId}&proposalId=${proposalId}`} className="admin-btn success" style={{ justifyContent: "center" }}>
            <Tx>إنشاء العقد</Tx>
          </Link>
        ) : null}

        <a href={`/proposal-preview/${proposalId}`} target="_blank" rel="noreferrer" className="admin-btn secondary" style={{ justifyContent: "center" }}>
          <Tx>معاينة</Tx>
        </a>
        <button type="button" className="admin-btn secondary" disabled={pending} onClick={() => startTransition(() => duplicateProposalAction(proposalId))}>
          <Tx>نسخة جديدة</Tx>
        </button>
        <button type="button" className="admin-btn danger" disabled={pending} onClick={() => run(() => archiveProposalAction(proposalId, !isArchived))}>
          <Tx>{isArchived ? "إلغاء الأرشفة" : "أرشفة"}</Tx>
        </button>
        {error ? <div className="bos-form-error"><Tx>{error}</Tx></div> : null}
      </div>
    </div>
  );
}
