"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PortalForm } from "./PortalControls";
import { portalFinishUploadAction, portalStartUploadAction, portalSupportMessageAction } from "./extra-actions";

export function PortalUpload({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [project, setProject] = useState(projects[0]?.id ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!projects.length) return null;
  const onFile = (file: File | undefined) => {
    if (!file || !project) return;
    start(async () => {
      setMsg(null);
      const s = await portalStartUploadAction({ projectId: project, name: file.name, size: file.size, mime: file.type || null });
      if (!s.ok || !s.data) return setMsg({ ok: false, text: s.ok ? "تعذر بدء الرفع" : s.error });
      const { error } = await createClient().storage.from("bos-files").uploadToSignedUrl(s.data.path, s.data.token, file, { contentType: file.type || "application/octet-stream" });
      if (error) return setMsg({ ok: false, text: "تعذر رفع الملف" });
      const f = await portalFinishUploadAction(s.data.fileId);
      setMsg(f.ok ? { ok: true, text: "تم رفع الملف وإبلاغ فريق المشروع" } : { ok: false, text: f.error });
      router.refresh();
    });
  };
  return (
    <div className="portal-card">
      <h3 style={{ marginTop: 0 }}>رفع ملف للفريق</h3>
      <div className="field"><label htmlFor="pu-project">المشروع</label><select id="pu-project" value={project} onChange={(e) => setProject(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
      <div className="field"><label htmlFor="pu-file">الملف (حتى 25MB)</label><input id="pu-file" type="file" disabled={pending} onChange={(e) => onFile(e.target.files?.[0])} /></div>
      {pending ? <p className="portal-muted">جارٍ الرفع...</p> : null}
      {msg ? <p className={msg.ok ? "portal-ok" : "portal-error"}>{msg.text}</p> : null}
    </div>
  );
}

export function SupportMessageForm({ conversationId }: { conversationId: string | null }) {
  return (
    <PortalForm action={portalSupportMessageAction.bind(null, conversationId)} submit={conversationId ? "إرسال" : "بدء المحادثة"} reset>
      {!conversationId ? <div className="field"><label htmlFor="subject">الموضوع</label><input id="subject" name="subject" maxLength={200} /></div> : null}
      <div className="field"><label htmlFor="body">رسالتك</label><textarea id="body" name="body" rows={4} required maxLength={10000} /></div>
    </PortalForm>
  );
}
