interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="state-block">
      <svg className="state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18" strokeLinecap="round" />
      </svg>
      <p className="state-title">{title}</p>
      {description ? <p className="state-desc">{description}</p> : null}
    </div>
  );
}
