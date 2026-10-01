import { BrandLogo } from "@/components/BrandLogo";
import { LanguageMenu } from "@/components/LanguageMenu";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-brand"><BrandLogo /><LanguageMenu /></div>
      <main className="auth-card">{children}</main>
    </div>
  );
}
