import { redirect } from "next/navigation";
import { getPortalUser } from "@/lib/bos/portal-auth";
import { PortalLoginForm } from "./LoginForm";

export default async function PortalLoginPage() {
  if (await getPortalUser()) redirect("/portal");
  return (
    <div className="portal-login">
      <div className="portal-card">
        <h1 style={{ fontSize: 22, marginTop: 0 }}>بوابة عملاء تايسونستا</h1>
        <p className="portal-muted">تابع مشاريعك وموافقاتك وفواتيرك وتواصل مع فريقك.</p>
        <PortalLoginForm />
      </div>
    </div>
  );
}
