import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Tx } from "@/components/bos/I18n";
import { requirePermission } from "@/lib/bos/auth";
import { ForbiddenError, NotFoundError } from "@/lib/bos/errors";
import { formatDateTime } from "@/lib/bos/format";
import { getImport } from "@/services/bos/import-engine";
import { PageHeader, Card, StatusBadge, KpiCard, EmptyState } from "@/components/bos/ui";
import { ExecuteButton, MappingForm, RollbackButton } from "../ImportControls";
import { jobStatus } from "../labels";

export default async function ImportJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { bos } = await requirePermission("imports.create");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let d: Awaited<ReturnType<typeof getImport>>;
  try {
    d = await getImport(bos, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    if (e instanceof ForbiddenError) redirect("/admin/forbidden");
    throw e;
  }
  const { job, type, sample, problems } = d;
  const editable = ["uploaded", "validated"].includes(job.status);
  const willWrite = job.valid_rows + (job.mode === "update_matches" ? job.duplicate_rows : 0);
  const fieldLabel = new Map(type.fields.map((f) => [f.key, f.label]));
  return (
    <>
      <PageHeader title={`${job.number} · ${job.file_name}`} subtitle={<span className="bos-row" style={{ gap: 6 }}><Tx>{type.label}</Tx><StatusBadge tone={jobStatus[job.status]?.tone ?? "neutral"} label={jobStatus[job.status]?.label ?? job.status} /></span>} />
      <div className="bos-kpis">
        <KpiCard label="الصفوف" value={job.total_rows} />
        {job.validated_at ? <><KpiCard label="صالحة" value={job.valid_rows} /><KpiCard label="أخطاء" value={job.error_rows} /><KpiCard label="موجودة مسبقاً" value={job.duplicate_rows} /></> : null}
        {job.executed_at ? <><KpiCard label="أُنشئت" value={job.created_count} /><KpiCard label="حُدّثت" value={job.updated_count} /><KpiCard label="تُخطيت" value={job.skipped_count} /><KpiCard label="فشلت" value={job.failed_count} /></> : null}
      </div>
      <Card title="معاينة أول الصفوف" flush>
        <div style={{ overflowX: "auto" }}>
          <BosTable className="bos-table" style={{ fontSize: 12 }}>
            <thead><tr><th>#</th>{job.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{sample.map((r) => <tr key={r.row_no}><td>{r.row_no}</td>{job.headers.map((h) => <td key={h}>{String((r.raw as Record<string, string>)[h] ?? "").slice(0, 60)}</td>)}</tr>)}</tbody>
          </BosTable>
        </div>
      </Card>
      {editable ? (
        <Card title="ربط الأعمدة والتحقق">
          <MappingForm jobId={job.id} headers={job.headers} fields={type.fields.map((f) => ({ key: f.key, label: f.label, required: f.required }))} matchKeys={type.matchKeys.map((k) => ({ value: k, label: fieldLabel.get(k) ?? k }))} initial={{ mapping: job.mapping as Record<string, string>, matchKey: job.match_key, mode: job.mode, expected: job.expected_count }} />
        </Card>
      ) : null}
      {job.status === "validated" ? (
        <Card title="التأكيد والتنفيذ">
          <p><Tx vars={{ n: String(willWrite) }}>{"سيتم كتابة {n} سجل."}</Tx> {job.error_rows ? <><Tx vars={{ n: String(job.error_rows) }}>{"{n} صف فيه أخطاء سيُتخطى."}</Tx> </> : null}{job.duplicate_rows && job.mode === "create_only" ? <Tx vars={{ n: String(job.duplicate_rows) }}>{"{n} سجل موجود مسبقاً سيُتخطى دون تعديل."}</Tx> : null}</p>
          {job.expected_count != null && job.expected_count !== willWrite ? <p className="bos-danger"><Tx vars={{ a: String(job.expected_count), b: String(willWrite) }}>{"العدد المتوقع {a} لا يطابق {b}."}</Tx></p> : null}
          <ExecuteButton jobId={job.id} mismatch={job.expected_count != null && job.expected_count !== willWrite} />
        </Card>
      ) : null}
      {job.status === "completed" ? <Card title="التراجع"><p className="bos-hint"><Tx>خلال 7 أيام من التنفيذ: يُحذف ما أُنشئ (أو يؤرشف إن ارتبطت به سجلات أخرى) وتُستعاد القيم السابقة لما عُدّل.</Tx></p><RollbackButton jobId={job.id} /></Card> : null}
      <Card title="الأخطاء والتكرارات" actions={problems.length ? <a className="admin-btn small secondary" href={`/api/bos/imports/${job.id}/errors`}><Tx>تنزيل تقرير الأخطاء</Tx></a> : null} flush>
        {problems.length ? (
          <BosTable className="bos-table" style={{ fontSize: 12.5 }}>
            <thead><tr><th><Tx>السطر</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>التفاصيل</Tx></th></tr></thead>
            <tbody>{problems.map((p) => <tr key={p.row_no}><td>{p.row_no}</td><td><StatusBadge tone={p.status === "duplicate" ? "warning" : "danger"} label={p.status === "duplicate" ? "موجود مسبقاً" : p.status === "failed" ? "فشل" : "خطأ"} /></td><td>{p.status === "duplicate" ? <Tx>يطابق سجلاً موجوداً</Tx> : (p.errors ?? []).join(" · ")}</td></tr>)}</tbody>
          </BosTable>
        ) : <EmptyState title={job.validated_at ? "لا توجد أخطاء" : "تظهر بعد التحقق"} />}
      </Card>
      {job.executed_at ? <p className="bos-faint" style={{ fontSize: 12 }}><Tx>نُفّذ</Tx> {formatDateTime(job.executed_at)}{job.rolled_back_at ? <> · <Tx>تم التراجع</Tx> {formatDateTime(job.rolled_back_at)}</> : null}</p> : null}
      <p><Link href="/admin/settings/import"><Tx>كل عمليات الاستيراد</Tx></Link></p>
    </>
  );
}
