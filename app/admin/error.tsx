"use client";

import { Tx } from "@/components/bos/I18n";

import Link from "next/link";
import { useEffect } from "react";

// Understandable error state with recovery actions instead of "Error 500" (§73).
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bos-error-state" role="alert" style={{ maxWidth: 560, margin: "40px auto" }}>
      <div className="title"><Tx>تعذر تحميل هذه الصفحة</Tx></div>
      <p className="bos-muted" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
        <Tx>حدث خطأ غير متوقع أثناء جلب البيانات. لم يتم فقدان أي بيانات محفوظة. يمكنك إعادة المحاولة، وإذا تكرر الخطأ أرسل الرمز أدناه للدعم الفني.</Tx>
      </p>
      {error.digest ? (
        <p className="bos-faint" style={{ fontSize: 12, marginBottom: 14 }}>
          <Tx>رمز الخطأ:</Tx> <code>{error.digest}</code>
        </p>
      ) : null}
      <div className="bos-row" style={{ justifyContent: "center" }}>
        <button type="button" className="admin-btn" onClick={reset}>
          <Tx>إعادة المحاولة</Tx>
        </button>
        <Link href="/admin/dashboard" className="admin-btn secondary">
          <Tx>لوحة التحكم</Tx>
        </Link>
      </div>
    </div>
  );
}
