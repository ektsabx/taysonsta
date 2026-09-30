import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { PageHeader, Card, EmptyState, StatusBadge } from "@/components/bos/ui";
import { FilterBar } from "@/components/bos/FilterBar";
import { RelTime } from "@/components/bos/RelTime";

// Support customer profiles (docs/bos/30 §10.3).
export default async function SupportCustomersPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  let q = db().from("support_customers").select("id, name, email, phone, company, country, source, priority, tags, client_id, last_seen_at").is("merged_into", null).order("last_seen_at", { ascending: false, nullsFirst: false }).limit(200);
  if (sp.q?.trim()) {
    const term = sp.q.trim().replace(/[,()%]/g, " ");
    q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,company.ilike.%${term}%`);
  }
  if (sp.linked === "yes") q = q.not("client_id", "is", null);
  if (sp.linked === "no") q = q.is("client_id", null);
  const { data: rows } = await q;
  return (
    <>
      <PageHeader title="عملاء الدعم" subtitle="كل من تواصل مع الدعم — مرتبط بحساب العميل إن وُجد" />
      <FilterBar searchPlaceholder="بحث بالاسم أو البريد أو الهاتف أو الشركة..." filters={[{ key: "linked", label: "الربط بحساب", type: "select", options: [{ value: "yes", label: "مرتبط بحساب" }, { value: "no", label: "غير مرتبط" }] }]} />
      <Card flush>
        {(rows ?? []).length ? (
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>العميل</Tx></th><th><Tx>الشركة</Tx></th><th><Tx>المصدر</Tx></th><th><Tx>الأولوية</Tx></th><th><Tx>الوسوم</Tx></th><th><Tx>آخر تواصل</Tx></th></tr></thead>
            <tbody>
              {(rows ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="cell-primary"><Link href={`/admin/support/customers/${c.id}`}>{c.name}</Link><span className="cell-sub" dir="ltr">{[c.email, c.phone].filter(Boolean).join(" · ")}</span></td>
                  <td>{c.company ?? "—"}{c.client_id ? <span className="cell-sub"><Tx>مرتبط بحساب</Tx></span> : null}</td>
                  <td><Tx>{c.source ?? "—"}</Tx></td>
                  <td>{c.priority !== "normal" ? <StatusBadge tone={c.priority === "urgent" ? "danger" : c.priority === "high" ? "warning" : "neutral"} label={{ low: "منخفضة", high: "عالية", urgent: "عاجلة" }[c.priority] ?? c.priority} /> : "—"}</td>
                  <td>{c.tags.map((t) => <span key={t} className="bos-tag">{t}</span>)}</td>
                  <td>{c.last_seen_at ? <RelTime value={c.last_seen_at} /> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </BosTable>
        ) : <EmptyState title="لا يوجد عملاء دعم بعد" description="يُنشأ ملف العميل تلقائياً عند أول محادثة." />}
      </Card>
    </>
  );
}
