import { BosTable } from "@/components/bos/BosTable";
import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { can, type BosUser } from "@/lib/bos/auth";
import { Card, StatusBadge } from "@/components/bos/ui";
import { formatDate } from "@/lib/bos/format";
import { docTypeEntities, docTypeLabels, listDocuments, listTemplates } from "@/services/bos/documents";
import { GenerateDocumentButton } from "@/app/admin/documents/DocumentControls";

const statusTone = { issued: "info", sent: "warning", signed: "success", void: "neutral" } as const;
const statusLabel = { issued: "صادر", sent: "مُرسل", signed: "موقّع", void: "ملغى" } as const;

// Documents issued from a record + "issue document" (docs/bos/30 §8.3).
export async function RecordDocuments({ bos, entityType, entityId, docTypes }: { bos: BosUser; entityType: string; entityId: string; docTypes?: string[] }) {
  if (!can(bos, "documents.read")) return null;
  const types = Object.entries(docTypeEntities).filter(([type, ents]) => ents.includes(entityType) && (!docTypes || docTypes.includes(type))).map(([type]) => type);
  const [docs, templates] = await Promise.all([listDocuments({ entityType, entityId, limit: 20 }), can(bos, "documents.create") ? listTemplates({ active: true }) : Promise.resolve([])]);
  const usable = templates.filter((t) => types.includes(t.doc_type)).map((t) => ({ id: t.id, name: t.name, language: t.language, doc_type: t.doc_type }));
  if (!docs.length && !usable.length) return null;
  return (
    <Card title="المستندات" actions={<GenerateDocumentButton entityType={entityType} entityId={entityId} templates={usable} />} flush>
      {docs.length ? (
        <BosTable className="bos-table">
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="cell-primary"><Link href={`/admin/documents/${d.id}`}>{d.number}</Link><span className="cell-sub"><Tx>{docTypeLabels[d.doc_type] ?? d.doc_type}</Tx> · {d.language === "ar" ? "العربية" : "English"}</span></td>
                <td><StatusBadge tone={statusTone[d.status as keyof typeof statusTone] ?? "neutral"} label={statusLabel[d.status as keyof typeof statusLabel] ?? d.status} /></td>
                <td>{formatDate(d.created_at)}</td>
                <td><a className="bos-link" href={`/api/bos/documents/${d.id}/docx`}>DOCX</a></td>
              </tr>
            ))}
          </tbody>
        </BosTable>
      ) : <div className="bos-faint" style={{ padding: 12, fontSize: 12.5 }}><Tx>لم تُصدر مستندات من هذا السجل بعد.</Tx></div>}
    </Card>
  );
}
