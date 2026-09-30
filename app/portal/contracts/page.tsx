import { portalCan, requirePortalSection } from "@/lib/bos/portal-auth";
import { portalContracts, portalDocuments } from "@/services/bos/portal-extra";
import { formatDate } from "@/lib/bos/format";
import { PBadge, PEmpty, PMoney, PTop } from "../ui";

const contractStatus: Record<string, string> = { sent: "بانتظار التوقيع", viewed: "تم الاطلاع", partially_signed: "موقّع جزئياً", signed: "موقّع", expired: "منتهي", cancelled: "ملغى" };
const proposalStatus: Record<string, string> = { published: "مُرسل", viewed: "تم الاطلاع", accepted: "مقبول", rejected: "مرفوض", expired: "منتهي" };
const docStatus: Record<string, string> = { sent: "مُرسل", signed: "موقّع" };

// Contracts, proposals and issued documents (docs/bos/30 §23).
export default async function PortalContractsPage() {
  const p = await requirePortalSection("contracts");
  const [{ contracts, proposals }, docs] = await Promise.all([portalContracts(p), portalCan(p, "documents") ? portalDocuments(p) : Promise.resolve([])]);
  return (
    <>
      <PTop title="العقود والمستندات" />
      <div className="portal-card">
        <h3 style={{ marginTop: 0 }}>العقود</h3>
        {contracts.length ? (
          <table className="portal-table">
            <thead><tr><th>العقد</th><th>القيمة</th><th>المدة</th><th>الحالة</th><th>النسخ</th></tr></thead>
            <tbody>{contracts.map((c) => <tr key={c.id}><td>{c.contract_number} · {c.title}</td><td><PMoney value={c.value} currency={c.currency} /></td><td>{formatDate(c.start_date)} — {formatDate(c.end_date)}</td><td><PBadge label={contractStatus[c.status] ?? c.status} tone={c.status === "signed" ? "success" : "info"} />{c.signed_at ? <div className="portal-muted">{formatDate(c.signed_at)}</div> : null}</td><td>{c.files.length ? c.files.map((f) => <div key={f.id}><a href={`/portal/files/${f.id}?download=1`}>{f.name}</a></div>) : "—"}</td></tr>)}</tbody>
          </table>
        ) : <PEmpty title="لا توجد عقود" />}
        {contracts.some((c) => ["sent", "viewed", "partially_signed"].includes(c.status) && c.esign_provider === "docusign") ? <p className="portal-muted">رابط التوقيع يصلك بالبريد من DocuSign.</p> : null}
      </div>
      <div className="portal-card">
        <h3 style={{ marginTop: 0 }}>العروض</h3>
        {proposals.length ? (
          <table className="portal-table">
            <thead><tr><th>العرض</th><th>القيمة</th><th>صالح حتى</th><th>الحالة</th></tr></thead>
            <tbody>{proposals.map((x) => <tr key={x.id}><td><a href={`/proposal/${x.slug}`} target="_blank" rel="noreferrer">{x.title}</a></td><td><PMoney value={x.total_amount} currency={x.currency} /></td><td>{formatDate(x.valid_until)}</td><td><PBadge label={proposalStatus[x.status] ?? x.status} tone={x.status === "accepted" ? "success" : "info"} /></td></tr>)}</tbody>
          </table>
        ) : <PEmpty title="لا توجد عروض" />}
      </div>
      {portalCan(p, "documents") ? (
        <div className="portal-card">
          <h3 style={{ marginTop: 0 }}>المستندات الصادرة</h3>
          {docs.length ? (
            <table className="portal-table">
              <thead><tr><th>المستند</th><th>الحالة</th><th>التاريخ</th><th /></tr></thead>
              <tbody>{docs.map((d) => <tr key={d.id}><td>{d.number} · {d.title}</td><td><PBadge label={docStatus[d.status] ?? d.status} tone={d.status === "signed" ? "success" : "info"} /></td><td>{formatDate(d.sent_at ?? d.created_at)}</td><td><a href={`/portal/documents/${d.id}`}>تنزيل DOCX</a></td></tr>)}</tbody>
            </table>
          ) : <PEmpty title="لا توجد مستندات" />}
        </div>
      ) : null}
    </>
  );
}
