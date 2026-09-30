"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ConfirmButton } from "@/components/bos/Dialog";
import { changeDealStageAction, markDealLostAction, markDealWonAction, archiveDealAction } from "../actions";

interface Stage {
  id: string;
  name: string;
  category: string;
}

export function DealStageControl({ dealId, currentStageId, stages, canReopen }: { dealId: string; currentStageId: string; stages: Stage[]; canReopen: boolean }) {
  const t = useT();
  const current = stages.find((s) => s.id === currentStageId);
  const [value, setValue] = useState(currentStageId);
  const [dialog, setDialog] = useState<"won" | "lost" | "reopen" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const closed = current?.category !== "open";

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "تعذر التنفيذ");
        setValue(currentStageId);
      } else {
        setError(null);
        setDialog(null);
        setReason("");
        router.refresh();
      }
    });
  }

  return (
    <div className="bos-stack" style={{ gap: 4 }}>
      <select
        aria-label={t("المرحلة")}
        value={value}
        disabled={pending || (closed && !canReopen)}
        onChange={(e) => {
          const stage = stages.find((s) => s.id === e.target.value);
          setValue(e.target.value);
          if (stage?.category === "won") setDialog("won");
          else if (stage?.category === "lost") setDialog("lost");
          else if (closed) setDialog("reopen");
          else run(() => changeDealStageAction(dealId, e.target.value));
        }}
        style={{ height: 34, background: "var(--bos-input)", color: "var(--bos-strong)", border: "1px solid rgba(var(--bos-fg-rgb), 0.14)", borderRadius: 7, padding: "0 8px" }}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}

      <Modal
        open={dialog === "won"}
        onClose={() => {
          setDialog(null);
          setValue(currentStageId);
        }}
        title="تأكيد كسب الصفقة"
        footer={
          <button type="button" className="admin-btn success" disabled={pending} aria-busy={pending} onClick={() => run(() => markDealWonAction(dealId))}>
            <Tx>{pending ? "جارٍ التنفيذ..." : "تأكيد — الصفقة مكسوبة"}</Tx>
          </button>
        }
      >
        <p style={{ fontSize: 13.5, lineHeight: 1.8 }}><Tx>سيقوم النظام تلقائياً وفي عملية واحدة بـ:</Tx></p>
        <ul style={{ fontSize: 13, lineHeight: 1.9, paddingInlineStart: 18 }}>
          <li><Tx>تفعيل الحساب وربط جهة الاتصال</Tx></li>
          <li><Tx>إنشاء المشروع بنفس النطاق والقيمة والعملة</Tx></li>
          <li><Tx>تعيين مدير المشروع والفريق وإنشاء المراحل والمهام</Tx></li>
          <li><Tx>إنشاء جدول الدفعات والفاتورة الأولى</Tx></li>
          <li><Tx>حساب أهلية العمولة وبدء تهيئة العميل</Tx></li>
          <li><Tx>إشعار المالية ومدير المشروع ومسؤول التطوير</Tx></li>
        </ul>
        <p className="bos-faint" style={{ fontSize: 12 }}><Tx>العملية آمنة للتكرار: لن يتم إنشاء مشروع أو فاتورة مكررة.</Tx></p>
        {error ? <div className="bos-form-error"><Tx>{error}</Tx></div> : null}
      </Modal>

      <Modal
        open={dialog === "lost" || dialog === "reopen"}
        onClose={() => {
          setDialog(null);
          setValue(currentStageId);
        }}
        title={dialog === "lost" ? "تسجيل خسارة الصفقة" : "إعادة فتح الصفقة"}
        footer={
          <button
            type="button"
            className={dialog === "lost" ? "admin-btn danger" : "admin-btn"}
            disabled={pending || !reason.trim()}
            onClick={() => run(() => (dialog === "lost" ? markDealLostAction(dealId, reason) : changeDealStageAction(dealId, value, reason)))}
          >
            <Tx>تأكيد</Tx>
          </button>
        }
      >
        <div className="bos-field">
          <label htmlFor="deal-reason">
            <Tx>{dialog === "lost" ? "سبب الخسارة" : "سبب إعادة الفتح"}</Tx>
            <span className="req">*</span>
          </label>
          <textarea id="deal-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error ? <div className="bos-form-error"><Tx>{error}</Tx></div> : null}
      </Modal>
    </div>
  );
}

export function MarkWonButton({ dealId }: { dealId: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <ConfirmButton
        label="تم الكسب (Won)"
        className="admin-btn small success"
        title="تأكيد كسب الصفقة"
        message="سيتم إنشاء المشروع وجدول الدفعات والفاتورة الأولى والعمولة وبدء تهيئة العميل تلقائياً. العملية لا تنشئ سجلات مكررة."
        confirmLabel="تأكيد"
        action={async () => {
          const r = await markDealWonAction(dealId);
          if (!r.ok) setError(r.error);
          return r;
        }}
      />
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </>
  );
}

export function ArchiveDealButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="أرشفة"
      className="admin-btn small danger"
      message="أرشفة الصفقة تخفيها من القوائم مع الاحتفاظ بكل السجلات المرتبطة."
      confirmLabel="أرشفة"
      action={archiveDealAction.bind(null, dealId)}
      onDone={() => router.push("/admin/sales/deals")}
    />
  );
}
