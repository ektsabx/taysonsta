import Link from "next/link";
import { Tx } from "@/components/bos/I18n";
import { requireBosUser } from "@/lib/bos/auth";
import { readParams, type SearchParams } from "@/lib/bos/params";
import { db } from "@/lib/bos/db";
import { formatDateTime } from "@/lib/bos/format";
import { getThread, listThreads, type AssistantAnswer, type ToolResult } from "@/services/bos/assistant";
import { PageHeader, Card, EmptyState } from "@/components/bos/ui";
import { AskBox, DeleteThread } from "./AssistantControls";

// Business AI assistant (docs/bos/30 §25): answers from fixed, permission-
// aware data tools; shows sources and update times; facts vs forecasts vs
// missing data; suggestions are links only.
export default async function AssistantPage({ searchParams }: { searchParams: SearchParams }) {
  const bos = await requireBosUser();
  const sp = await readParams(searchParams);
  const [threads, { count: ai }] = await Promise.all([listThreads(bos), db().from("integration_connections").select("id", { count: "exact", head: true }).in("provider", ["anthropic", "openai", "gemini"]).eq("status", "active")]);
  const current = sp.t && /^[0-9a-f-]{36}$/i.test(sp.t) ? await getThread(bos, sp.t).catch(() => null) : null;
  return (
    <>
      <PageHeader title="المساعد الذكي" subtitle="يجيب من بيانات النظام المسموح لك بها فقط — مع المصدر ووقت التحديث" breadcrumbs={[{ label: "المساعد الذكي" }]} actions={current ? <Link className="admin-btn small ghost" href="/admin/assistant"><Tx>محادثة جديدة</Tx></Link> : null} />
      {!ai ? <Card><p className="bos-hint" style={{ margin: 0 }}><Tx>لا يوجد مزود ذكاء اصطناعي متصل — سيعرض المساعد البيانات المطابقة لسؤالك مباشرة دون تحليل. أضف مفتاحاً من مركز التكاملات للإجابات التحليلية.</Tx></p></Card> : null}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr) 260px" }} className="bos-assistant">
        <div className="bos-stack" style={{ gap: 12 }}>
          {current ? current.messages.map((m) => m.role === "user" ? (
            <div key={m.id} style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "8px 12px", borderRadius: 12, background: "rgba(var(--bos-fg-rgb), .07)" }} dir="auto">{m.content}</div>
          ) : <AnswerCard key={m.id} answer={JSON.parse(m.content) as AssistantAnswer} tools={(m.tools as unknown as ToolResult[]) ?? []} at={m.created_at} />) : <Card><EmptyState title="اسأل عن مهامك، فواتيرك، مشاريعك، صفقاتك، التذاكر، المحتوى أو الإعلانات" description="لن ينفّذ المساعد أي إجراء — يقترح روابط فقط." /></Card>}
          <Card><AskBox threadId={current?.thread.id ?? null} /></Card>
        </div>
        <Card title="المحادثات السابقة" flush>
          {threads.length ? threads.map((t) => (
            <div key={t.id} className="bos-row" style={{ gap: 4, padding: "6px 10px", alignItems: "center", background: current?.thread.id === t.id ? "rgba(var(--bos-fg-rgb), .05)" : undefined }}>
              <Link href={`/admin/assistant?t=${t.id}`} style={{ flex: 1, fontSize: 13 }}>{t.title}<div className="bos-faint" style={{ fontSize: 11 }}>{formatDateTime(t.updated_at)}</div></Link>
              <DeleteThread id={t.id} />
            </div>
          )) : <p className="bos-hint" style={{ padding: 12 }}><Tx>لا توجد محادثات</Tx></p>}
        </Card>
      </div>
    </>
  );
}

function AnswerCard({ answer, tools, at }: { answer: AssistantAnswer; tools: ToolResult[]; at: string }) {
  return (
    <Card>
      <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }} dir="auto">{answer.answer}</p>
      {answer.facts.length ? <div><b><Tx>حقائق من البيانات</Tx></b><ul style={{ margin: "4px 0", paddingInlineStart: 18 }}>{answer.facts.map((f, i) => <li key={i} dir="auto">{f}</li>)}</ul></div> : null}
      {answer.forecasts.length ? <div><b><Tx>تقديرات وتوقعات (ليست حقائق)</Tx></b><ul style={{ margin: "4px 0", paddingInlineStart: 18 }}>{answer.forecasts.map((f, i) => <li key={i} dir="auto">{f}</li>)}</ul></div> : null}
      {answer.missing.length ? <div className="bos-faint"><b><Tx>بيانات ناقصة</Tx></b><ul style={{ margin: "4px 0", paddingInlineStart: 18 }}>{answer.missing.map((f, i) => <li key={i} dir="auto">{f}</li>)}</ul></div> : null}
      {answer.suggestions.length ? <div className="bos-row" style={{ gap: 6, flexWrap: "wrap", marginTop: 6 }}>{answer.suggestions.map((s) => <Link key={s.href} className="admin-btn small secondary" href={s.href}>{s.label}</Link>)}</div> : null}
      {tools.map((t) => (
        <details key={t.tool} style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 12.5 }}><Tx>{t.title}</Tx> · <span className="bos-faint"><Tx>المصدر</Tx>: <Tx>{t.source}</Tx> · <Tx>آخر تحديث</Tx>: {formatDateTime(t.updatedAt)} · {t.rows.length}</span></summary>
          {t.rows.length ? (
            <table className="bos-table" style={{ fontSize: 12.5 }}><tbody>{t.rows.slice(0, 30).map((r, i) => <tr key={i}><td>{r.href ? <Link href={r.href}>{r.label}</Link> : r.label}</td><td className="bos-faint">{t.tool === "knowledge" ? (r.detail ?? "").slice(0, 160) + "…" : r.detail ?? ""}</td><td className="bos-num">{r.value ?? ""}</td></tr>)}</tbody></table>
          ) : <p className="bos-hint"><Tx>لا توجد بيانات.</Tx></p>}
        </details>
      ))}
      <div className="bos-faint" style={{ fontSize: 11, marginTop: 6 }}>{answer.mode === "ai" ? <Tx>تحليل بالذكاء الاصطناعي من بيانات النظام</Tx> : <Tx>بيانات مباشرة من النظام</Tx>} · {formatDateTime(at)}</div>
    </Card>
  );
}
