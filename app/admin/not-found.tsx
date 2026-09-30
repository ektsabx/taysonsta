import { Tx } from "@/components/bos/I18n";
import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="bos-error-state" style={{ maxWidth: 520, margin: "40px auto", borderColor: "rgba(var(--bos-fg-rgb), 0.1)", background: "transparent" }}>
      <div className="title" style={{ color: "var(--bos-strong)" }}><Tx>السجل غير موجود</Tx></div>
      <p className="bos-muted" style={{ fontSize: 13, marginBottom: 14 }}>
        <Tx>ربما تم حذفه أو أرشفته، أو ليس لديك صلاحية لرؤيته.</Tx>
      </p>
      <Link href="/admin/dashboard" className="admin-btn secondary">
        <Tx>العودة للوحة التحكم</Tx>
      </Link>
    </div>
  );
}
