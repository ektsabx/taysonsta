"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Building2, Image as ImageIcon, LoaderCircle, Mic, Paperclip, Search, Sparkles, X } from "lucide-react";
import { createStrategy } from "@/app/(app)/actions";

const quickActions = [
  { icon: Search, label: "UAE Fintech Companies (50-200)", prompt: "Find 100 fintech companies in UAE with 50–200 employees" },
  { icon: Sparkles, label: "Saudi SaaS Founders", prompt: "Discover high-growth B2B SaaS founders in Saudi Arabia hiring sales & engineering" },
  { icon: Building2, label: "Egyptian Logistics ICP", prompt: "Extract decision makers from top logistics companies in Egypt" },
];

const PLACEHOLDER = "e.g. Find 100 fintech companies in UAE with 50–200 employees and extract their founders...";
const LISTENING = "Listening to your target customer criteria...";
const MAX_FILES = 3;
const MAX_BYTES = 4 * 1024 * 1024;

// Minimal Web Speech API typing (not in lib.dom for all browsers).
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

export function StrategyComposer({ initialPrompt = "", speechLang = "en-US" }: { initialPrompt?: string; speechLang?: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    if (!initialPrompt) inputRef.current?.focus();
    return () => recRef.current?.stop();
  }, [initialPrompt]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) {
        setError(`${f.name} is larger than 4 MB.`);
        continue;
      }
      if (next.length >= MAX_FILES) {
        setError(`Attach up to ${MAX_FILES} files.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const toggleRecording = () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input isn't supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new Ctor();
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = false;
    const base = prompt.trim();
    let spoken = "";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) spoken += `${e.results[i][0].transcript} `;
      }
      setPrompt([base, spoken.trim()].filter(Boolean).join(" "));
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setError("Microphone access was blocked.");
    };
    rec.onend = () => {
      setRecording(false);
      recRef.current = null;
    };
    recRef.current = rec;
    setError(null);
    setRecording(true);
    rec.start();
  };

  const submit = () => {
    if (pending) return;
    if (!prompt.trim() && files.length === 0) {
      inputRef.current?.focus();
      return;
    }
    recRef.current?.stop();
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
      router.push(`/strategies/${r.id}`);
    });
  };

  return (
    <div className="center-hero">
      <h1>Tell Yolias who you want to sell to.</h1>
      <p>
        Autonomous customer discovery. Specify your ideal company size, market, or industry, and Yolias finds verified decision makers for you.
      </p>

      <div className="prompt-container">
        <textarea
          ref={inputRef}
          className="prompt-input"
          placeholder={recording ? LISTENING : PLACEHOLDER}
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
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} disabled={pending}>
                  <X />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="prompt-footer">
          <div className="prompt-attachments">
            <button className={`btn-attach${recording ? " recording-active" : ""}`} type="button" title="Record voice instructions" onClick={toggleRecording} disabled={pending}>
              <Mic />
            </button>
            <button className="btn-attach" type="button" title="Upload company screenshot / ICP document" onClick={() => imageRef.current?.click()} disabled={pending}>
              <ImageIcon />
            </button>
            <input ref={imageRef} type="file" className="hidden-input" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <button className="btn-attach" type="button" title="Attach ICP Specs / CSV" onClick={() => fileRef.current?.click()} disabled={pending}>
              <Paperclip />
            </button>
            <input ref={fileRef} type="file" className="hidden-input" accept=".csv,.pdf,.txt,.md,.tsv" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          <button className="btn-send" type="button" aria-label="Find customers" onClick={submit} disabled={pending}>
            {pending ? <LoaderCircle className="spin" /> : <ArrowUp />}
          </button>
        </div>
      </div>

      {error && <p className="prompt-error" role="alert">{error}</p>}

      <div className="quick-actions-bar">
        {quickActions.map(({ icon: Icon, label, prompt: p }) => (
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
        ))}
      </div>
    </div>
  );
}
