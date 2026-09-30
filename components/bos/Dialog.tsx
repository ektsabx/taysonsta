"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/bos/action";
import { Tx, useT } from "@/components/bos/I18n";

// Modal / Drawer on the native <dialog> element (focus trap + Esc for free).
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
  drawer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const t = useT();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`bos-dialog${wide ? " wide" : ""}${drawer ? " bos-drawer" : ""}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <>
          <div className="bos-dialog-head">
            <h2><Tx>{title}</Tx></h2>
            <button type="button" className="bos-icon-btn" onClick={onClose} aria-label={t("إغلاق")}>
              ×
            </button>
          </div>
          <div className="bos-dialog-body">{children}</div>
          {footer ? <div className="bos-dialog-foot"><Tx>{footer}</Tx></div> : null}
        </>
      ) : null}
    </dialog>
  );
}

export function Drawer(props: Omit<Parameters<typeof Modal>[0], "drawer">) {
  return <Modal {...props} drawer />;
}

// A button that opens a modal with arbitrary content (usually a form).
export function ModalButton({
  label,
  title,
  children,
  className = "admin-btn",
  wide,
  drawer,
}: {
  label: ReactNode;
  title: ReactNode;
  children: (close: () => void) => ReactNode;
  className?: string;
  wide?: boolean;
  drawer?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Tx>{label}</Tx>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide={wide} drawer={drawer}>
        {children(() => setOpen(false))}
      </Modal>
    </>
  );
}

// Confirmation before destructive/irreversible actions (§71).
export function ConfirmButton({
  label,
  title = "تأكيد الإجراء",
  message,
  confirmLabel = "تأكيد",
  action,
  className = "admin-btn danger",
  requireReason,
  reasonLabel = "السبب",
  onDone,
}: {
  label: ReactNode;
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  action: (reason?: string) => Promise<ActionState>;
  className?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useT();

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <Tx>{label}</Tx>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        footer={
          <>
            <button type="button" className="admin-btn ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t("إلغاء")}
            </button>
            <button
              type="button"
              className={className.includes("danger") ? "admin-btn danger" : "admin-btn"}
              disabled={pending || (requireReason && !reason.trim())}
              aria-busy={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = await action(reason.trim() || undefined);
                  if (result.ok) {
                    setOpen(false);
                    setReason("");
                    onDone?.();
                    router.refresh();
                  } else {
                    setError(result.error);
                  }
                })
              }
            >
              {t(pending ? "جارٍ التنفيذ..." : confirmLabel)}
            </button>
          </>
        }
      >
        <div className="bos-stack">
          <div style={{ fontSize: 13.5 }}><Tx>{message}</Tx></div>
          {requireReason ? (
            <div className="bos-field">
              <label htmlFor="confirm-reason">
                {t(reasonLabel)}
                <span className="req">*</span>
              </label>
              <textarea id="confirm-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          ) : null}
          {error ? <div className="bos-form-error">{t(error)}</div> : null}
        </div>
      </Modal>
    </>
  );
}

// Fire-and-refresh button for simple actions (no confirmation).
export function ActionButton({
  label,
  action,
  className = "admin-btn secondary",
  pendingLabel,
}: {
  label: ReactNode;
  action: () => Promise<ActionState>;
  className?: string;
  pendingLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();
  return (
    <span className="bos-stack" style={{ gap: 4, display: "inline-flex" }}>
      <button
        type="button"
        className={className}
        disabled={pending}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await action();
            if (!result.ok) setError(result.error);
            else router.refresh();
          })
        }
      >
        {pending ? t(pendingLabel ?? "...") : <Tx>{label}</Tx>}
      </button>
      {error ? <span className="bos-field-error">{t(error)}</span> : null}
    </span>
  );
}
