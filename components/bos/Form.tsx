"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/bos/action";
import { useT, Tx } from "@/components/bos/I18n";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const FieldErrorsContext = createContext<Record<string, string>>({});

// Wraps a server action with validation feedback, pending state, success
// handling and an unsaved-changes guard (§71: no silent data loss).
export function ActionForm({
  action,
  children,
  successMessage,
  resetOnSuccess,
  onSuccess,
  redirectTo,
  guardUnsaved = true,
  className = "bos-form",
  id,
}: {
  action: FormAction;
  children: ReactNode;
  successMessage?: string;
  resetOnSuccess?: boolean;
  onSuccess?: (state: ActionState) => void;
  redirectTo?: string;
  guardUnsaved?: boolean;
  className?: string;
  id?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, { ok: true });
  // Unsaved changes = edited since the last action result, or the last result failed.
  const [editedAt, setEditedAt] = useState<ActionState | null>(null);
  const dirty = editedAt !== null && (editedAt === state || !state.ok);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const t = useT();

  useEffect(() => {
    if (!submitted) return;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!guardUnsaved || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, guardUnsaved]);

  const fieldErrors = !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <FieldErrorsContext.Provider value={fieldErrors}>
      <form
        id={id}
        ref={formRef}
        className={className}
        action={(fd) => {
          setSubmitted(true);
          return formAction(fd);
        }}
        onChange={() => setEditedAt(state)}
        noValidate={false}
      >
        {children}
        {submitted && !state.ok ? (
          <div className="bos-form-error" role="alert">
            {t(state.error ?? "")}
          </div>
        ) : null}
        {submitted && state.ok && (state.message || successMessage) ? (
          <div className="bos-form-success" role="status">
            {t(state.message ?? successMessage ?? "")}
          </div>
        ) : null}
      </form>
    </FieldErrorsContext.Provider>
  );
}

export function useFieldError(name: string): string | undefined {
  return useContext(FieldErrorsContext)[name];
}

export function Field({
  label,
  name,
  required,
  hint,
  span,
  children,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: ReactNode;
  span?: 2 | "all";
  children: ReactNode;
}) {
  const error = useFieldError(name);
  const t = useT();
  return (
    <div className={`bos-field${span === 2 ? " span-2" : span === "all" ? " span-all" : ""}`}>
      <label htmlFor={`f-${name}`}>
        {t(label)}
        {required ? <span className="req">*</span> : null}
      </label>
      {children}
      {error ? <span className="bos-field-error">{t(error)}</span> : hint ? <span className="bos-hint"><Tx>{hint}</Tx></span> : null}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: ReactNode; span?: 2 | "all" };

export function TextField({ name, label, hint, span, required, placeholder, ...rest }: InputProps) {
  const error = useFieldError(name);
  const t = useT();
  return (
    <Field label={label} name={name} required={required} hint={hint} span={span}>
      <input id={`f-${name}`} name={name} required={required} aria-invalid={error ? true : undefined} placeholder={placeholder ? t(placeholder) : undefined} {...rest} />
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  span = "all",
  required,
  placeholder,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; label: string; hint?: ReactNode; span?: 2 | "all" }) {
  const error = useFieldError(name);
  const t = useT();
  return (
    <Field label={label} name={name} required={required} hint={hint} span={span}>
      <textarea id={`f-${name}`} name={name} required={required} aria-invalid={error ? true : undefined} placeholder={placeholder ? t(placeholder) : undefined} {...rest} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  options,
  placeholder,
  hint,
  span,
  required,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: ReactNode;
  span?: 2 | "all";
}) {
  const error = useFieldError(name);
  const t = useT();
  return (
    <Field label={label} name={name} required={required} hint={hint} span={span}>
      <select id={`f-${name}`} name={name} required={required} aria-invalid={error ? true : undefined} {...rest}>
        {placeholder !== undefined ? <option value="">{t(placeholder)}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.label)}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: ReactNode }) {
  const t = useT();
  return (
    <div className="bos-field">
      <label className="bos-check">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} />
        {t(label)}
      </label>
      {hint ? <span className="bos-hint"><Tx>{hint}</Tx></span> : null}
    </div>
  );
}

export function MoneyField({
  name,
  currencyName,
  label,
  defaultValue,
  defaultCurrency = "USD",
  currencies,
  required,
  hint,
}: {
  name: string;
  currencyName: string;
  label: string;
  defaultValue?: string | number | null;
  defaultCurrency?: string | null;
  currencies: string[];
  required?: boolean;
  hint?: ReactNode;
}) {
  const error = useFieldError(name);
  const t = useT();
  return (
    <Field label={label} name={name} required={required} hint={hint}>
      <div className="bos-input-group">
        <input
          id={`f-${name}`}
          name={name}
          inputMode="decimal"
          pattern="^[0-9,]+(\.[0-9]{1,3})?$"
          defaultValue={defaultValue ?? ""}
          required={required}
          aria-invalid={error ? true : undefined}
          placeholder="0.00"
        />
        <select name={currencyName} defaultValue={defaultCurrency ?? "USD"} aria-label={t("العملة")}>
          {currencies.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

export function SubmitButton({ label = "حفظ", pendingLabel = "جارٍ الحفظ...", className = "admin-btn" }: { label?: string; pendingLabel?: string; className?: string }) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {t(pending ? pendingLabel : label)}
    </button>
  );
}

export function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="bos-form-section">
      {title ? <h2><Tx>{title}</Tx></h2> : null}
      <div className="bos-form-grid">{children}</div>
    </section>
  );
}
