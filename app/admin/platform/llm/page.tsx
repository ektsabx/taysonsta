import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { getIntelSettings, llmUsage } from "@/services/yolias/intel";
import { platformHealth } from "@/services/yolias/health";
import { NotConnected, connected, num } from "@/components/yolias/PlatformUi";
import { PricesForm, RoutingForm } from "./LlmForms";

const usd4 = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

// Every place Yolias uses an LLM, the route for it (with fallback), what each
// model costs and what it was used for (final spec phase 9, D-008, D-118).
const tasks = [
  { id: "default", label: "الافتراضي", hint: "يُستخدم لأي مهمة ليس لها مسار خاص." },
  { id: "agent", label: "Yolias AI — التفكير والمحادثة", hint: "المحادثات واستخدام الأدوات. Claude أولاً." },
  { id: "research", label: "البحث على الويب", hint: "تلخيص مصادر الويب عن الشركات. Gemini أولاً." },
  { id: "extract", label: "الاستخراج والتصنيف", hint: "أصغر نموذج يجتاز الاختبارات: استخراج الحقول والتصنيف." },
  { id: "write", label: "كتابة رسائل التواصل", hint: "رسائل البريد الشخصية للعملاء المحتملين." },
  { id: "icp.parse", label: "فهم البحث (ICP)", hint: "تحويل طلب البحث إلى معايير منظّمة." },
];

export default async function LlmPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="النماذج اللغوية" /><NotConnected /></>);
  const [settings, usage, health] = await Promise.all([getIntelSettings(), llmUsage(30), platformHealth()]);
  const manage = can(bos, "platform.manage", "all");
  const keys = health.configured?.llm ?? null;
  const routing = (settings.llm_routing ?? { default: [] }) as Record<string, { provider: "anthropic" | "openai" | "gemini"; model: string }[]>;
  const prices = (settings.llm_prices ?? {}) as Record<string, { input: number; output: number }>;
  const unpricedModels = [...new Set(Object.values(routing).flat().map((r) => r.model))].filter((m) => !prices[m]);

  return (
    <>
      <PageHeader title="النماذج اللغوية" subtitle="مسار كل مهمة مع البدائل، أسعار النماذج، والاستخدام في آخر 30 يوماً" />
      <Card title="مفاتيح المزودين في Yolias">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {(["anthropic", "openai", "gemini"] as const).map((p) => (
            <span key={p} dir="ltr">{p} {keys == null ? <StatusBadge tone="neutral" label="غير معروف" /> : keys[p] ? <StatusBadge tone="success" label="مضبوط" /> : <StatusBadge tone="neutral" label="غير مضبوط" />}</span>
          ))}
        </div>
        <p className="bos-faint" style={{ fontSize: 12, marginTop: 8 }}><Tx>المفاتيح تُضبط في بيئة Yolias فقط ولا تظهر هنا. المسار الذي لا يوجد مفتاح لمزوده يُتخطى إلى التالي.</Tx></p>
      </Card>

      <Card title="المسارات حسب المهمة">
        {manage ? <RoutingForm initial={routing} tasks={tasks} /> : <pre dir="ltr" style={{ fontSize: 12 }}>{JSON.stringify(routing, null, 2)}</pre>}
      </Card>

      <Card title="أسعار النماذج">
        {unpricedModels.length > 0 && <p className="bos-faint" style={{ fontSize: 12, marginBottom: 8 }}><Tx vars={{ m: unpricedModels.join(", ") }}>{"نماذج في المسارات بلا سعر (تُسجَّل كغير مسعّرة): {m}"}</Tx></p>}
        {manage ? <PricesForm initial={prices} /> : <pre dir="ltr" style={{ fontSize: 12 }}>{JSON.stringify(prices, null, 2)}</pre>}
      </Card>

      <Card title="الاستخدام في آخر 30 يوماً">
        {usage.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>المهمة</Tx></th><th><Tx>النموذج</Tx></th><th><Tx>الطلبات</Tx></th><th><Tx>فشل</Tx></th><th><Tx>من الكاش</Tx></th><th><Tx>متوسط الزمن</Tx></th><th><Tx>التكلفة</Tx></th></tr></thead>
            <tbody>
              {usage.map((u) => (
                <tr key={`${u.task}|${u.model}`}>
                  <td dir="ltr">{u.task}</td>
                  <td dir="ltr">{u.model}</td>
                  <td className="bos-num">{num(u.calls)}</td>
                  <td className="bos-num">{num(u.failures)}</td>
                  <td className="bos-num">{num(u.cacheHits)}</td>
                  <td className="bos-num">{u.avgMs == null ? "—" : `${u.avgMs} ms`}</td>
                  <td className="bos-num">{usd4(u.cost)}{u.unpriced ? <span className="cell-sub"><Tx vars={{ n: num(u.unpriced) }}>{"+ {n} غير مسعّر"}</Tx></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات للنموذج اللغوي" />}
      </Card>
    </>
  );
}
