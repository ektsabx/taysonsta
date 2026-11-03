import Link from "next/link";
import { requirePermission, can } from "@/lib/bos/auth";
import { Tx } from "@/components/bos/I18n";
import { NotConnected, connected } from "@/components/yolias/PlatformUi";
import { Group, Panel, Stat } from "@/components/yolias/dash/Stat";
import { LineChart } from "@/components/yolias/dash/Charts";
import { SortTable } from "@/components/yolias/dash/SortTable";
import { AutoRefresh } from "@/components/yolias/dash/AutoRefresh";
import { change } from "@/lib/yolias/growth-math";
import { ENGINE_LABEL, GEO_ENGINES, geoDashboard } from "@/services/yolias/geo";
import { AddPromptForm, RunNowForm } from "./GeoForms";
import { deleteGeoPromptAction, toggleGeoPromptAction } from "./actions";

// AI visibility / GEO (owner, 2026-11-03, D-277): every week the same buyer
// questions go to ChatGPT, Gemini and Perplexity. Mention rate, citation
// rate, first recommendation and each competitor's share of the answers.
export default async function GeoPage() {
  const { bos } = await requirePermission("platform.read");
  if (!connected()) return <NotConnected />;
  const canEdit = can(bos, "platform.manage", "all");
  const d = await geoDashboard();
  const L = d.latest, P = d.previous;
  const r = L?.rates, pr = P?.rates;
  const done = [...d.runs].filter((x) => x.done > 0).reverse();
  const spark = (k: "mentionRate" | "citationRate" | "firstRate") => done.map((x) => x.rates[k] ?? 0);
  const running = d.runs.find((x) => x.status === "running");
  const prompts = new Map(d.prompts.map((p) => [p.id, p]));
  const ch = (a?: number | null, b?: number | null) => (a == null || b == null ? null : change(a, b));
  const yes = (v: boolean | null | undefined) => (v ? "✓" : "—");

  // Per question: on how many engines Yolias was mentioned, first, cited.
  const perPrompt = [...new Set(d.answers.map((a) => a.prompt_id))].map((id) => {
    const rows = d.answers.filter((a) => a.prompt_id === id && a.status === "done");
    return { id, rows, mentioned: rows.filter((a) => a.mentioned).length, first: rows.filter((a) => a.first_pick).length, cited: rows.filter((a) => a.cited).length };
  });

  return (
    <div className="yd">
      {running && <AutoRefresh seconds={30} />}
      <div className="yd-head">
        <h1><Tx>الظهور في الذكاء الاصطناعي</Tx></h1>
        {canEdit && <div className="yd-head-actions"><RunNowForm /></div>}
      </div>

      {!d.engines.length && (
        <Panel title="المحركات">
          <p className="yd-empty"><Tx>لا يوجد مفتاح OpenAI أو Gemini أو Perplexity.</Tx> <Link href="/admin/settings/integrations"><Tx>التكاملات</Tx></Link></p>
        </Panel>
      )}
      {running && (
        <Panel title="قياس يعمل الآن">
          <p className="yd-prev" dir="ltr">{running.total ? `${d.runs.find((x) => x.id === running.id)?.done ?? 0} / ${running.total}` : "…"}</p>
        </Panel>
      )}

      <Group title={L ? `${L.started_at.slice(0, 10)}` : "آخر قياس"} tone="growth">
        <Stat tone="growth" label="نسبة الذكر" format="pct" value={r?.mentionRate ?? null} prev={pr?.mentionRate ?? null} change={ch(r?.mentionRate, pr?.mentionRate)} spark={spark("mentionRate")} />
        <Stat tone="growth" label="نسبة الاستشهاد" format="pct" value={r?.citationRate ?? null} prev={pr?.citationRate ?? null} change={ch(r?.citationRate, pr?.citationRate)} spark={spark("citationRate")} />
        <Stat tone="growth" label="الترشيح الأول" format="pct" value={r?.firstRate ?? null} prev={pr?.firstRate ?? null} change={ch(r?.firstRate, pr?.firstRate)} spark={spark("firstRate")} />
        <Stat tone="growth" label="الإجابات" value={r?.answers ?? null} prev={pr?.answers ?? null} />
      </Group>

      {done.length > 1 && (
        <Panel title="أسبوعًا بأسبوع">
          <LineChart labels={done.map((x) => x.started_at.slice(0, 10))} lines={[
            { name: "نسبة الذكر", values: done.map((x) => Math.round((x.rates.mentionRate ?? 0) * 100)), tone: "red" },
            { name: "نسبة الاستشهاد", values: done.map((x) => Math.round((x.rates.citationRate ?? 0) * 100)), tone: "ink" },
            { name: "الترشيح الأول", values: done.map((x) => Math.round((x.rates.firstRate ?? 0) * 100)), tone: "green" },
          ]} />
        </Panel>
      )}

      <div className="yd-grid2">
        <Panel title="حسب المحرك">
          <SortTable firstLabel="المحرك" initial="mention" cols={[
            { key: "mention", label: "الذكر", format: "pct", bar: true }, { key: "cite", label: "الاستشهاد", format: "pct" }, { key: "first", label: "الأول", format: "pct" }, { key: "n", label: "الإجابات" },
          ]} rows={d.byEngine.map((e) => ({ id: e.engine, label: ENGINE_LABEL[e.engine] ?? e.engine, sortLabel: e.engine, values: { mention: e.rates.mentionRate, cite: e.rates.citationRate, first: e.rates.firstRate, n: e.rates.answers } }))} />
        </Panel>
        <Panel title="حصة المنافسين">
          <SortTable firstLabel="العلامة" initial="share" cols={[{ key: "share", label: "الحصة", format: "pct", bar: true }, { key: "mentions", label: "مرات الذكر" }]}
            rows={(r?.share ?? []).map((s) => ({ id: s.name, label: s.name === "Yolias" ? <strong>Yolias</strong> : s.name, sortLabel: s.name, values: { share: s.share, mentions: s.mentions } }))} />
        </Panel>
      </div>

      <Panel title="الأسئلة في آخر قياس">
        <div className="yd-table-wrap">
          <table className="yd-table yd-wrap">
            <thead><tr><th><Tx>السؤال</Tx></th>{GEO_ENGINES.map((e) => <th key={e}>{ENGINE_LABEL[e]}</th>)}<th><Tx>الأول</Tx></th><th><Tx>الاستشهاد</Tx></th></tr></thead>
            <tbody>
              {perPrompt.map((p) => (
                <tr key={p.id}>
                  <th scope="row" dir="auto">
                    <details>
                      <summary>{prompts.get(p.id)?.text ?? p.id}</summary>
                      {p.rows.map((a) => (
                        <div key={a.engine} className="yd-pair">
                          <strong>{ENGINE_LABEL[a.engine]}</strong>
                          <span dir="ltr" className="yd-prev">{a.brands.join(" · ") || "—"}</span>
                          <p dir="auto">{(a.answer ?? "").slice(0, 1200)}</p>
                        </div>
                      ))}
                    </details>
                  </th>
                  {GEO_ENGINES.map((e) => { const a = d.answers.find((x) => x.prompt_id === p.id && x.engine === e); return <td key={e}>{!a ? "" : a.status === "done" ? yes(a.mentioned) : a.status === "failed" ? <span className="yd-chip bad" title={a.error ?? ""}><Tx>فشل</Tx></span> : "…"}</td>; })}
                  <td dir="ltr">{p.first}</td>
                  <td dir="ltr">{p.cited}</td>
                </tr>
              ))}
              {!perPrompt.length && <tr><td colSpan={6} className="yd-empty"><Tx>لم يتم أي قياس بعد</Tx></td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="الأسئلة الأسبوعية" actions={<span className="yd-prev" dir="ltr">{d.prompts.filter((p) => p.active).length}</span>}>
        {canEdit && <AddPromptForm />}
        <div className="yd-table-wrap">
          <table className="yd-table yd-wrap">
            <thead><tr><th><Tx>السؤال</Tx></th><th><Tx>اللغة</Tx></th><th><Tx>الموضوع</Tx></th><th><Tx>الحالة</Tx></th>{canEdit && <th />}</tr></thead>
            <tbody>
              {d.prompts.map((p) => (
                <tr key={p.id}>
                  <th scope="row" dir="auto">{p.text}</th>
                  <td>{p.lang === "ar" ? "العربية" : "English"}</td>
                  <td dir="ltr">{p.topic ?? ""}</td>
                  <td><span className={`yd-chip${p.active ? " good" : ""}`}><Tx>{p.active ? "يعمل" : "متوقف"}</Tx></span></td>
                  {canEdit && (
                    <td>
                      <div className="yd-actions">
                        <form action={toggleGeoPromptAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? "0" : "1"} /><button className="yd-btn"><Tx>{p.active ? "إيقاف" : "تشغيل"}</Tx></button></form>
                        <form action={deleteGeoPromptAction}><input type="hidden" name="id" value={p.id} /><button className="yd-btn"><Tx>حذف</Tx></button></form>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
