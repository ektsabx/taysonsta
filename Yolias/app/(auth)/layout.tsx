import { BrandLogo } from "@/components/BrandLogo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-brand"><BrandLogo /></div>
      <main className="auth-card">{children}</main>
    </div>
  );
}
