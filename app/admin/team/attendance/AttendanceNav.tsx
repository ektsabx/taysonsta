import { Tx } from "@/components/bos/I18n";
import { getT } from "@/lib/bos/i18n/server";
import Link from "next/link";

const items = [
  { href: "/admin/team/attendance", key: "today", label: "اليوم" },
  { href: "/admin/team/attendance/me", key: "me", label: "حضوري" },
  { href: "/admin/team/attendance/employees", key: "employees", label: "الموظفون" },
  { href: "/admin/team/attendance/corrections", key: "corrections", label: "التصحيحات" },
  { href: "/admin/team/timesheets", key: "timesheets", label: "سجلات الوقت" },
  { href: "/admin/team/overtime", key: "overtime", label: "العمل الإضافي" },
  { href: "/admin/team/attendance/reports", key: "reports", label: "التقارير" },
];

export async function AttendanceNav({ active, hide = [] }: { active: string; hide?: string[] }) {
  const t = await getT();
  return (
    <nav className="bos-tabs" aria-label={t("أقسام الحضور")}>
      {items.filter((i) => !hide.includes(i.key)).map((i) => (
        <Link key={i.key} href={i.href} className={i.key === active ? "active" : undefined} aria-current={i.key === active ? "page" : undefined}>
          <Tx>{i.label}</Tx>
        </Link>
      ))}
    </nav>
  );
}
