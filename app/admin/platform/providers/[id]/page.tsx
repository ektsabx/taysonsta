import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/bos/auth";
import { PageHeader, Card, KeyValues, StatusBadge, EmptyState } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { yintel } from "@/lib/yolias/db";
import { capabilityLabel } from "@/lib/yolias/intel";
import { getProvider } from "@/services/yolias/intel";
import { NotConnected, connected, usd } from "@/components/yolias/PlatformUi";
import { CredentialForm, ProviderForm } from "../IntelForms";

export default async function ProviderPage({ params }: PageProps<"/admin/platform/providers/[id]">) {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="المزود" /><NotConnected /></>);
  const { id } = await params;
  if (!/^[a-z0-9_]{2,40}$/.test(id)) notFound();
  const p = await getProvider(id);
  if (!p) notFound();
  const manage = can(bos, "platform.manage", "all");
  const { data: calls } = await yintel().from("provider_calls").select("id, capability, ok, http_status, attempts, latency_ms, records_returned, cost_usd, error, created_at").eq("provider", id).order("created_at", { ascending: false }).limit(30);
  const h = (p.health ?? {}) as { consecutive_failures?: number; circuit_open_until?: string | null; last_error?: string | null; last_success_at?: string | null };

  return (
    <>
      <PageHeader title={p.name} subtitle={<span dir="ltr">{p.id}</span>} actions={<Link className="admin-btn small secondary" href="/admin/platform/providers"><Tx>كل المزودين</Tx></Link>} />
      <Card title="الحالة">
        <KeyValues items={[
          { label: "القدرات", value: p.capabilities.map((c) => capabilityLabel[c] ?? c).join(" · ") || "—" },
          { label: "أخطاء متتالية", value: String(h.consecutive_failures ?? 0) },
          { label: "متوقف حتى", value: h.circuit_open_until ? formatDateTime(h.circuit_open_until) : "—" },
          { label: "آخر نجاح", value: h.last_success_at ? formatDateTime(h.last_success_at) : "—" },
          { label: "آخر خطأ", value: h.last_error ?? "—" },
        ]} />
        {!p.storage_allowed ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx>التوجيه يتخطى هذا المزود حتى يُسمح بالتخزين في الترخيص.</Tx></p> : null}
      </Card>
      {manage ? (
        <>
          <Card title="الإعدادات">
            <ProviderForm p={{ ...p, pricing: JSON.stringify(p.pricing ?? {}, null, 2), daily_budget_usd: p.daily_budget_usd == null ? null : Number(p.daily_budget_usd), monthly_budget_usd: p.monthly_budget_usd == null ? null : Number(p.monthly_budget_usd) }} />
          </Card>
          <Card title="بيانات الاعتماد">
            <CredentialForm id={p.id} hint={p.credential_hint} />
          </Card>
        </>
      ) : null}
      <Card title="آخر الطلبات">
        {calls?.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الوقت</Tx></th><th><Tx>القدرة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>السجلات</Tx></th><th><Tx>التكلفة</Tx></th><th><Tx>الزمن</Tx></th></tr></thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id}>
                  <td>{formatDateTime(c.created_at)}</td>
                  <td><Tx>{capabilityLabel[c.capability] ?? c.capability}</Tx></td>
                  <td>{c.ok ? <StatusBadge tone="success" label="نجح" /> : <StatusBadge tone="danger" label={c.error ?? "فشل"} />}</td>
                  <td className="bos-num">{c.records_returned}</td>
                  <td className="bos-num">{c.cost_usd == null ? <StatusBadge tone="warning" label="غير مسعّر" /> : usd(Number(c.cost_usd))}</td>
                  <td className="bos-num">{c.latency_ms ?? "—"} ms</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد طلبات بعد" />}
      </Card>
    </>
  );
}
