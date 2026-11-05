"use client";

import { useRef, useState } from "react";
import { Film, Image as ImageIcon, Mic, Paperclip, Smile, Square, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/Toast";
import { uploadInboxFile } from "@/app/(app)/inbox/actions";
import { MAX_FILES, toolsFor, type InboxFile } from "@/lib/inbox-channels";

const EMOJI = ["😀", "😊", "😂", "😍", "🙏", "👍", "👏", "🎉", "🔥", "✅", "💡", "📅", "📎", "🤝", "🚀", "❤️", "😉", "🤔", "👋", "💼"];

// The reply box's tools, by channel (owner, 2026-11-05).
export function ReplyTools({ channel, files, onFiles, onEmoji, disabled }: { channel: string | null; files: InboxFile[]; onFiles: (f: InboxFile[]) => void; onEmoji: (e: string) => void; disabled: boolean }) {
  const { t } = useI18n();
  const L = t.ag.rx.inbox.tools;
  const toast = useToast();
  const tools = toolsFor(channel);
  const input = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rec, setRec] = useState<MediaRecorder | null>(null);

  const add = async (list: File[]) => {
    if (files.length + list.length > MAX_FILES) return toast(L.tooMany, "error");
    setBusy(true);
    const out = [...files];
    for (const f of list) {
      const fd = new FormData();
      fd.set("file", f);
      const r = await uploadInboxFile(fd).catch(() => null);
      if (r?.ok) out.push(r.file); else toast(r?.error ?? L.failed, "error");
    }
    onFiles(out);
    setBusy(false);
  };
  const pick = (a: string) => { setAccept(a); setTimeout(() => input.current?.click(), 0); };
  const record = async () => {
    if (rec) { rec.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((x) => x.stop());
        setRec(null);
        const type = r.mimeType.split(";")[0] || "audio/webm";
        void add([new File(chunks, `voice-${Date.now()}.${type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm"}`, { type })]);
      };
      r.start();
      setRec(r);
    } catch {
      toast(L.noMic, "error");
    }
  };

  return (
    <div className="sdr-reply-tools">
      <input ref={input} type="file" hidden multiple accept={accept} onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ""; if (l.length) void add(l); }} />
      <div className="sdr-reply-toolbar">
        {tools.includes("file") && <button type="button" className="sdr-icon-btn" title={L.file} aria-label={L.file} disabled={disabled || busy} onClick={() => pick("")}><Paperclip /></button>}
        {tools.includes("image") && <button type="button" className="sdr-icon-btn" title={L.image} aria-label={L.image} disabled={disabled || busy} onClick={() => pick("image/*")}><ImageIcon /></button>}
        {tools.includes("gif") && <button type="button" className="sdr-icon-btn" title={L.gif} aria-label={L.gif} disabled={disabled || busy} onClick={() => pick("image/gif")}><Film /></button>}
        {tools.includes("emoji") && <button type="button" className="sdr-icon-btn" title={L.emoji} aria-label={L.emoji} aria-expanded={emoji} disabled={disabled} onClick={() => setEmoji(!emoji)}><Smile /></button>}
        {tools.includes("voice") && <button type="button" className={`sdr-icon-btn${rec ? " on" : ""}`} title={rec ? L.stop : L.voice} aria-label={rec ? L.stop : L.voice} disabled={disabled || busy} onClick={() => void record()}>{rec ? <Square /> : <Mic />}</button>}
        {busy && <span className="sdr-cell-sub">{L.uploading}</span>}
      </div>
      {emoji && <div className="sdr-emoji" role="listbox" aria-label={L.emoji}>{EMOJI.map((e) => <button key={e} type="button" onClick={() => onEmoji(e)}>{e}</button>)}</div>}
      {files.length > 0 && <ul className="sdr-reply-files">{files.map((f) => <li key={f.path}><span dir="auto">{f.name}</span><button type="button" aria-label={L.remove} onClick={() => onFiles(files.filter((x) => x.path !== f.path))}><X /></button></li>)}</ul>}
    </div>
  );
}
