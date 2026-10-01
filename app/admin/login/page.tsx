import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { getUiPrefs } from "@/lib/bos/i18n/server";
import { getSetting } from "@/lib/bos/settings";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { UiPreferenceSwitches } from "@/components/bos/UiPreferences";

// Messages for Google sign-in failures coming back from the callback.
const googleErrors: Record<string, string> = {
  google_cancelled: "تم إلغاء الدخول عبر Google.",
  google_failed: "تعذر الدخول عبر Google. حاول مرة أخرى.",
  google_disabled: "الدخول عبر Google غير مفعّل.",
  google_domain: "نطاق البريد غير مسموح للدخول عبر Google.",
  no_employee: "هذا الحساب غير مرتبط بموظف في النظام.",
  not_staff: "هذا الحساب غير مرتبط بموظف في النظام.",
};

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getAdminUser();

  if (user) {
    redirect("/admin/dashboard");
  }

  const [ui, security, sp] = await Promise.all([getUiPrefs(), getSetting("security"), readParams(searchParams)]);
  const err = sp.error ? googleErrors[sp.error] ?? (sp.error.startsWith("inactive:") ? "حسابك غير نشط. تواصل مع الموارد البشرية أو مسؤول النظام." : null) : null;
  return (
    <div className="admin-login-shell">
      <div className="admin-login-card">
        <div style={{ marginBottom: 14 }}><UiPreferenceSwitches locale={ui.locale} theme={ui.theme} compact /></div>
        <div className="admin-login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/yolias-mark.png" alt="" width={26} height={28} />
          <span className="admin-sidebar-brand-text">YOLIAS <span className="admin-sidebar-brand-badge">Admin</span></span>
        </div>
        <h1>Yolias Admin</h1>
        <LoginForm googleEnabled={security.google_sign_in} initialError={err} />
      </div>
    </div>
  );
}
