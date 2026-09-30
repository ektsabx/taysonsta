import { BosTable } from "@/components/bos/BosTable";
import { nowMs } from "@/lib/bos/clock";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { adsReport, listAdAccounts, organicVsPaid } from "@/services/bos/ads";
import { PageHeader, Card, KpiCard, EmptyState, Tabs } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";

const platformLabels: Record<string, string> = { meta: "Meta", google: "Google Ads", linkedin: "LinkedIn", tiktok: "TikTok", snapchat: "Snapchat", x: "X", other: "أخرى" };
const n = (v: number | null | undefined, d = 0) => (v == null ? null : v.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d }));
const money = (v: number | null | undefined, cur: string) => (v == null ? null : `${v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} ${cur}`);
const NA = () => <span className="bos-faint" style={{ fontSize: 11 }}><Tx>غير متاح</Tx></span>;

// Advertising analytics (docs/bos/30 §14–15): read-only numbers per currency,
// campaigns, trends, CSV export, organic vs paid side by side.
export default async function AdsPage({ searchParams }: { searchParams: SearchParams }) {
  const { bos } = await requirePermission("ads.read");
  const sp = await readParams(searchParams);
  const today = new Date().toISOString().slice(0, 10);
  const d = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  const from = d(sp.from) ?? new Date(nowMs() - 29 * 86400_000).toISOString().slice(0, 10);
  const to = d(sp.to) ?? today;
  const by = (["day", "week", "month"].includes(sp.by ?? "") ? sp.by : "day") as "day" | "week" | "month";
  const view = sp.view === "organic" ? "organic" : "report";
  const accounts = await listAdAccounts();
  const { data: camps } = sp.account ? await db().from("ad_campaigns").select("id, name").eq("account_id", sp.account).order("name") : { data: [] as { id: string; name: string }[] };
  const exportQs = new URLSearchParams(Object.entries({ from, to, platform: sp.platform ?? "", account: sp.account ?? "", campaign: sp.campaign ?? "" }).filter(([, v]) => v)).toString();
  return (
    <>
      <PageHeader title="الإعلانات" subtitle="قراءة وتحليل فقط — لا يغيّر النظام أي حملة أو ميزانية"
        actions={can(bos, "ads.export") && view === "report" ? <a className="admin-btn small secondary" href={`/api/bos/ads/export?${exportQs}`}><Tx>تنزيل CSV</Tx></a> : null} />
      <Tabs baseHref="/admin/ads" param="view" active={view} tabs={[{ key: "report", label: "الأداء" }, { key: "organic", label: "العضوي مقابل المدفوع" }]} />
      <FilterBar filters={[
        { key: "from", label: "من", type: "date" },
        { key: "to", label: "إلى", type: "date" },
        ...(view === "report" ? [
          { key: "platform", label: "المنصة", type: "select" as const, options: Object.entries(platformLabels).map(([value, label]) => ({ value, label })) },
          { key: "account", label: "الحساب", type: "select" as const, options: accounts.map((a) => ({ value: a.id, label: `${platformLabels[a.platform] ?? a.platform} · ${a.name} (${a.currency})` })) },
          ...(camps?.length ? [{ key: "campaign", label: "الحملة", type: "select" as const, options: camps.map((c) => ({ value: c.id, label: c.name })) }] : []),
          { key: "by", label: "التجميع", type: "select" as const, options: [{ value: "day", label: "يومي" }, { value: "week", label: "أسبوعي" }, { value: "month", label: "شهري" }] },
          { key: "convert", label: "العملة", type: "select" as const, options: [{ value: "1", label: "تحويل للعملة الأساسية" }] },
        ] : []),
      ]} />
      {!accounts.length ? <Card><EmptyState title="لا توجد حسابات إعلانية" description="اربط Meta أو Google Ads، أو أضف حساباً يُستورد من CSV." actions={can(bos, "ads.manage") ? <Link className="admin-btn small" href="/admin/settings/integrations/ads"><Tx>الحسابات الإعلانية</Tx></Link> : undefined} /></Card>
        : view === "organic" ? <Organic bos={bos} from={from} to={to} /> : <Report bos={bos} f={{ from, to, platform: sp.platform || null, account_id: sp.account || null, campaign_id: sp.campaign || null, by, convert: sp.convert === "1" }} />}
    </>
  );
}

async function Report({ bos, f }: { bos: Awaited<ReturnType<typeof requirePermission>>["bos"]; f: Parameters<typeof adsReport>[1] }) {
  const r = await adsReport(bos, f);
  return (
    <>
      {r.conversion ? (
        <Card><p className="bos-hint" style={{ margin: 0 }}><Tx vars={{ base: r.conversion.base }}>{"الأرقام محوّلة إلى {base} بأسعار الصرف المسجلة في الإعدادات:"}</Tx> {r.conversion.rates.map((x) => `${x.currency}→${r.conversion!.base} ${x.rate} (${x.date})`).join(" · ")}{r.conversion.noRate.length ? <> — <span className="bos-danger"><Tx>لا يوجد سعر صرف لـ</Tx> {r.conversion.noRate.join(", ")} <Tx>(مستبعدة من المجاميع)</Tx></span></> : null}</p></Card>
      ) : r.byCurrency.length > 1 ? <Card><p className="bos-hint" style={{ margin: 0 }}><Tx>الحسابات بعملات مختلفة — المجاميع معروضة لكل عملة على حدة ولا تُجمع. اختر «تحويل للعملة الأساسية» لعرضها بعملة واحدة بسعر صرف موثّق.</Tx></p></Card> : null}
      {r.byCurrency.map((t) => (
        <div key={t.currency} className="bos-kpis">
          <KpiCard label={`الإنفاق (${t.currency})`} value={money(t.spend, t.currency)} />
          <KpiCard label="مرات الظهور" value={n(t.impressions)} />
          <KpiCard label="النقرات" value={n(t.clicks)} sub={t.ctr != null ? `CTR ${t.ctr}%` : undefined} />
          <KpiCard label="التحويلات" value={t.conversions != null ? n(t.conversions, 0) : <NA />} sub={t.cpa != null ? `CPA ${money(t.cpa, t.currency)}` : undefined} />
          <KpiCard label="ROAS" value={t.roas != null ? `${t.roas}×` : <NA />} sub={t.conversionValue != null ? money(t.conversionValue, t.currency) ?? undefined : undefined} />
        </div>
      ))}
      <Card title="الحملات" flush>
        {r.campaigns.length ? (
          <div style={{ overflowX: "auto" }}>
            <BosTable className="bos-table">
              <thead><tr><th><Tx>الحملة</Tx></th><th><Tx>الحساب</Tx></th><th><Tx>الإنفاق</Tx></th><th><Tx>مرات الظهور</Tx></th>{r.single ? <th><Tx>الوصول</Tx></th> : null}<th><Tx>النقرات</Tx></th><th>CTR</th><th>CPC</th><th>CPM</th><th><Tx>التحويلات</Tx></th><th>CPA</th><th>ROAS</th></tr></thead>
              <tbody>
                {r.campaigns.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}{c.status ? <div className="bos-faint" style={{ fontSize: 11 }}>{c.status}</div> : null}</td>
                    <td style={{ fontSize: 12 }}>{platformLabels[c.platform] ?? c.platform} · {c.account}</td>
                    <td className="bos-num bos-nowrap">{money(c.spend, c.currency)}</td>
                    <td className="bos-num">{n(c.impressions)}</td>
                    {r.single ? <td className="bos-num">{c.reach != null ? n(c.reach) : <NA />}</td> : null}
                    <td className="bos-num">{n(c.clicks)}</td>
                    <td className="bos-num">{c.ctr != null ? `${c.ctr}%` : <NA />}</td>
                    <td className="bos-num">{c.cpc != null ? n(c.cpc, 2) : <NA />}</td>
                    <td className="bos-num">{c.cpm != null ? n(c.cpm, 2) : <NA />}</td>
                    <td className="bos-num">{c.conversions != null ? n(c.conversions, 0) : <NA />}</td>
                    <td className="bos-num">{c.cpa != null ? n(c.cpa, 2) : <NA />}</td>
                    <td className="bos-num">{c.roas != null ? `${c.roas}×` : <NA />}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد بيانات في هذه الفترة" />}
        {!r.single ? <p className="bos-hint" style={{ padding: "6px 14px" }}><Tx>الوصول لا يُجمع عبر الأيام (أشخاص فريدون) — اختر يوماً واحداً لعرضه.</Tx></p> : null}
      </Card>
      {r.trend.map((tr) => {
        const max = Math.max(1, ...tr.points.map((p) => p.spend));
        return (
          <Card key={tr.currency} title={<Tx vars={{ cur: tr.currency }}>{"الاتجاه — الإنفاق مقابل النتائج ({cur})"}</Tx>} flush>
            <BosTable className="bos-table">
              <thead><tr><th><Tx>الفترة</Tx></th><th><Tx>الإنفاق</Tx></th><th /><th><Tx>النقرات</Tx></th><th><Tx>التحويلات</Tx></th><th>CPA</th><th>ROAS</th></tr></thead>
              <tbody>
                {tr.points.map((p) => (
                  <tr key={p.period}>
                    <td className="bos-nowrap" dir="ltr">{p.period}</td>
                    <td className="bos-num bos-nowrap">{money(p.spend, tr.currency)}</td>
                    <td style={{ width: "30%" }}><div style={{ height: 8, borderRadius: 4, background: "var(--bos-accent)", width: `${Math.round((p.spend / max) * 100)}%`, opacity: 0.7 }} /></td>
                    <td className="bos-num">{n(p.clicks)}</td>
                    <td className="bos-num">{p.conversions != null ? n(p.conversions, 0) : <NA />}</td>
                    <td className="bos-num">{p.cpa != null ? n(p.cpa, 2) : <NA />}</td>
                    <td className="bos-num">{p.roas != null ? `${p.roas}×` : <NA />}</td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </Card>
        );
      })}
      <Card title="حالة المزامنة" flush>
        <BosTable className="bos-table">
          <tbody>{r.accounts.map((a) => <tr key={a.id}><td>{platformLabels[a.platform] ?? a.platform} · {a.name} ({a.currency})</td><td><Tx>{a.mode === "api" ? "مزامنة تلقائية" : "استيراد CSV"}</Tx></td><td>{a.last_sync_at ? formatDateTime(a.last_sync_at) : "—"}</td><td className="bos-danger" style={{ fontSize: 12 }}>{a.last_error ?? ""}</td></tr>)}</tbody>
        </BosTable>
      </Card>
    </>
  );
}

async function Organic({ bos, from, to }: { bos: Awaited<ReturnType<typeof requirePermission>>["bos"]; from: string; to: string }) {
  const r = await organicVsPaid(bos, from, to);
  return (
    <>
      <Card><p className="bos-hint" style={{ margin: 0 }}><Tx>العضوي (منشورات التواصل الاجتماعي) والمدفوع (الإعلانات) يُعرضان منفصلين ولا يُجمعان في رقم واحد: تعريفات الظهور والنقرات تختلف، والجمهور قد يتداخل. الربط بينهما يظهر فقط حين يكون الإعلان يروّج لمنشورنا نفسه.</Tx></p></Card>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <Card title="العضوي">
          <div className="bos-kpis">
            <KpiCard label="منشورات" value={r.organic.posts} />
            <KpiCard label="مرات الظهور" value={r.organic.hasImpressions ? n(r.organic.impressions) : <NA />} />
            <KpiCard label="الإعجابات" value={n(r.organic.likes)} />
            <KpiCard label="التعليقات" value={n(r.organic.comments)} />
            <KpiCard label="النقرات" value={r.organic.hasClicks ? n(r.organic.clicks) : <NA />} />
          </div>
          <Link href={`/admin/social?period=custom&from=${from}&to=${to}`}><Tx>تحليلات التواصل الاجتماعي</Tx></Link>
        </Card>
        <Card title="المدفوع">
          {r.paid.length ? r.paid.map((t) => (
            <div key={t.currency} className="bos-kpis">
              <KpiCard label={`الإنفاق (${t.currency})`} value={money(t.spend, t.currency)} />
              <KpiCard label="مرات الظهور" value={n(t.impressions)} />
              <KpiCard label="النقرات" value={n(t.clicks)} />
              <KpiCard label="التحويلات" value={t.conversions != null ? n(t.conversions, 0) : <NA />} />
            </div>
          )) : <p className="bos-hint"><Tx>لا توجد بيانات إعلانية في الفترة.</Tx></p>}
        </Card>
      </div>
      <Card title="منشورات عليها إعلانات (علاقة فعلية)" flush>
        {r.linked.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المنشور</Tx></th><th><Tx>الإعلان</Tx></th><th><Tx>عضوي: ظهور / إعجابات</Tx></th><th><Tx>مدفوع: إنفاق / ظهور / نقرات</Tx></th></tr></thead>
            <tbody>
              {r.linked.map((l) => (
                <tr key={l.adId}>
                  <td>{l.postId ? <Link href={`/admin/social/posts/${l.postId}`}>{l.postTitle}</Link> : l.postTitle}</td>
                  <td>{l.adName}</td>
                  <td className="bos-num">{l.organic.impressions != null ? n(l.organic.impressions) : "—"} / {l.organic.likes != null ? n(l.organic.likes) : "—"}</td>
                  <td className="bos-num">{l.paid ? `${money(l.paid.spend, l.paid.currency)} / ${n(l.paid.impressions)} / ${n(l.paid.clicks)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <p className="bos-hint" style={{ padding: 12 }}><Tx>لا توجد إعلانات تروّج لمنشورات منشورة من النظام (يُربط الإعلان تلقائياً حين يستخدم منشور الصفحة نفسه).</Tx></p>}
      </Card>
    </>
  );
}
