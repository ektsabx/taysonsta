import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { listAccounts } from "@/services/bos/social";
import { platforms, platformKeys, type Platform } from "@/lib/bos/social/platforms";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { SubNav } from "@/components/bos/SubNav";
import { socialNav } from "../social-nav";
import { AccountRowControls, AddAccountButtons } from "../SocialControls";

const statusLabel: Record<string, { label: string; tone: "success" | "danger" | "neutral" | "warning" }> = { connected: { label: "متصل", tone: "success" }, error: { label: "خطأ في الاتصال", tone: "danger" }, disconnected: { label: "مفصول", tone: "neutral" }, manual: { label: "يدوي", tone: "warning" } };

// Connected social accounts (docs/bos/30 §12.1) + the platform capability
// matrix (what is published by API vs manually, and why).
export default async function SocialAccountsPage() {
  const { bos } = await requirePermission("social.manage");
  const [accounts, { data: fol }] = await Promise.all([listAccounts(), db().from("social_account_metrics").select("account_id, value, day").eq("metric", "followers").order("day", { ascending: false }).limit(500)]);
  const latest = new Map<string, number>();
  for (const f of fol ?? []) if (!latest.has(f.account_id)) latest.set(f.account_id, Number(f.value));
  return (
    <>
      <PageHeader title="الحسابات المتصلة" subtitle="حسابات تُنشر تلقائياً عبر الواجهات الرسمية، وحسابات تُسجّل يدوياً" breadcrumbs={[{ label: "التسويق" }, { label: "الحسابات" }]} actions={<AddAccountButtons platforms={platformKeys.map((p) => ({ value: p, label: platforms[p].label }))} />} />
      <SubNav items={socialNav(bos)} active="accounts" label="التواصل الاجتماعي" />
      <Card flush>
        {accounts.length ? (
          <table className="bos-table">
            <thead><tr><th><Tx>المنصة</Tx></th><th><Tx>الحساب</Tx></th><th><Tx>الطريقة</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>المتابعون</Tx></th><th><Tx>آخر مزامنة</Tx></th><th><Tx>تاريخ الربط</Tx></th><th /></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td><Tx>{platforms[a.platform as Platform]?.label ?? a.platform}</Tx></td>
                  <td>{a.profile_url ? <a href={a.profile_url} target="_blank" rel="noreferrer">{a.name}</a> : a.name}{a.handle ? <span className="bos-faint" dir="ltr"> {a.handle}</span> : null}</td>
                  <td><Tx>{a.mode === "api" ? "نشر تلقائي (API)" : "يدوي"}</Tx></td>
                  <td>{a.is_active ? <StatusBadge tone={statusLabel[a.status]?.tone ?? "neutral"} label={statusLabel[a.status]?.label ?? a.status} /> : <StatusBadge tone="neutral" label="مفصول" />}{a.last_error ? <div className="bos-faint" style={{ fontSize: 11 }} title={a.last_error}>{a.last_error.slice(0, 80)}</div> : null}</td>
                  <td className="bos-num">{latest.has(a.id) ? latest.get(a.id)!.toLocaleString("en-US") : <span className="bos-faint"><Tx>غير متاح</Tx></span>}</td>
                  <td>{a.last_sync_at ? formatDateTime(a.last_sync_at) : "—"}</td>
                  <td>{formatDateTime(a.connected_at)}</td>
                  <td><AccountRowControls id={a.id} active={a.is_active} api={a.mode === "api"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <EmptyState title="لا توجد حسابات بعد" description="استورد صفحاتك من Meta، أضف قناة تيليجرام، أو أضف حساباً يدوياً." />}
      </Card>
      <Card title="ما الذي يدعمه النظام لكل منصة" flush>
        <table className="bos-table">
          <thead><tr><th><Tx>المنصة</Tx></th><th><Tx>النشر</Tx></th><th><Tx>حد النص</Tx></th><th><Tx>الأرقام التلقائية</Tx></th><th><Tx>ملاحظات</Tx></th></tr></thead>
          <tbody>
            {platformKeys.map((p) => (
              <tr key={p}>
                <td><Tx>{platforms[p].label}</Tx></td>
                <td>{platforms[p].publish === "api" ? <StatusBadge tone="success" label="تلقائي" /> : <StatusBadge tone="neutral" label="يدوي" />}</td>
                <td className="bos-num">{platforms[p].textMax.toLocaleString("en-US")}</td>
                <td>{platforms[p].metrics.length ? platforms[p].metrics.join(", ") : <span className="bos-faint"><Tx>غير متاح — إدخال يدوي</Tx></span>}</td>
                <td style={{ fontSize: 12.5 }}><Tx>{platforms[p].note}</Tx></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="bos-hint" style={{ padding: "8px 14px" }}><Tx>المفاتيح تُدخل من</Tx> <Link href="/admin/settings/integrations"><Tx>مركز التكاملات</Tx></Link> (Meta، Telegram Bot).</p>
      </Card>
    </>
  );
}
