"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EntitySelector } from "@/components/bos/EntitySelector";
import { ConfirmButton } from "@/components/bos/Dialog";
import { searchEntitiesAction } from "@/app/admin/_actions/common";
import { addChecklistItemAction, addDependencyAction, archiveTaskAction, removeDependencyAction, startTimerAction, stopTimerAction, toggleChecklistItemAction } from "../../actions";

function useRun() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "تعذر التنفيذ");
      else {
        setError(null);
        after?.();
        router.refresh();
      }
    });
  return { pending, error, run };
}

export function Checklist({ taskId, items, editable }: { taskId: string; items: { id: string; label: string; is_done: boolean }[]; editable: boolean }) {
  const { pending, error, run } = useRun();
  const [label, setLabel] = useState("");
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      {items.map((i) => (
        <label key={i.id} className="bos-check">
          <input type="checkbox" checked={i.is_done} disabled={!editable || pending} onChange={(e) => run(() => toggleChecklistItemAction(taskId, i.id, e.target.checked))} />
          <span style={i.is_done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}><Tx>{i.label}</Tx></span>
        </label>
      ))}
      {!items.length ? <span className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا توجد بنود.</Tx></span> : null}
      {editable ? (
        <form
          className="bos-input-group"
          onSubmit={(e) => {
            e.preventDefault();
            if (label.trim()) run(() => addChecklistItemAction(taskId, label), () => setLabel(""));
          }}
        >
          <div className="bos-field"><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="بند جديد..." /></div>
          <button type="submit" className="admin-btn small secondary" disabled={pending}><Tx>إضافة</Tx></button>
        </form>
      ) : null}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </div>
  );
}

export function Dependencies({ taskId, projectId, deps, editable }: { taskId: string; projectId: string | null; deps: { id: string; title: string; status: string }[]; editable: boolean }) {
  const t = useT();
  const { pending, error, run } = useRun();
  const [resetKey, setResetKey] = useState(0);
  return (
    <div className="bos-stack" style={{ gap: 6 }}>
      {deps.map((d) => (
        <div key={d.id} className="bos-row" style={{ justifyContent: "space-between" }}>
          <a className="bos-link" href={`/admin/projects/tasks/${d.id}`}><Tx>{d.title}</Tx></a>
          <span className="bos-row" style={{ gap: 6 }}>
            <span className="bos-faint" style={{ fontSize: 12 }}><Tx>{d.status === "completed" ? "✓ مكتملة" : "غير مكتملة"}</Tx></span>
            {editable ? <button type="button" className="bos-icon-btn" aria-label={t("إزالة")} disabled={pending} onClick={() => run(() => removeDependencyAction(taskId, d.id))}>×</button> : null}
          </span>
        </div>
      ))}
      {!deps.length ? <span className="bos-faint" style={{ fontSize: 12.5 }}><Tx>لا تعتمد على مهام أخرى.</Tx></span> : null}
      {editable ? (
        <EntitySelector
          key={resetKey}
          name="dep"
          placeholder="أضف مهمة تعتمد عليها..."
          search={(q) => searchEntitiesAction("task", q, projectId ? { project_id: projectId } : undefined)}
          onChange={(o) => {
            if (o && o.id !== taskId) run(() => addDependencyAction(taskId, o.id), () => setResetKey((k) => k + 1));
          }}
        />
      ) : null}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </div>
  );
}

export function TimerControls({ taskId, projectId, running }: { taskId: string; projectId: string | null; running: boolean }) {
  const { pending, error, run } = useRun();
  return (
    <span className="bos-stack" style={{ gap: 4 }}>
      {running ? (
        <button type="button" className="admin-btn small danger" disabled={pending} onClick={() => run(() => stopTimerAction())}><Tx>إيقاف المؤقت</Tx></button>
      ) : (
        <button type="button" className="admin-btn small success" disabled={pending} onClick={() => run(() => startTimerAction(taskId, projectId))}><Tx>بدء المؤقت</Tx></button>
      )}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </span>
  );
}

export function ArchiveTaskButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  return <ConfirmButton label="أرشفة" className="admin-btn small danger" message="أرشفة المهمة ومهامها الفرعية؟" action={() => archiveTaskAction(taskId)} onDone={() => router.push("/admin/projects/tasks")} />;
}
