"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Image as ImageIcon, LoaderCircle, Paperclip, X } from "lucide-react";
import { createStrategy } from "@/app/(app)/actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { YoliasThinking } from "@/components/YoliasMark";
import { Greeting } from "@/components/app/Greeting";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { IMAGE_ACCEPT, checkImageFile } from "@/lib/uploads/image";
import { shrinkForAi } from "@/lib/uploads/shrink";

const MAX_FILES = 3;
const MAX_BYTES = 4 * 1024 * 1024; // documents; images follow lib/uploads/image.ts (10 MB)


export function StrategyComposer({ initialPrompt = "", profiles = [], firstName = null }: { initialPrompt?: string; profiles?: { id: string; name: string; is_default: boolean }[]; firstName?: string | null }) {
  const { t } = useI18n();
  const c = t.composer;
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  // Customer Profile for this search (AI Workspace, D-195): the default one is preselected.
  const [profileId, setProfileId] = useState(profiles.find((p) => p.is_default)?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // What was just sent: shown at once as the first message of the chat, with
  // Yolias thinking inside the chat (like Claude) until the search page opens.
  const [sent, setSent] = useState<{ text: string; files: string[] } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initialPrompt) inputRef.current?.focus();
  }, [initialPrompt]);

  const [imageHint, setImageHint] = useState(false);
  const addFiles = async (list: FileList | null, images = false) => {
    if (!list?.length) return;
    setError(null);
    const next = [...files];
    for (const raw of Array.from(list)) {
      let f = raw;
      if (images) {
        const bad = checkImageFile(f);
        if (bad) {
          setError(bad === "size" ? t.uploads.imageSize : t.uploads.imageType);
          continue;
        }
        // Very large photos are made smaller before they go to Yolias AI.
        f = await shrinkForAi(f);
      } else if (f.size > MAX_BYTES) {
        setError(fmt(c.errors.tooLarge, { name: f.name }));
        continue;
      }
      if (next.length >= MAX_FILES) {
        setError(fmt(c.errors.maxFiles, { count: MAX_FILES }));
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = () => {
    if (pending) return;
    if (!prompt.trim() && files.length === 0) {
      inputRef.current?.focus();
      return;
    }
    setError(null);
    const fd = new FormData();
    fd.set("prompt", prompt.trim());
    if (profileId) fd.set("customer_profile_id", profileId);
    for (const f of files) fd.append("files", f);
    const typed = prompt;
    setSent({ text: prompt.trim(), files: files.map((f) => f.name) });
    setPrompt("");
    start(async () => {
      const r = await callAction(() => createStrategy(fd));
      if (isNetworkFailure(r)) {
        setSent(null);
        setPrompt(typed);
        setError(t.strategy.errors.network);
        return;
      }
      if (!r.ok) {
        setSent(null);
        setPrompt(typed);
        setError(r.error);
        return;
      }
      setFiles([]);
      router.push(`/search/${r.id}`);
    });
  };

  return (
    <div className={`center-hero${sent ? " hero-sent" : ""}`}>
      {sent ? (
        <ol className="agent-turns home-turns">
          <li className="agent-turn user">
            <div className="agent-turn-body">
              {sent.text && <div className="agent-turn-text" dir="auto">{sent.text}</div>}
              {sent.files.length > 0 && <div className="cell-sub">{sent.files.join(" · ")}</div>}
            </div>
          </li>
          <li className="agent-turn assistant">
            <ThinkingSteps steps={c.thinking} />
          </li>
        </ol>
      ) : (
        <>
          <Greeting name={firstName} />
          <h1>{c.title}</h1>
          <p>{c.subtitle}</p>
        </>
      )}

      <div className="prompt-container">
        <textarea
          ref={inputRef}
          className="prompt-input"
          placeholder={c.placeholder}
          rows={3}
          value={prompt}
          disabled={pending}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />

        {files.length > 0 && (
          <div className="attachment-chips">
            {files.map((f, i) => (
              <span className="attachment-chip" key={`${f.name}-${i}`}>
                {f.type.startsWith("image/") ? <ImageIcon /> : <Paperclip />}
                {f.name}
                <button type="button" aria-label={fmt(c.removeFile, { name: f.name })} onClick={() => setFiles(files.filter((_, j) => j !== i))} disabled={pending}>
                  <X />
                </button>
              </span>
            ))}
          </div>
        )}

        {imageHint || files.some((f) => f.type.startsWith("image/")) ? <p className="upload-hint" id="composer-image-hint">{t.uploads.imageHint}</p> : null}

        <div className="prompt-footer">
          <div className="prompt-attachments">
            <button className="btn-attach" type="button" title={`${c.image} · ${t.uploads.imageHint}`} aria-describedby={imageHint ? "composer-image-hint" : undefined} onClick={() => { setImageHint(true); imageRef.current?.click(); }} disabled={pending}>
              <ImageIcon />
            </button>
            <input ref={imageRef} type="file" className="hidden-input" accept={IMAGE_ACCEPT} onChange={(e) => { const l = e.target.files; void addFiles(l, true).finally(() => { e.target.value = ""; }); }} />
            <button className="btn-attach" type="button" title={c.file} onClick={() => fileRef.current?.click()} disabled={pending}>
              <Paperclip />
            </button>
            <input ref={fileRef} type="file" className="hidden-input" accept=".csv,.pdf,.txt,.md,.tsv" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            {profiles.length > 0 && (
              <select className="composer-profile" aria-label={t.ws.ai.profiles.composerLabel} title={t.ws.ai.profiles.composerLabel} value={profileId} disabled={pending} onChange={(e) => setProfileId(e.target.value)}>
                <option value="">{t.ws.ai.profiles.composerNone}</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>

          <button className="btn-send" type="button" aria-label={c.send} onClick={submit} disabled={pending}>
            {pending ? <LoaderCircle className="spin" /> : <ArrowUp />}
          </button>
        </div>
      </div>
      <p className="ai-disclaimer">{t.agent.disclaimer}</p>


      {error && <p className="prompt-error" role="alert">{error}</p>}

    </div>
  );
}

// Cycles through what Yolias AI is doing while the strategy is understood.
function ThinkingSteps({ steps }: { steps: readonly string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), 2600);
    return () => window.clearInterval(id);
  }, [steps.length]);
  return <YoliasThinking label={steps[i]} />;
}
