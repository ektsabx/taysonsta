import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, MigrationNeeded, trackingReady, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { listAccounts } from "@/services/yolias/accounts";
import { AccountsTable } from "../../users/_shared/AccountsTable";

// Subscriptions (D-212): one row per account whose workspace has a subscription
// history (trial, paid, ended), from the confirmed subscription state. Opens
// the owner's User 360 for payments, renewals and cancellations.
export default async function SubscriptionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="الاشتراكات" /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title="الاشتراكات" /><MigrationNeeded /></>);
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const filters = { q: sp.q, sub: sp.sub, plan: sp.plan, sort: sp.sort ?? "period_end", dir: sp.dir ?? "asc" };
  const { rows, total, pages } = await listAccounts("subscribed", filters, page);
  return (
    <>
      <PageHeader title="الاشتراكات" subtitle={<Tx vars={{ n: num(total) }}>{"{n} حساب له اشتراك أو تجربة أو دفع سابق · الحالة من الاشتراك المؤكد"}</Tx>} />
      <FilterBar
        searchPlaceholder="بحث بالاسم أو البريد أو المعرّف"
        filters={[
          { key: "sub", label: "حالة الاشتراك", type: "select", options: [{ value: "trialing", label: "تجربة مجانية" }, { value: "active", label: "مدفوع نشط" }, { value: "past_due", label: "دفع متأخر" }, { value: "canceled", label: "منتهٍ" }, { value: "test", label: "اختبار" }] },
          { key: "plan", label: "الخطة", type: "select", options: [{ value: "pro", label: "Pro" }, { value: "growth", label: "Growth" }, { value: "scale", label: "Scale" }] },
          { key: "sort", label: "الترتيب", type: "select", options: [{ value: "period_end", label: "انتهاء الاشتراك" }, { value: "trial_end", label: "انتهاء التجربة" }, { value: "paid", label: "إجمالي المدفوعات" }, { value: "created", label: "تاريخ التسجيل" }] },
        ]}
      />
      <Card flush>
        {rows.length ? <AccountsTable rows={rows} total={total} view="subscribed" filters={Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>} canManage={can(bos, "platform.manage", "all")} smsConnected={false} /> : <EmptyState title="لا توجد اشتراكات" />}
        <Pager page={page} pages={pages} href={qsFor("/admin/platform/conversions/subscriptions", sp)} />
      </Card>
    </>
  );
}
