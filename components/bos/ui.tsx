import Link from "next/link";
import type { ReactNode } from "react";
import { statusDef, type Tone } from "@/lib/bos/labels";
import { formatMoney } from "@/lib/bos/money";
import { initials } from "@/lib/bos/format";
import { Tx } from "@/components/bos/I18n";

// Server-safe presentational building blocks shared by every module (§98, §99).
// String labels pass through <Tx>, so Arabic source text is shown in the
// user's language (docs/bos/30 §4) without each page translating it.

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="bos-page-header">
      <div style={{ minWidth: 0 }}>
        <h1><Tx>{title}</Tx></h1>
        {subtitle ? <div className="bos-subtitle"><Tx>{subtitle}</Tx></div> : null}
      </div>
      {actions ? <div className="bos-page-actions"><Tx>{actions}</Tx></div> : null}
    </div>
  );
}

export function Summary({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <div className="bos-summary">
      {items.map((item) => (
        <div className="bos-summary-item" key={item.label}>
          <div className="bos-summary-label"><Tx>{item.label}</Tx></div>
          <div className="bos-summary-value"><Tx>{item.value ?? "—"}</Tx></div>
        </div>
      ))}
    </div>
  );
}

export function Card({ title, actions, children, flush, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; id?: string }) {
  return (
    <section className="bos-card" id={id}>
      {title || actions ? (
        <div className="bos-card-header">
          {title ? <h2><Tx>{title}</Tx></h2> : <span />}
          {actions ? <div className="bos-row"><Tx>{actions}</Tx></div> : null}
        </div>
      ) : null}
      <div className={`bos-card-body${flush ? " flush" : ""}`}>{children}</div>
    </section>
  );
}

export function KeyValues({ items }: { items: { label: string; value: ReactNode; hidden?: boolean }[] }) {
  return (
    <div className="bos-kv">
      {items
        .filter((i) => !i.hidden)
        .map((item) => (
          <div className="bos-kv-item" key={item.label}>
            <div className="bos-kv-label"><Tx>{item.label}</Tx></div>
            <div className="bos-kv-value">{item.value === null || item.value === undefined || item.value === "" ? "—" : <Tx>{item.value}</Tx>}</div>
          </div>
        ))}
    </div>
  );
}

export function StatusBadge({ map, value, tone, label }: { map?: string; value?: string | null; tone?: Tone; label?: string }) {
  const def = map ? statusDef(map, value) : { label: label ?? value ?? "—", tone: tone ?? "neutral" };
  return <span className={`bos-badge tone-${tone ?? def.tone}`}><Tx>{label ?? def.label}</Tx></span>;
}

export function Money({ value, currency }: { value: unknown; currency: string | null | undefined }) {
  return <span className="bos-num">{formatMoney(value, currency)}</span>;
}

// Photo when the person has one (served by /api/bos/avatar, which falls
// back to an initials image), otherwise initials (docs/bos/28 §30).
export function avatarUrl(ref: { userId?: string | null; employeeId?: string | null; version?: string | null }): string | null {
  const v = ref.version ? `&v=${encodeURIComponent(ref.version)}` : "";
  if (ref.employeeId) return `/api/bos/avatar?e=${ref.employeeId}${v}`;
  if (ref.userId) return `/api/bos/avatar?u=${ref.userId}${v}`;
  return null;
}

export function UserAvatar({ name, photoUrl, userId, employeeId, version, size }: { name: string | null | undefined; photoUrl?: string | null; userId?: string | null; employeeId?: string | null; version?: string | null; size?: "lg" | "xl" }) {
  const src = photoUrl ?? avatarUrl({ userId, employeeId, version });
  return (
    <span className={`bos-avatar${size ? ` ${size}` : ""}`} title={name ?? undefined}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function UserChip({ name, href, userId, employeeId }: { name: string | null | undefined; href?: string | null; userId?: string | null; employeeId?: string | null }) {
  if (!name) return <span className="bos-faint"><Tx>غير معيّن</Tx></span>;
  const inner = (
    <span className="bos-user">
      <UserAvatar name={name} userId={userId} employeeId={employeeId} />
      <span className="bos-user-name">{name}</span>
    </span>
  );
  return href ? <Link href={href}><Tx>{inner}</Tx></Link> : inner;
}

export function EmptyState({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="bos-empty">
      <div className="bos-empty-title"><Tx>{title}</Tx></div>
      {description ? <div className="bos-empty-desc"><Tx>{description}</Tx></div> : null}
      {actions ? <div className="bos-row"><Tx>{actions}</Tx></div> : null}
    </div>
  );
}

export function ErrorState({ title, description, retryHref }: { title: string; description?: string; retryHref?: string }) {
  return (
    <div className="bos-error-state" role="alert">
      <div className="title"><Tx>{title}</Tx></div>
      {description ? <div className="bos-muted" style={{ fontSize: 13, marginBottom: 12 }}><Tx>{description}</Tx></div> : null}
      {retryHref ? (
        <Link href={retryHref} className="admin-btn secondary small">
          <Tx>إعادة المحاولة</Tx>
        </Link>
      ) : null}
    </div>
  );
}

export function LoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bos-card" aria-busy="true" aria-live="polite">
      <div className="bos-card-body">
        <div className="bos-skeleton bos-skeleton-line" style={{ width: "30%", height: 16 }} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bos-skeleton bos-skeleton-line" style={{ width: `${90 - (i % 3) * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true">
      <div className="bos-skeleton" style={{ height: 22, width: 220, marginBottom: 18 }} />
      <div className="bos-kpis">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bos-kpi">
            <div className="bos-skeleton" style={{ height: 12, width: "60%" }} />
            <div className="bos-skeleton" style={{ height: 22, width: "40%", marginTop: 8 }} />
          </div>
        ))}
      </div>
      <LoadingState rows={8} />
    </div>
  );
}

export function KpiCard({ label, value, sub, href, trend }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; trend?: "up" | "down" }) {
  const body = (
    <>
      <div className="bos-kpi-label"><Tx>{label}</Tx></div>
      <div className="bos-kpi-value">{value}</div>
      {sub ? <div className={`bos-kpi-sub${trend ? ` ${trend}` : ""}`}><Tx>{sub}</Tx></div> : null}
    </>
  );
  return <div className="bos-kpi">{href ? <Link href={href}>{body}</Link> : body}</div>;
}

export function ProgressBar({ value, tone }: { value: number; tone?: "success" | "warning" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="bos-row" style={{ gap: 8, flexWrap: "nowrap" }}>
      <div className={`bos-progress${tone ? ` ${tone}` : ""}`} style={{ flex: 1, minWidth: 60 }}>
        <span style={{ width: `${v}%` }} />
      </div>
      <span className="bos-num bos-muted" style={{ fontSize: 12, minWidth: 34 }}>
        {v}%
      </span>
    </div>
  );
}

export function Tabs({ tabs, active, baseHref, param = "tab" }: { tabs: { key: string; label: string; count?: number; hidden?: boolean }[]; active: string; baseHref: string; param?: string }) {
  return (
    <nav className="bos-tabs" aria-label="tabs">
      {tabs
        .filter((t) => !t.hidden)
        .map((tab) => {
          const sep = baseHref.includes("?") ? "&" : "?";
          return (
            <Link key={tab.key} href={`${baseHref}${sep}${param}=${tab.key}`} className={tab.key === active ? "active" : undefined} scroll={false}>
              <Tx>{tab.label}</Tx>
              {tab.count !== undefined ? <span className="count">{tab.count}</span> : null}
            </Link>
          );
        })}
    </nav>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return <span className="bos-tag"><Tx>{children}</Tx></span>;
}
