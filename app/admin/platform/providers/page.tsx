import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { capabilityLabel, intelCapabilities, settingKeys, settingLabel } from "@/lib/yolias/intel";
import { getIntelSettings, listProviders, providerStats } from "@/services/yolias/intel";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { SettingForm, ToggleProviderForm } from "./IntelForms";

// Provider registry (docs/03 "Provider registry", docs/09 §B "Providers").
// Rows appear when an adapter exists in Yolias code; nothing here is invented.
export default async function ProvidersPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المزودون" /><NotConnected /></>);
  const [providers, settings, stats] = await Promise.all([listProviders(), getIntelSettings(), providerStats(30)]);
  const manage = can(bos, "platform.manage", "all");
  const ready = (p: (typeof providers)[number]) => p.enabled && Boolean(p.credential_hint) && p.storage_allowed;

  return (
    <>
      <PageHeader title="المزودون" subtitle="سجل مزودي البيانات وطبقة الذكاء: التشغيل والأسعار والترخيص وبيانات الاعتماد" />
      <p className="bos-faint" style={{ fontSize: 12.5, margin: "0 0 12px" }}><Tx>كل الأرقام من السجلات الفعلية: الطلبات وتكلفتها من سجل استدعاءات المزود، ونسبة القبول = الشركات التي سُلّمت للعملاء ÷ الشركات التي جلبها المزود. الطلب بلا سعر معروف يظهر «غير مسعّر» ولا تُقدَّر تكلفته. الإيقاف والميزانية يطبَّقان على الخادم عند توجيه المهام.</Tx></p>

      <Card title="سجل المزودين (آخر 30 يومًا)" flush>
        {providers.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>المزود</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>القدرات</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>النتائج المعالجة</Tx></th><th><Tx>نسبة القبول</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>اليوم / الميزانية اليومية</Tx></th><th><Tx>الأولوية</Tx></th><th><Tx>بيانات الاعتماد</Tx></th><th><Tx>الصحة</Tx></th>{manage ? <th /> : null}</tr></thead>
              <tbody>
                {providers.map((p) => {
                  const h = (p.health ?? {}) as { consecutive_failures?: number; circuit_open_until?: string | null };
                  const open = h.circuit_open_until && new Date(h.circuit_open_until) > new Date();
                  const st = stats.get(p.id);
                  const usd = (v: number) => `$${v.toFixed(v >= 1 ? 2 : 4)}`;
                  const budget = p.daily_budget_usd == null ? null : Number(p.daily_budget_usd);
                  return (
                    <tr key={p.id}>
                      <td><Link className="bos-link" href={`/admin/platform/providers/${p.id}`}>{p.name}</Link><span className="cell-sub" dir="ltr">{p.id}</span></td>
                      <td>{ready(p) ? <StatusBadge tone="success" label="يعمل" /> : p.enabled ? <StatusBadge tone="warning" label="مفعّل وغير جاهز" /> : <StatusBadge tone="neutral" label="معطّل" />}</td>
                      <td style={{ fontSize: 12 }}>{p.capabilities.map((c) => <Tx key={c}>{capabilityLabel[c] ?? c}</Tx>).reduce<React.ReactNode[]>((a, el, i) => (i ? [...a, " · ", el] : [el]), [])}</td>
                      <td className="bos-num">{st ? num(st.calls) : "0"}{st && st.calls ? <span className="cell-sub"><Tx vars={{ n: num(st.okCalls) }}>{"{n} ناجح"}</Tx></span> : null}</td>
                      <td className="bos-num">{st ? num(st.records) : "0"}</td>
                      <td className="bos-num">{st && st.companies ? `${Math.round((st.delivered / st.companies) * 100)}%` : "—"}{st && st.companies ? <span className="cell-sub"><Tx vars={{ a: num(st.delivered), b: num(st.companies) }}>{"{a} من {b} شركة سُلّمت"}</Tx></span> : null}</td>
                      <td className="bos-num" dir="ltr">{st ? usd(st.costUsd) : "$0"}{st && st.calls ? <span className="cell-sub">{usd(st.costUsd / st.calls)} / call</span> : null}{st?.unpricedCalls ? <span className="cell-sub"><Tx vars={{ n: num(st.unpricedCalls) }}>{"+ {n} غير مسعّر"}</Tx></span> : null}</td>
                      <td className="bos-num" dir="ltr">{usd(st?.spentTodayUsd ?? 0)} / {budget == null ? <Tx>بلا حد</Tx> : usd(budget)}{budget != null && budget > 0 && (st?.spentTodayUsd ?? 0) >= budget ? <span className="cell-sub"><StatusBadge tone="danger" label="بلغ الحد — لا توجَّه إليه مهام جديدة اليوم" /></span> : null}</td>
                      <td className="bos-num">{p.priority}</td>
                      <td dir="ltr">{p.credential_hint ?? "—"}</td>
                      <td>{open ? <StatusBadge tone="danger" label="متوقف مؤقتاً" /> : (h.consecutive_failures ?? 0) > 0 ? <StatusBadge tone="warning" label={`${h.consecutive_failures} ✕`} /> : <StatusBadge tone="success" label="سليم" />}</td>
                      {manage ? <td><ToggleProviderForm id={p.id} enabled={p.enabled} /></td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </BosTable>
          </div>
        ) : (
          <EmptyState
            title="لا يوجد مزودون بعد"
            description="يظهر المزود هنا تلقائياً عند إضافة محوّل له في كود Yolias (المرحلة 4 — أول مزود فعلي، القرار D-003). لا نضيف مزودين وهميين."
          />
        )}
      </Card>

      <Card title="خريطة القدرات">
        <BosTable className="bos-table">
          <thead><tr><th><Tx>القدرة</Tx></th><th><Tx>المزودون الجاهزون</Tx></th><th><Tx>كل المزودين</Tx></th></tr></thead>
          <tbody>
            {intelCapabilities.map((c) => {
              const all = providers.filter((p) => p.capabilities.includes(c));
              const usable = all.filter(ready);
              return (
                <tr key={c}>
                  <td><Tx>{capabilityLabel[c]}</Tx><span className="cell-sub" dir="ltr">{c}</span></td>
                  <td>{usable.length ? usable.map((p) => p.name).join("، ") : <span className="bos-faint"><Tx>غير متصل</Tx></span>}</td>
                  <td>{all.length ? all.map((p) => p.name).join("، ") : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </BosTable>
      </Card>

      <Card title="إعدادات طبقة الذكاء">
        <div style={{ display: "grid", gap: 20 }}>
          {settingKeys.map((k) =>
            manage ? (
              <SettingForm key={k} settingKey={k} title={settingLabel[k].title} hint={settingLabel[k].hint} value={JSON.stringify(settings[k] ?? null, null, 2)} />
            ) : (
              <div key={k}>
                <strong><Tx>{settingLabel[k].title}</Tx></strong>
                <pre dir="ltr" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{JSON.stringify(settings[k] ?? null, null, 2)}</pre>
              </div>
            ),
          )}
        </div>
      </Card>
    </>
  );
}
