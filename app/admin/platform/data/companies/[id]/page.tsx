import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/bos/auth";
import { PageHeader, Card, EmptyState, StatusBadge, KeyValues } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDate, formatDateTime } from "@/lib/bos/format";
import { getSharedCompany } from "@/services/yolias/data";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";

const contactTone: Record<string, "success" | "danger" | "warning" | "neutral"> = { valid: "success", invalid: "danger", catch_all: "warning", risky: "warning", unknown: "neutral" };
const show = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

// One shared company with every field's provenance (source, license, time,
// expiry — rule 20) and its people with their contacts and verification.
export default async function SharedCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("platform.read");
  if (!connected()) return (<><PageHeader title="شركة" /><NotConnected /></>);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await getSharedCompany(id);
  if (!d) notFound();
  const c = d.company;
  return (
    <>
      <PageHeader title={c.name} subtitle={c.domain ?? undefined} />
      <Card title="البيانات">
        <KeyValues items={[
          { label: "القطاع", value: c.industry ?? "—" },
          { label: "الموظفون", value: c.employee_count ?? "—" },
          { label: "المدينة والدولة", value: [c.city, c.country].filter(Boolean).join(" · ") || "—" },
          { label: "آخر تحديث", value: c.refreshed_at ? formatDateTime(c.refreshed_at) : "—" },
          { label: "الترخيص", value: c.redistributable ? "قابلة للمشاركة بين مساحات العمل" : "لمساحة العمل التي طلبتها فقط" },
          { label: "المعرّفات", value: d.identifiers.map((i) => `${i.kind}: ${i.value}`).join(" · ") || "—" },
        ]} />
      </Card>

      <Card title="مصدر كل حقل">
        {d.fields.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الحقل</Tx></th><th><Tx>القيمة</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>الترخيص</Tx></th><th><Tx>الثقة</Tx></th><th><Tx>وقت الجلب</Tx></th><th><Tx>تنتهي في</Tx></th></tr></thead>
            <tbody>
              {d.fields.map((f, i) => (
                <tr key={i}>
                  <td dir="ltr">{f.field}</td>
                  <td dir="auto" style={{ maxWidth: 260, overflowWrap: "anywhere" }}>{show(f.value)}</td>
                  <td dir="ltr">{f.source}</td>
                  <td dir="ltr">{f.license_scope ?? "—"}</td>
                  <td className="bos-num">{f.confidence == null ? "—" : Number(f.confidence).toFixed(2)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(f.fetched_at)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{f.expires_at ? formatDate(f.expires_at) : "—"}{f.expires_at && new Date(f.expires_at) < new Date() ? <span className="cell-sub"><StatusBadge tone="warning" label="منتهية" /></span> : null}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد بيانات مصدر" />}
      </Card>

      <Card title="الأشخاص">
        {d.people.length ? (
          <BosTable className="bos-table">
            <thead><tr><th><Tx>الاسم</Tx></th><th><Tx>المسمى</Tx></th><th><Tx>وسائل التواصل</Tx></th><th><Tx>المصادر</Tx></th><th><Tx>آخر تحديث</Tx></th></tr></thead>
            <tbody>
              {d.people.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name}{p.possibleDuplicate ? <span className="cell-sub"><StatusBadge tone="warning" label="تكرار محتمل" /></span> : null}</td>
                  <td>{p.title ?? "—"}{p.seniority ? <span className="cell-sub" dir="ltr">{p.seniority}</span> : null}</td>
                  <td>
                    {p.contacts.length ? p.contacts.map((ct, i) => (
                      <div key={i} dir="ltr" style={{ whiteSpace: "nowrap" }}>
                        {ct.value} <StatusBadge tone={contactTone[ct.status] ?? "neutral"} label={ct.status} />
                        {ct.verified_by ? <span className="cell-sub">{ct.verified_by} · {ct.verified_at ? formatDate(ct.verified_at) : ""}</span> : null}
                      </div>
                    )) : "—"}
                  </td>
                  <td dir="ltr">{p.sources.join(", ") || "—"}</td>
                  <td>{p.refreshed_at ? formatDate(p.refreshed_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد أشخاص" />}
      </Card>
    </>
  );
}
