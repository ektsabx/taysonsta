import { Tx } from "@/components/bos/I18n";
import Link from "next/link";
import { getBosSession } from "@/lib/bos/auth";
import { signOutAction } from "@/app/admin/actions";

const reasons: Record<string, string> = {
  suspended: "تم إيقاف حسابك مؤقتاً. تواصل مع الموارد البشرية أو مسؤول النظام.",
  archived: "تمت أرشفة حسابك ولم يعد لديك وصول إلى النظام.",
  candidate: "حسابك لم يُفعّل بعد.",
  hired: "حسابك قيد الإعداد. ستصلك رسالة عند التفعيل.",
};

export default async function ForbiddenPage() {
  const session = await getBosSession();

  if (session.status === "ok") {
    return (
      <div className="bos-error-state" style={{ maxWidth: 520, margin: "60px auto" }}>
        <div className="title"><Tx>ليس لديك صلاحية لفتح هذه الصفحة</Tx></div>
        <p className="bos-muted" style={{ fontSize: 13, marginBottom: 14 }}>
          صلاحيات دورك الحالي ({session.bos.roleNames.join("، ") || "بدون دور"}) لا تسمح بهذا الإجراء. إذا كنت تحتاجه، اطلب من مسؤول النظام تعديل صلاحياتك.
        </p>
        <Link href="/admin/dashboard" className="admin-btn secondary">
          <Tx>العودة للوحة التحكم</Tx>
        </Link>
      </div>
    );
  }

  const message =
    session.status === "inactive"
      ? reasons[session.reason] ?? "حسابك غير نشط حالياً."
      : session.status === "not_staff"
        ? "هذا الحساب ليس حساب موظف. إذا كنت عميلاً استخدم بوابة العملاء."
        : "يجب تسجيل الدخول أولاً.";

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card" style={{ maxWidth: 420 }}>
        <h1><Tx>لا يمكن الوصول</Tx></h1>
        <p style={{ color: "rgba(var(--bos-fg-rgb), 0.7)", fontSize: 13.5, lineHeight: 1.7, marginBottom: 16 }}><Tx>{message}</Tx></p>
        <div className="bos-row">
          {session.status === "not_staff" ? (
            <Link href="/portal" className="admin-btn secondary">
              <Tx>بوابة العملاء</Tx>
            </Link>
          ) : null}
          {session.status === "anonymous" ? (
            <Link href="/admin/login" className="admin-btn">
              <Tx>تسجيل الدخول</Tx>
            </Link>
          ) : (
            <form action={signOutAction}>
              <button type="submit" className="admin-btn ghost">
                <Tx>تسجيل الخروج</Tx>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
