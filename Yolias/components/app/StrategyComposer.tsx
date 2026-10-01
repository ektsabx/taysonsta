"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Building2, Image as ImageIcon, LoaderCircle, Mic, Paperclip, Search, Sparkles, Square, X } from "lucide-react";
import { useSpeechToText } from "./useSpeechToText";
import { createStrategy } from "@/app/(app)/actions";
import { YoliasThinking } from "@/components/YoliasMark";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";

const pillIcons = [Search, Sparkles, Building2];
const MAX_FILES = 3;
const MAX_BYTES = 4 * 1024 * 1024;


export function StrategyComposer({ initialPrompt = "", speechLang = "en-US" }: { initialPrompt?: string; speechLang?: string }) {
  const { t } = useI18n();
  const c = t.composer;
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Voice → Speech-to-Text → this text box → the same search parser as typing.
  const stt = useSpeechToText({ lang: speechLang, onText: setPrompt });
  const recording = stt.status === "listening";
  const transcribing = stt.status === "transcribing";
  const voiceError = stt.error ? c.voiceErrors[stt.error] : null;

  useEffect(() => {
    if (!initialPrompt) inputRef.current?.focus();
  }, [initialPrompt]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) {
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

  const toggleRecording = () => {
    if (recording) stt.stop();
    else {
      setError(null);
      stt.start(prompt);
    }
  };

  const submit = () => {
    if (pending) return;
    if (!prompt.trim() && files.length === 0) {
      inputRef.current?.focus();
      return;
    }
    stt.stop();
    setError(null);
    const fd = new FormData();
    fd.set("prompt", prompt.trim());
    for (const f of files) fd.append("files", f);
    start(async () => {
      const r = await createStrategy(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFiles([]);
      router.push(`/search/${r.id}`);
    });
  };

  return (
    <div className="center-hero">
      <h1>{c.title}</h1>
      <p>{c.subtitle}</p>

      <div className="prompt-container">
        <textarea
          ref={inputRef}
          className="prompt-input"
          placeholder={recording ? c.listening : transcribing ? c.transcribing : c.placeholder}
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

        <div className="prompt-footer">
          <div className="prompt-attachments">
            <button className={`btn-attach${recording ? " recording-active" : ""}`} type="button" title={recording ? c.stopRecording : c.record} aria-label={recording ? c.stopRecording : c.record} aria-pressed={recording} onClick={toggleRecording} disabled={pending || transcribing}>
              {transcribing ? <LoaderCircle className="spin" /> : recording ? <Square /> : <Mic />}
            </button>
            <button className="btn-attach" type="button" title={c.image} onClick={() => imageRef.current?.click()} disabled={pending}>
              <ImageIcon />
            </button>
            <input ref={imageRef} type="file" className="hidden-input" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <button className="btn-attach" type="button" title={c.file} onClick={() => fileRef.current?.click()} disabled={pending}>
              <Paperclip />
            </button>
            <input ref={fileRef} type="file" className="hidden-input" accept=".csv,.pdf,.txt,.md,.tsv" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          <button className="btn-send" type="button" aria-label={c.send} onClick={submit} disabled={pending}>
            {pending ? <LoaderCircle className="spin" /> : <ArrowUp />}
          </button>
        </div>
      </div>

      {pending && (
        <div className="composer-thinking">
          <ThinkingSteps steps={c.thinking} />
        </div>
      )}

      {(error || voiceError) && <p className="prompt-error" role="alert">{error ?? voiceError}</p>}

      <div className="quick-actions-bar">
        {c.pills.map(({ label, prompt: p }, i) => {
          const Icon = pillIcons[i % pillIcons.length];
          return (
          <button
            key={label}
            className="action-pill"
            type="button"
            disabled={pending}
            onClick={() => {
              setPrompt(p);
              inputRef.current?.focus();
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
          );
        })}
      </div>
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
