import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, requirePermission } from "@/lib/bos/auth";
import { formatDateTime } from "@/lib/bos/format";
import { listImports } from "@/services/bos/import-engine";
import { importTypes, importTypeMap } from "@/services/bos/import-types";
import { userNameMap } from "@/services/bos/shared";
import { PageHeader, Card, StatusBadge, EmptyState } from "@/components/bos/ui";
import { NewImport } from "./ImportControls";
import { jobStatus } from "./labels";


// Data import (docs/bos/30 §27).
export default async function ImportsPage() {
  const { bos } = await requirePermission("imports.create");
  const [jobs, names] = await Promise.all([listImports(bos), userNameMap()]);
  const types = importTypes.filter((t) => can(bos, t.perm)).map((t) => ({ value: t.key, label: t.label }));
  return (
    <>
      <PageHeader title="استيراد البيانات" subtitle="رفع → ربط الأعمدة → تحقق → تأكيد → تنفيذ آمن، مع تقرير أخطاء وإمكانية التراجع" />
      <Card title="استيراد جديد">{types.length ? <NewImport types={types} /> : <EmptyState title="لا توجد أنواع بيانات مسموح لك باستيرادها" />}
        <p className="bos-hint"><Tx>لا يُنفَّذ أي محتوى من الملف (قيم الخلايا فقط)، ولا تُكتب سجلات قبل مراجعتك وتأكيدك. السجلات الموجودة لا تُعدّل إلا إذا اخترت ذلك صراحة.</Tx></p>
      </Card>
      <Card title="السجل" flush>
        {jobs.length ? (
          <BosTable className="bos-table">
            <thead><tr><th>#</th><th><Tx>النوع</Tx></th><th><Tx>الملف</Tx></th><th><Tx>الحالة</Tx></th><th><Tx>النتيجة</Tx></th><th><Tx>بواسطة</Tx></th><th><Tx>التاريخ</Tx></th></tr></thead>
            <tbody>{jobs.map((j) => (
              <tr key={j.id}>
                <td className="bos-nowrap"><Link href={`/admin/settings/import/${j.id}`}>{j.number}</Link></td>
                <td><Tx>{importTypeMap.get(j.data_type)?.label ?? j.data_type}</Tx></td>
                <td>{j.file_name}</td>
                <td><StatusBadge tone={jobStatus[j.status]?.tone ?? "neutral"} label={jobStatus[j.status]?.label ?? j.status} /></td>
                <td className="bos-num" style={{ fontSize: 12 }}>{j.status === "completed" || j.status === "rolled_back" ? `+${j.created_count} · ~${j.updated_count} · ✖${j.failed_count}` : `${j.total_rows}`}</td>
                <td>{j.created_by ? names.get(j.created_by) ?? "—" : "—"}</td>
                <td className="bos-nowrap">{formatDateTime(j.created_at)}</td>
              </tr>
            ))}</tbody>
          </BosTable>
        ) : <EmptyState title="لا توجد عمليات استيراد" />}
      </Card>
    </>
  );
}
