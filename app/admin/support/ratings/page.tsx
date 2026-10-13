import Link from "next/link";
import { requirePermission } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { PageHeader, Card, EmptyState, KpiCard, Tabs } from "@/components/bos/ui";
import { BosTable } from "@/components/bos/BosTable";
import { Tx } from "@/components/bos/I18n";
import { formatDateTime } from "@/lib/bos/format";
import { userNameMap } from "@/services/bos/shared";
import { ratingsReport } from "@/services/bos/support-ratings";

// Ratings customers gave after a resolved conversation (D-180), for Yolias
// Agent and for people, computed from the stored ratings only.
export default async function SupportRatingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("conversations.read");
  const sp = await readParams(searchParams);
  const days = ["7", "30", "90", "365"].includes(sp.days ?? "") ? Number(sp.days) : 30;
  const responder = sp.responder === "ai" || sp.responder === "human" ? sp.responder : "";
  const [r, names] = await Promise.all([ratingsReport({ days, responder, agent: sp.agent }), userNameMap()]);
  const max = Math.max(1, ...r.distribution.map((d) => d.count));
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(2));
  const base = `/admin/support/ratings?days=${days}`;
  return (
    <>
      <PageHeader title="تقييمات الدعم" subtitle={<Tx>يقيّم العملاء المحادثة بعد حلها في نافذة الدعم على الموقع.</Tx>} />
      <Tabs tabs={[{ key: "7", label: "آخر 7 أيام" }, { key: "30", label: "آخر 30 يومًا" }, { key: "90", label: "آخر 90 يومًا" }, { key: "365", label: "آخر سنة" }]} active={String(days)} baseHref={`/admin/support/ratings${responder ? `?responder=${responder}` : ""}`} param="days" />
      <Tabs tabs={[{ key: "", label: "الكل" }, { key: "ai", label: "Yolias Agent" }, { key: "human", label: "الموظفون" }]} active={responder} baseHref={base} param="responder" />
      <div className="bos-kpis">
        <KpiCard label="عدد التقييمات" value={r.total} />
        <KpiCard label="متوسط التقييم" value={fmt(r.average)} sub={<Tx>من 5</Tx>} />
        <KpiCard label="Yolias Agent" value={fmt(r.ai.average)} sub={<Tx vars={{ n: r.ai.count }}>{"{n} تقييم"}</Tx>} />
        <KpiCard label="الموظفون" value={fmt(r.human.average)} sub={<Tx vars={{ n: r.human.count }}>{"{n} تقييم"}</Tx>} />
      </div>
      <Card title="توزيع التقييمات">
        {r.total ? (
          <div className="aff-dist">
            {r.distribution.map((d) => (
              <div key={d.stars} className="aff-dist-row">
                <span dir="ltr">{"★".repeat(d.stars)}</span>
                <span className="aff-dist-track"><span style={{ width: `${(d.count / max) * 100}%` }} /></span>
                <span>{d.count}</span>
              </div>
            ))}
          </div>
        ) : <EmptyState title="لا توجد تقييمات في هذه الفترة" />}
      </Card>
      {r.agents.length ? (
        <Card title="حسب الموظف">
          <BosTable className="bos-table responsive">
            <thead><tr><th><Tx>الموظف</Tx></th><th><Tx>عدد التقييمات</Tx></th><th><Tx>المتوسط</Tx></th></tr></thead>
            <tbody>{r.agents.map((a) => <tr key={a.userId}><td><Link className="bos-link" href={`${base}&responder=human&agent=${a.userId}`}>{names.get(a.userId) ?? "—"}</Link></td><td>{a.count}</td><td>{fmt(a.average)}</td></tr>)}</tbody>
          </BosTable>
        </Card>
      ) : null}
      <Card title="أحدث التقييمات" flush>
        {r.recent.length ? (
          <div className="bos-table-scroll">
            <BosTable className="bos-table responsive">
              <thead><tr><th><Tx>التاريخ</Tx></th><th><Tx>التقييم</Tx></th><th><Tx>لمن</Tx></th><th><Tx>التعليق</Tx></th><th /></tr></thead>
              <tbody>
                {r.recent.map((x) => (
                  <tr key={x.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(x.created_at)}</td>
                    <td dir="ltr">{"★".repeat(x.rating)}{"☆".repeat(5 - x.rating)}</td>
                    <td>{x.responder_kind === "ai" ? "Yolias Agent" : names.get(x.agent_user_id ?? "") ?? <Tx>موظف</Tx>}</td>
                    <td dir="auto" style={{ maxWidth: 360 }}>{x.comment ?? "—"}</td>
                    <td><Link className="bos-link" href={`/admin/support/inbox?who=all&status=all&c=${x.conversation_id}`}><Tx>فتح المحادثة</Tx></Link></td>
                  </tr>
                ))}
              </tbody>
            </BosTable>
          </div>
        ) : <EmptyState title="لا توجد تقييمات" />}
      </Card>
    </>
  );
}
