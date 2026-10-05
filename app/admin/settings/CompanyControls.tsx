"use client";

import { Tx } from "@/components/bos/I18n";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ActionButton } from "@/components/bos/Dialog";
import { createBrandUploadAction, finalizeBrandAction } from "./company-actions";

export function BrandUploader({ kind, current }: { kind: "logo" | "icon"; current: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState(0);
  const router = useRouter();
  const upload = (file: File) =>
    start(async () => {
      setError(null);
      const r = await createBrandUploadAction(kind, file.type, file.size);
      if (!r.ok || !r.data) return setError(r.ok ? "تعذر الرفع" : r.error);
      const { error: e } = await createClient().storage.from("bos-files").uploadToSignedUrl(r.data.path, r.data.token, file, { contentType: file.type });
      if (e) return setError("تعذر رفع الملف");
      const f = await finalizeBrandAction(kind, r.data.path);
      if (!f.ok) setError(f.error);
      setV(Date.now());
      router.refresh();
    });
  return (
    <div className="bos-row" style={{ gap: 10, alignItems: "center" }}>
      <span className="bos-brand-preview">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/bos/company-asset?k=${kind}&v=${v}`} alt="" />
        ) : <span className="bos-faint">—</span>}
      </span>
      <input ref={input} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button type="button" className="admin-btn small secondary" disabled={busy} onClick={() => input.current?.click()}><Tx>{busy ? "جارٍ الرفع..." : current ? "تغيير" : "رفع"}</Tx></button>
      {current ? <ActionButton label="إزالة" className="admin-btn small ghost" action={() => finalizeBrandAction(kind, null)} /> : null}
      {error ? <span className="bos-field-error"><Tx>{error}</Tx></span> : null}
    </div>
  );
}

export interface BranchRow { id: string; code: string; name: string; name_en: string | null; status: string; is_head_office: boolean; address: string | null; country: string | null; region: string | null; city: string | null; postal_code: string | null; timezone: string; currency: string | null; phone: string | null; email: string | null; manager_employee_id: string | null; work_schedule_id: string | null; notes: string | null }
