import { requirePermission, can } from "@/lib/bos/auth";
import { readParams, pageOf, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { ExportLink } from "@/components/bos/ExportLink";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, MigrationNeeded, trackingReady, connected, Pager, qsFor, num } from "@/components/yolias/PlatformUi";
import { segmentLabel } from "@/components/yolias/AccountBits";
import { listAccounts, SEGMENTS, type AccountView } from "@/services/yolias/accounts";
import { AccountsTable } from "./AccountsTable";

// One list for the five Users pages (D-214): the page only sets the base
// filter; search, filters, sort and paging run on the server.

const titles: Record<AccountView, { title: string; subtitle: string }> = {
  all: { title: "كل المستخدمين", subtitle: "كل حسابات Yolias." },
  registered: { title: "المستخدمون المسجلون", subtitle: "حسابات لم تدفع أي اشتراك بعد، مع حالة التجربة ومحاولات الدفع. من دفع سابقًا يظهر في المشتركين." },
  subscribed: { title: "المستخدمون المشتركون", subtitle: "كل من بدأ تجربة أو اشتراكًا أو دفع سابقًا، بحالة الاشتراك المؤكدة في النظام." },
  suspended: { title: "المستخدمون الموقوفون", subtitle: "حسابات موقوفة أو موقوفة مؤقتًا. الإيقاف يمنع الدخول ويحتفظ بالبيانات، وهو مختلف عن الحظر وعن إيقاف الاشتراك." },
  banned: { title: "المستخدمون المحظورون", subtitle: "حسابات محظورة من الدخول، مع السبب ومن نفّذ الحظر." },
};

export async function UsersList({ view, searchParams }: { view: AccountView; searchParams: SearchParams }) {
  const { bos } = await requirePermission("platform.read");
  const head = titles[view];
  if (!connected()) return (<><PageHeader title={head.title} /><NotConnected /></>);
  if (!(await trackingReady())) return (<><PageHeader title={head.title} /><MigrationNeeded /></>);
  const manage = can(bos, "platform.manage", "all");
  const sp = await readParams(searchParams);
  const page = pageOf(sp);
  const filters = { q: sp.q, status: sp.status, sub: sp.sub, plan: sp.plan, country: sp.country, segment: sp.segment, from: sp.from, to: sp.to, sort: sp.sort, dir: sp.dir };
  const { rows, total, pages } = await listAccounts(view, filters, page);
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) as Record<string, string>;
  const base = `/admin/platform/users${view === "all" ? "/all" : `/${view}`}`;

  return (
    <>
      <PageHeader
        title={head.title}
        subtitle={<><Tx>{head.subtitle}</Tx> · <Tx vars={{ n: num(total) }}>{"{n} حساب"}</Tx></>}
        actions={manage ? <ExportLink href={`/admin/platform/users/export?${new URLSearchParams({ view, ...clean })}`}><Tx>تصدير CSV</Tx></ExportLink> : undefined}
      />
      <FilterBar
        searchPlaceholder="بحث بالاسم أو البريد أو الهاتف أو المعرّف"
        filters={[
          ...(view === "suspended" || view === "banned" ? [] : [{ key: "status", label: "حالة الحساب", type: "select" as const, options: [
            { value: "active", label: "نشط" }, { value: "suspended", label: "موقوف" }, { value: "paused", label: "موقوف مؤقتًا" }, { value: "banned", label: "محظور" }, { value: "deleted", label: "محذوف" },
          ] }]),
          { key: "sub", label: "حالة الاشتراك", type: "select", options: [
            { value: "none", label: "لم يشترك" }, { value: "trialing", label: "تجربة مجانية" }, { value: "active", label: "مدفوع نشط" },
            { value: "past_due", label: "دفع متأخر" }, { value: "canceled", label: "منتهٍ" }, { value: "test", label: "اختبار" },
          ] },
          { key: "plan", label: "الخطة", type: "select", options: [{ value: "pro", label: "Pro" }, { value: "growth", label: "Growth" }, { value: "scale", label: "Scale" }, { value: "free", label: "بدون خطة" }] },
          { key: "segment", label: "رحلة الاشتراك", type: "select", options: SEGMENTS.map((s) => ({ value: s, label: segmentLabel[s] ?? s })) },
          { key: "country", label: "الدولة (رمز من حرفين)", type: "text" },
          { key: "from", label: "تاريخ التسجيل من", type: "date" },
          { key: "to", label: "تاريخ التسجيل إلى", type: "date" },
          { key: "sort", label: "الترتيب", type: "select", options: [
            { value: "created", label: "تاريخ التسجيل" }, { value: "activity", label: "آخر نشاط" }, { value: "paid", label: "إجمالي المدفوعات" },
            { value: "trial_end", label: "انتهاء التجربة" }, { value: "period_end", label: "انتهاء الاشتراك" },
          ] },
          { key: "dir", label: "الاتجاه", type: "select", options: [{ value: "desc", label: "تنازلي" }, { value: "asc", label: "تصاعدي" }] },
        ]}
      />
      <Card flush>
        {rows.length ? (
          <AccountsTable rows={rows} total={total} view={view} filters={clean} canManage={manage} smsConnected={false} />
        ) : <EmptyState title="لا توجد حسابات مطابقة" description="غيّر الفلاتر أو البحث." />}
        <Pager page={page} pages={pages} href={qsFor(base, sp)} />
      </Card>
    </>
  );
}
