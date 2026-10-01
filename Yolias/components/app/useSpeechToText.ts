"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Voice → Speech-to-Text → text in the search box. The search itself is then
// parsed exactly like typed text, so voice and keyboard share one pipeline.
//
// Two engines:
// - "browser": the Web Speech API (Chrome, Edge, Safari). Free, live words.
// - "server": record with MediaRecorder and POST to /api/transcribe, which
//   calls the configured STT provider. Used when the browser has no speech
//   engine or its engine fails (e.g. Brave/Firefox, or "network" errors).

export type SttStatus = "idle" | "listening" | "transcribing";
export type SttError = "unsupported" | "blocked" | "noMic" | "noSpeech" | "network" | "failed" | "notConfigured";

interface Options {
  /** BCP-47 language for the browser engine, e.g. "ar-EG" or "en-US". */
  lang: string;
  /** Called with the text heard so far (final + live words). */
  onText: (text: string) => void;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

const SILENCE_MS = 6000;
const MAX_RECORD_MS = 60_000;

function browserEngine(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function canRecord(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useSpeechToText({ lang, onText }: Options) {
  const [status, setStatus] = useState<SttStatus>("idle");
  const [error, setError] = useState<SttError | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  // A browser engine that failed once (network, service-not-allowed) is skipped next time.
  const browserBrokenRef = useRef(false);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const clearTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const stop = useCallback(() => {
    clearTimer();
    recRef.current?.stop();
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  }, []);

  useEffect(() => () => {
    clearTimer();
    recRef.current?.abort();
    if (mediaRef.current?.state === "recording") mediaRef.current.stop();
  }, []);

  // ── server engine ──────────────────────────────────────────────
  const startServer = useCallback(async (base: string) => {
    if (!canRecord()) {
      setError("unsupported");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(e instanceof DOMException && e.name === "NotFoundError" ? "noMic" : "blocked");
      return;
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    const media = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    media.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    media.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      mediaRef.current = null;
      clearTimer();
      const blob = new Blob(chunks, { type: media.mimeType || "audio/webm" });
      if (blob.size < 1200) {
        setStatus("idle");
        setError("noSpeech");
        return;
      }
      setStatus("transcribing");
      try {
        const fd = new FormData();
        fd.set("audio", blob, `voice.${blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
        fd.set("lang", lang.slice(0, 2));
        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        const body = (await res.json().catch(() => ({}))) as { text?: string; error?: SttError };
        if (!res.ok || !body.text) {
          setError(body.error ?? (res.ok ? "noSpeech" : "failed"));
        } else {
          onTextRef.current([base, body.text.trim()].filter(Boolean).join(" "));
        }
      } catch {
        setError("network");
      }
      setStatus("idle");
    };
    mediaRef.current = media;
    media.start();
    setStatus("listening");
    timerRef.current = window.setTimeout(() => media.state === "recording" && media.stop(), MAX_RECORD_MS);
  }, [lang]);

  // ── browser engine ─────────────────────────────────────────────
  const start = useCallback((currentText: string) => {
    setError(null);
    const base = currentText.trim();
    const Ctor = browserBrokenRef.current ? null : browserEngine();
    if (!Ctor) {
      void startServer(base);
      return;
    }
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    let finalText = "";
    let failed: string | null = null;

    const armSilence = () => {
      clearTimer();
      timerRef.current = window.setTimeout(() => rec.stop(), SILENCE_MS);
    };

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const piece = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      onTextRef.current([base, `${finalText}${interim}`.trim()].filter(Boolean).join(" "));
      armSilence();
    };
    rec.onerror = (e) => {
      failed = e.error;
    };
    rec.onend = () => {
      clearTimer();
      recRef.current = null;
      setStatus("idle");
      if (!failed || failed === "aborted") return;
      if (failed === "not-allowed") setError("blocked");
      else if (failed === "no-speech") setError("noSpeech");
      else {
        // "network", "audio-capture", "service-not-allowed", "language-not-supported":
        // the browser's engine can't serve us — record ourselves and use server STT
        // (getUserMedia then reports a missing microphone precisely).
        browserBrokenRef.current = true;
        void startServer(base);
      }
    };
    recRef.current = rec;
    setStatus("listening");
    armSilence();
    try {
      rec.start();
    } catch {
      recRef.current = null;
      browserBrokenRef.current = true;
      void startServer(base);
    }
  }, [lang, startServer]);

  return { status, error, start, stop, clearError: () => setError(null) };
}
