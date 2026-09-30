"use client";

import { Tx, useT } from "@/components/bos/I18n";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createUploadAction,
  deleteFileAction,
  finalizeUploadAction,
  moveFileAction,
  renameFileAction,
  setFileClientVisibleAction,
} from "@/app/admin/_actions/common";

const MAX = 50 * 1024 * 1024;

export function FileUploader({
  entityType,
  entityId,
  allowClientVisible,
  replaceFileId,
  label = "رفع ملفات",
}: {
  entityType: string;
  entityId: string;
  allowClientVisible?: boolean;
  replaceFileId?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientVisible, setClientVisible] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const router = useRouter();

  async function upload(files: FileList | File[]) {
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const list = [...files];
    try {
      for (const [i, file] of list.entries()) {
        if (file.size > MAX) {
          setError(`${file.name}: الحد الأقصى 50MB`);
          continue;
        }
        setProgress(`جارٍ رفع ${file.name} (${i + 1}/${list.length})`);
        const started = await createUploadAction({
          entityType,
          entityId,
          name: file.name,
          size: file.size,
          mime: file.type || undefined,
          clientVisible: allowClientVisible ? clientVisible : false,
          replaceFileId,
        });
        if (!started.ok || !started.data) {
          setError(started.ok ? "تعذر بدء الرفع" : started.error);
          continue;
        }
        const { error: uploadError } = await supabase.storage.from("bos-files").uploadToSignedUrl(started.data.path, started.data.token, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (uploadError) {
          setError(`${file.name}: تعذر رفع الملف`);
          continue;
        }
        const finalized = await finalizeUploadAction(started.data.fileId);
        if (!finalized.ok) setError(finalized.error);
      }
    } finally {
      setBusy(false);
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
      }}
      style={{
        border: `1px dashed ${dragOver ? "rgba(229,31,38,0.6)" : "rgba(var(--bos-fg-rgb), 0.16)"}`,
        borderRadius: 8,
        padding: 12,
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input ref={inputRef} type="file" multiple={!replaceFileId} hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
      <button type="button" className="admin-btn small secondary" disabled={busy} aria-busy={busy} onClick={() => inputRef.current?.click()}>
        <Tx>{busy ? "جارٍ الرفع..." : label}</Tx>
      </button>
      <span className="bos-faint" style={{ fontSize: 12 }}>
        <Tx>{progress ?? "أو اسحب الملفات هنا (حتى 50MB للملف)"}</Tx>
      </span>
      {allowClientVisible && !replaceFileId ? (
        <label className="bos-check" style={{ marginInlineStart: "auto", fontSize: 12 }}>
          <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} />
          <Tx>مرئي للعميل في البوابة</Tx>
        </label>
      ) : null}
      {error ? <span className="bos-field-error" style={{ width: "100%" }}><Tx>{error}</Tx></span> : null}
    </div>
  );
}

export function FileRowActions({
  fileId,
  name,
  folder,
  clientVisible,
  entityType,
  entityId,
  allowClientVisible,
}: {
  fileId: string;
  name: string;
  folder: string;
  clientVisible: boolean;
  entityType: string;
  entityId: string;
  allowClientVisible?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [versioning, setVersioning] = useState(false);
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "تعذر تنفيذ الإجراء");
      else {
        setError(null);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="bos-menu" style={{ display: "inline-block" }}>
      <button type="button" className="bos-icon-btn" aria-label={t("إجراءات الملف")} onClick={() => setOpen((v) => !v)} disabled={pending}>
        ⋯
      </button>
      {open ? (
        <div className="bos-menu-panel">
          <a href={`/api/bos/files/${fileId}?download=1`}><Tx>تنزيل</Tx></a>
          <button
            type="button"
            onClick={() => {
              const next = window.prompt("الاسم الجديد", name);
              if (next && next !== name) run(() => renameFileAction(fileId, next));
            }}
          >
            <Tx>إعادة تسمية</Tx>
          </button>
          <button
            type="button"
            onClick={() => {
              const next = window.prompt("المجلد (مثال: /designs/v2)", folder);
              if (next !== null) run(() => moveFileAction(fileId, next));
            }}
          >
            <Tx>نقل إلى مجلد</Tx>
          </button>
          <button type="button" onClick={() => setVersioning((v) => !v)}>
            <Tx>رفع إصدار جديد</Tx>
          </button>
          {allowClientVisible ? (
            <button type="button" onClick={() => run(() => setFileClientVisibleAction(fileId, !clientVisible))}>
              <Tx>{clientVisible ? "إخفاء عن العميل" : "إظهار للعميل"}</Tx>
            </button>
          ) : null}
          <div className="bos-menu-sep" />
          <button
            type="button"
            style={{ color: "var(--bos-danger)" }}
            onClick={() => {
              if (window.confirm(`حذف "${name}"؟ يمكن للمسؤول استعادته لاحقاً.`)) run(() => deleteFileAction(fileId));
            }}
          >
            <Tx>حذف</Tx>
          </button>
          {versioning ? (
            <div style={{ padding: 6 }}>
              <FileUploader entityType={entityType} entityId={entityId} replaceFileId={fileId} label="اختر الإصدار الجديد" />
            </div>
          ) : null}
          {error ? <div className="bos-field-error" style={{ padding: 6 }}><Tx>{error}</Tx></div> : null}
        </div>
      ) : null}
    </div>
  );
}
