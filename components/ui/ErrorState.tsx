import type { Dictionary } from "@/content/dictionaries";

interface ErrorStateProps {
  dictionary: Dictionary;
  onRetry?: () => void;
}

export function ErrorState({ dictionary, onRetry }: ErrorStateProps) {
  return (
    <div className="state-block">
      <svg className="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5" strokeLinecap="round" />
        <circle cx="12" cy="16" r="0.6" fill="currentColor" />
      </svg>
      <p className="state-title">{dictionary.common.errorTitle}</p>
      <p className="state-desc">{dictionary.common.errorDesc}</p>
      {onRetry ? (
        <button type="button" className="btn-primary" onClick={onRetry}>
          {dictionary.common.retry}
        </button>
      ) : null}
    </div>
  );
}
