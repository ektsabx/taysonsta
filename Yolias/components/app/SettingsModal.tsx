"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, CreditCard, Plug, Plus, SlidersHorizontal, User, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planLabel } from "@/lib/plans";
import {
  deleteAccount, inviteMember, removeMember, revokeInvitation, setAvatar, signOut, updatePreferences, type ActionResult,
} from "@/app/(app)/settings/actions";
import type { SettingsTab, ShellData } from "./types";

const tabs: { tab: SettingsTab; icon: typeof User }[] = [
  { tab: "general", icon: SlidersHorizontal },
  { tab: "account", icon: User },
  { tab: "usage", icon: Activity },
  { tab: "billing", icon: CreditCard },
  { tab: "team", icon: Users },
  { tab: "integration", icon: Plug },
];

interface Props {
  data: ShellData;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onClose: () => void;
}

export function SettingsModal({ data, tab, onTab, onClose }: Props) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);


  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <aside className="modal-sidebar">
          <div className="modal-sidebar-title">{t.settings.title}</div>
          {tabs.map(({ tab: id, icon: Icon }) => (
            <button key={id} className={`modal-nav-item${id === tab ? " active" : ""}`} type="button" onClick={() => onTab(id)}>
              <Icon />
              <span>{t.settings.tabs[id]}</span>
            </button>
          ))}
        </aside>

        <div className="modal-content-area">
          <div className="modal-header-clean">
            <h3 id="settings-title">{t.settings.titles[tab]}</h3>
            <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t.common.close}>
              <X />
            </button>
          </div>
          <div className="modal-body-scroll">
            {tab === "general" && <GeneralTab data={data} />}
            {tab === "account" && <AccountTab data={data} />}
            {tab === "usage" && <UsageTab data={data} />}
            {tab === "billing" && <BillingTab data={data} />}
            {tab === "team" && <TeamTab data={data} />}
            {tab === "integration" && <IntegrationTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  return { pending, error, run };
}

function applyAppearance(theme?: string, size?: string) {
  const d = document.documentElement;
  if (theme) {
    d.setAttribute("data-theme-pref", theme);
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    d.setAttribute("data-theme", dark ? "dark" : "light");
  }
  if (size) d.setAttribute("data-text-size", size);
}

/* ─────────────── General ─────────────── */

function GeneralTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const g = t.settings.general;
  const router = useRouter();
  // The language row always reflects the interface language actually shown.
  const [prefs, setPrefs] = useState({ ...data.preferences, language: locale });
  const { error, run } = useSave();

  const change = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    if (key === "theme") applyAppearance(value as string);
    if (key === "text_size") applyAppearance(undefined, value as string);
    run(async () => {
      const r = await updatePreferences({ [key]: value });
      // Language switches the whole interface (and direction).
      if (r.ok && key === "language") router.refresh();
      return r;
    });
  };

  return (
    <div className="setting-group">
      <SettingRow label={g.theme} desc={g.themeDesc}>
        <select className="form-select" value={prefs.theme} onChange={(e) => change("theme", e.target.value as typeof prefs.theme)}>
          <option value="system">{g.system}</option>
          <option value="light">{g.light}</option>
          <option value="dark">{g.dark}</option>
        </select>
      </SettingRow>
      <SettingRow label={g.textSize} desc={g.textSizeDesc}>
        <select className="form-select" value={prefs.text_size} onChange={(e) => change("text_size", e.target.value as typeof prefs.text_size)}>
          <option value="compact">{g.compact}</option>
          <option value="normal">{g.normal}</option>
          <option value="large">{g.large}</option>
        </select>
      </SettingRow>
      <SettingRow label={g.languages} desc={g.languagesDesc}>
        <select className="form-select" value={prefs.language} onChange={(e) => change("language", e.target.value as typeof prefs.language)}>
          <option value="en">{t.language.en}</option>
          <option value="ar">{t.language.ar}</option>
        </select>
      </SettingRow>
      <SettingRow label={g.timezone} desc={g.timezoneDesc}>
        <select className="form-select" value={prefs.timezone} onChange={(e) => change("timezone", e.target.value)}>
          <option value="Asia/Riyadh">{g.tzRiyadh}</option>
          <option value="Asia/Dubai">{g.tzDubai}</option>
          <option value="Africa/Cairo">{g.tzCairo}</option>
          <option value="Europe/London">{g.tzLondon}</option>
        </select>
      </SettingRow>
      <SettingRow label={g.country} desc={g.countryDesc}>
        <select className="form-select" value={prefs.country} onChange={(e) => change("country", e.target.value)}>
          <option value="SA">{g.sa}</option>
          <option value="AE">{g.ae}</option>
          <option value="EG">{g.eg}</option>
          <option value="GB">{g.gb}</option>
        </select>
      </SettingRow>
      <SettingRow label={g.notifications} desc={g.notificationsDesc}>
        <label className="switch">
          <input type="checkbox" checked={prefs.notify_campaign_done} onChange={(e) => change("notify_campaign_done", e.target.checked)} />
          <span className="slider" />
        </label>
      </SettingRow>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ─────────────── Account ─────────────── */

function AccountTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const a = t.settings.account;
  const [name, setName] = useState(data.user.name);
  const [avatarUrl, setAvatarUrl] = useState(data.user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { error, run, pending } = useSave();
  const [localError, setLocalError] = useState<string | null>(null);

  const saveName = () => {
    if (name.trim() && name.trim() !== data.user.name) run(() => updatePreferences({ full_name: name }));
  };

  const upload = async (file: File) => {
    setLocalError(null);
    if (!file.type.startsWith("image/")) return setLocalError(a.chooseImage);
    if (file.size > 2 * 1024 * 1024) return setLocalError(a.avatarTooLarge);
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${data.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      return setLocalError(a.uploadFailed);
    }
    const r = await setAvatar(path);
    setUploading(false);
    if (!r.ok) return setLocalError(r.error);
    setAvatarUrl(createClient().storage.from("avatars").getPublicUrl(path).data.publicUrl);
  };

  const removeAccount = () => {
    if (!window.confirm(a.deleteConfirm)) return;
    run(() => deleteAccount());
  };

  return (
    <div className="setting-group">
      <SettingRow label={a.avatar} desc={a.avatarDesc}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar" style={{ width: 40, height: 40, fontSize: ".8rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarUrl ? <img src={avatarUrl} alt="" /> : data.user.initials}
          </div>
          <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? a.uploading : a.change}
          </button>
          <input
            ref={fileRef}
            type="file"
            className="hidden-input"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </SettingRow>

      <SettingRow label={a.fullName} desc={a.fullNameDesc}>
        <div style={{ width: 200 }}>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
        </div>
      </SettingRow>

      <SettingRow label={a.email} desc={a.emailDesc}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="email" dir="ltr" className="form-input" value={data.user.email} style={{ width: 190 }} readOnly />
          {data.user.emailConfirmed && <span className="setting-ok">{a.verified}</span>}
        </div>
      </SettingRow>

      <SettingRow label={a.twoFactor} desc={a.twoFactorDesc}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="coming-soon">{t.common.comingSoon}</span>
          <label className="switch">
            <input type="checkbox" disabled checked={false} readOnly />
            <span className="slider" />
          </label>
        </div>
      </SettingRow>

      <div className="setting-section">
        <div className="setting-label">{a.devices}</div>
        <div className="setting-desc" style={{ marginBottom: 12 }}>{a.devicesDesc}</div>
        <div className="device-card">
          <div>
            <strong dir="ltr">{data.device.label}</strong> {a.currentSession}
            {data.device.ip && <div className="cell-sub" dir="ltr">{fmt(a.ip, { ip: data.device.ip })}</div>}
          </div>
          <span className="setting-ok" style={{ fontWeight: 600 }}>{a.activeNow}</span>
        </div>
        <button className="btn-secondary" style={{ marginTop: 12, fontSize: ".76rem" }} type="button" onClick={() => signOut("global")}>
          {a.logoutAll}
        </button>
      </div>

      {(error || localError) && <p className="form-error">{error ?? localError}</p>}

      <div className="danger-zone-box">
        <div>
          <div className="danger-title">{a.deleteTitle}</div>
          <div className="danger-desc">{a.deleteDesc}</div>
        </div>
        <button className="btn-danger" type="button" onClick={removeAccount} disabled={pending}>
          {a.deleteTitle}
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Usage ─────────────── */

function UsageTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const u = t.settings.usage;
  const { usage, workspace } = data;
  const n = (v: number) => formatNumber(v, locale);
  const pct = (used: number, total: number) => `${Math.min(100, total ? (used / total) * 100 : 0).toFixed(1)}%`;
  return (
    <div className="setting-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div className="setting-label">{u.quota}</div>
        <span className="setting-hint">{fmt(u.resets, { date: formatDate(usage.resetsAt, locale, "UTC") })}</span>
      </div>

      <div className="usage-card">
        <div className="usage-card-head">
          <span>{u.credits}</span>
          <span>{fmt(u.creditsValue, { used: n(usage.prospects), total: n(workspace.prospectCredits) })}</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: pct(usage.prospects, workspace.prospectCredits) }} /></div>
        <div className="setting-desc" style={{ marginTop: 8 }}>{u.creditsDesc}</div>
      </div>

      <div className="usage-card">
        <div className="usage-card-head">
          <span>{u.lookups}</span>
          <span>{fmt(u.lookupsValue, { used: n(usage.companies), total: n(workspace.companyLookups) })}</span>
        </div>
        <div className="progress-track"><div className="progress-fill red" style={{ width: pct(usage.companies, workspace.companyLookups) }} /></div>
        <div className="setting-desc" style={{ marginTop: 8 }}>{u.lookupsDesc}</div>
      </div>
    </div>
  );
}

/* ─────────────── Billing ─────────────── */

function BillingTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const b = t.settings.billing;
  const { workspace } = data;
  const canManage = data.role === "owner" || data.role === "admin";
  return (
    <div className="setting-group">
      <SettingRow label={b.plan} desc={b.planDesc}>
        <div style={{ textAlign: "end" }}>
          <span className="plan-badge" style={{ fontSize: ".75rem", padding: "3px 8px" }}>{fmt(b.planBadge, { plan: planLabel(workspace.plan, t) })}</span>
          <div style={{ fontSize: ".8rem", fontWeight: 700, marginTop: 4 }}>
            {workspace.priceUsd ? <><span dir="ltr">${workspace.priceUsd}</span> {t.common.perMonth}</> : t.common.free}
          </div>
          <div className="setting-hint">
            {workspace.periodEnd
              ? `${fmt(b.renews, { date: formatDate(workspace.periodEnd, locale) })}${workspace.subscriptionStatus === "test" ? ` · ${b.testMode}` : ""}`
              : fmt(b.creditsPerMonth, { count: formatNumber(workspace.prospectCredits, locale) })}
          </div>
          {canManage && (
            <a className="btn-secondary" style={{ fontSize: ".72rem", marginTop: 8 }} href="/checkout">
              {workspace.plan === "free" ? b.choosePlan : b.changePlan}
            </a>
          )}
        </div>
      </SettingRow>

      <SettingRow label={b.card} desc={b.cardDesc}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: ".8rem", fontWeight: 600 }}>{b.noCard}</div>
          <button className="btn-secondary" style={{ fontSize: ".75rem" }} type="button" disabled title={t.common.comingSoon}>{b.update}</button>
          <span className="coming-soon">{t.common.comingSoon}</span>
        </div>
      </SettingRow>

      <div className="setting-section">
        <div className="setting-label">{b.invoices}</div>
        <div className="setting-desc" style={{ marginBottom: 12 }}>{b.invoicesDesc}</div>
        <div className="data-table-card" style={{ boxShadow: "none" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{b.colDate}</th>
                <th>{b.colAmount}</th>
                <th>{b.colStatus}</th>
                <th style={{ textAlign: "end" }}>{b.colInvoice}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="empty-cell">{b.noInvoices}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Team ─────────────── */

function TeamTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const tm = t.settings.team;
  const canManage = data.role === "owner" || data.role === "admin";
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const { pending, error, run } = useSave();
  const roleLabel = (r: string) => (r === "owner" ? t.common.owner : r === "admin" ? t.common.admin : t.common.member);

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await inviteMember({ email, role });
      if (r.ok) {
        setEmail("");
        setInviting(false);
      }
      return r;
    });
  };

  return (
    <div className="setting-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
        <div>
          <div className="setting-label">{tm.members}</div>
          <div className="setting-desc">{tm.membersDesc}</div>
        </div>
        {canManage && (
          <button className="btn-primary" style={{ fontSize: ".75rem" }} type="button" onClick={() => setInviting((v) => !v)}>
            <Plus /> {tm.invite}
          </button>
        )}
      </div>

      {inviting && (
        <form className="device-card" style={{ marginTop: 0 }} onSubmit={submitInvite}>
          <input
            type="email"
            className="form-input"
            dir="ltr"
            placeholder={tm.invitePlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <select className="form-select" style={{ minWidth: 110 }} value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
            <option value="member">{t.common.member}</option>
            <option value="admin">{t.common.admin}</option>
          </select>
          <button className="btn-primary" type="submit" disabled={pending} style={{ fontSize: ".75rem" }}>
            {pending ? t.common.sending : t.common.send}
          </button>
        </form>
      )}

      <div>
        {data.team.members.map((m) => (
          <div className="device-card" key={m.user_id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: ".7rem" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : m.initials}
              </div>
              <div>
                <strong>{m.name}</strong> (<span dir="ltr">{m.email}</span>)
                <div className="cell-sub">{m.role === "owner" ? t.common.workspaceOwner : roleLabel(m.role)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="plan-badge">{m.role === "member" ? t.common.member : t.common.admin}</span>
              {canManage && m.role !== "owner" && m.user_id !== data.user.id && (
                <button
                  className="modal-close-btn"
                  type="button"
                  aria-label={fmt(tm.removeLabel, { name: m.name })}
                  onClick={() => window.confirm(fmt(tm.removeConfirm, { name: m.name })) && run(() => removeMember(m.user_id))}
                >
                  <X />
                </button>
              )}
            </div>
          </div>
        ))}
        {data.team.invitations.map((inv) => (
          <div className="device-card" key={inv.id}>
            <div>
              <strong dir="ltr">{inv.email}</strong>
              <div className="cell-sub">{fmt(tm.invitationSent, { role: roleLabel(inv.role) })}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="coming-soon">{t.common.pending}</span>
              {canManage && (
                <button className="modal-close-btn" type="button" aria-label={fmt(tm.revokeLabel, { email: inv.email })} onClick={() => run(() => revokeInvitation(inv.id))}>
                  <X />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ─────────────── Integration ─────────────── */

function IntegrationTab() {
  const { t } = useI18n();
  const it = t.settings.integration;
  return (
    <>
      <p style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: 18 }}>
        {it.intro}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="integration-card">
          <div>
            <strong>{it.crm}</strong>
            <div className="cell-sub">{it.crmDesc}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="coming-soon">{t.common.comingSoon}</span>
            <button className="btn-secondary" style={{ fontSize: ".72rem" }} type="button" disabled>{it.connect}</button>
          </div>
        </div>
        <div className="integration-card">
          <div>
            <strong>{it.sheets}</strong>
            <div className="cell-sub">{it.sheetsDesc}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="coming-soon">{t.common.comingSoon}</span>
            <button className="btn-primary" style={{ fontSize: ".72rem" }} type="button" disabled>{it.configure}</button>
          </div>
        </div>
      </div>
    </>
  );
}

function SettingRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-label-wrap">
        <div className="setting-label">{label}</div>
        <div className="setting-desc">{desc}</div>
      </div>
      {children}
    </div>
  );
}
