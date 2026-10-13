"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { YoliasMark } from "@/components/YoliasMark";
import { useI18n } from "@/lib/i18n/client";
import { markWelcomeSeen } from "@/app/(app)/welcome-actions";
import type { WelcomeVideo } from "@/lib/welcome-video";

// "Hey There, I'm Yolias" (D-199): shown once after sign-in; closing it (any
// way) records it as seen. A video that fails to load never blocks the app.
export function WelcomeVideoModal({ video, onClose }: { video: WelcomeVideo; onClose: () => void }) {
  const { t } = useI18n();
  const w = t.ws.welcome;
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    markWelcomeSeen().catch(() => {});
    onClose();
  };
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="modal-overlay welcome-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <button ref={closeRef} className="modal-close-btn welcome-close" type="button" aria-label={t.common.close} onClick={close}><X /></button>
        <div className="welcome-head">
          <span className="welcome-mark"><YoliasMark /></span>
          <h2 id="welcome-title">{w.greeting}</h2>
        </div>
        <div className="welcome-copy">
          <strong>{video.title || w.question}</strong>
          <p>{video.description || w.lead}</p>
        </div>
        <div className="welcome-player">
          {failed ? (
            <div className="welcome-fallback">
              <p>{w.videoError}</p>
              <a className="btn-secondary" href={video.url} target="_blank" rel="noopener noreferrer"><ExternalLink /> {w.openExternal}</a>
            </div>
          ) : video.kind === "iframe" ? (
            <iframe src={video.src} title={video.title || w.question} allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          ) : (
            <video src={video.src} controls playsInline preload="metadata" onError={() => setFailed(true)} />
          )}
        </div>
        <div className="welcome-actions">
          <button className="btn-primary" type="button" onClick={close}>{w.start}</button>
        </div>
      </div>
    </div>
  );
}
