"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Bell, Building2, CreditCard, Plug, Plus, RotateCw, SlidersHorizontal, User, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { countryLabel, formatDate, formatMoney, formatNumber } from "@/lib/format";
import { COUNTRIES, TIMEZONES, timeZoneLabel } from "@/lib/regions";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName } from "@/lib/plans";
import { useToast } from "@/components/Toast";
import { GmailIcon, GoogleSheetsIcon, HubSpotIcon, OutlookIcon } from "./ConnectorIcons";
import {
  changeEmail, deleteAccount, inviteMember, refreshUsage, removeMember, revokeInvitation, setAvatar, setPlanCanceled, signOut, updateOrganization, updatePreferences, type ActionResult,
} from "@/app/(app)/settings/actions";
import { buyProspectPack } from "@/app/checkout/actions";
import type { SettingsTab, ShellData } from "./types";
import type { Currency } from "@/types/database";

const tabs: { tab: SettingsTab; icon: typeof User }[] = [
  { tab: "general", icon: SlidersHorizontal },
  { tab: "account", icon: User },
  { tab: "organization", icon: Building2 },
  { tab: "notifications", icon: Bell },
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
            {tab === "organization" && <OrganizationTab data={data} />}
            {tab === "notifications" && <NotificationsTab data={data} />}
            {tab === "usage" && <UsageTab data={data} />}
            {tab === "billing" && <BillingTab data={data} />}
            {tab === "team" && <TeamTab data={data} />}
            {tab === "integration" && <IntegrationTab data={data} />}
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
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{timeZoneLabel(tz, locale)}</option>)}
        </select>
      </SettingRow>
      <SettingRow label={g.country} desc={g.countryDesc}>
        <select className="form-select" value={prefs.country} onChange={(e) => change("country", e.target.value)}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{countryLabel(c, locale)}</option>)}
        </select>
      </SettingRow>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ─────────────── Account ─────────────── */

// The company details from onboarding (D-139). Owners and admins edit them.
function OrganizationTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const o = t.settings.organization;
  const manage = data.role === "owner" || data.role === "admin";
  const [form, setForm] = useState({ name: data.workspace.name, website: data.workspace.website ?? "", offering: data.workspace.offering ?? "" });
  const [saved, setSaved] = useState(false);
  const { error, run, pending } = useSave();
  const save = () => run(async () => {
    const r = await updateOrganization(form);
    setSaved(r.ok);
    return r;
  });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setSaved(false); setForm({ ...form, [k]: e.target.value }); };
  return (
    <div className="setting-group">
      <SettingRow label={o.name} desc={o.nameDesc}>
        <input className="form-input" value={form.name} maxLength={160} disabled={!manage} onChange={set("name")} />
      </SettingRow>
      <SettingRow label={o.website} desc={o.websiteDesc}>
        <input className="form-input" dir="ltr" value={form.website} maxLength={200} disabled={!manage} onChange={set("website")} />
      </SettingRow>
      <div className="setting-row setting-row-stack">
        <div className="setting-label-wrap">
          <div className="setting-label">{o.offering}</div>
          <div className="setting-desc">{o.offeringDesc}</div>
        </div>
        <textarea className="form-input" rows={4} value={form.offering} maxLength={2000} disabled={!manage} onChange={set("offering")} />
      </div>
      {manage ? (
        <div className="setting-actions">
          {error && <p className="form-error" role="alert">{error}</p>}
          {saved && !error && <span className="setting-desc">{o.saved}</span>}
          <button className="btn-primary" type="button" disabled={pending} onClick={save}>{o.save}</button>
        </div>
      ) : <p className="setting-desc">{o.onlyAdmins}</p>}
    </div>
  );
}

function AccountTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const a = t.settings.account;
  const [name, setName] = useState(data.user.name);
  const [avatarUrl, setAvatarUrl] = useState(data.user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { error, run, pending } = useSave();
  const [localError, setLocalError] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailNote, setEmailNote] = useState<string | null>(null);

  const requestEmailChange = () =>
    run(async () => {
      const r = await changeEmail({ email: newEmail });
      if (r.ok) {
        setEditingEmail(false);
        setNewEmail("");
        setEmailNote(a.emailChangeSent);
      }
      return r;
    });

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
          {!editingEmail && (
            <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" onClick={() => { setEditingEmail(true); setEmailNote(null); }}>
              {a.changeEmail}
            </button>
          )}
        </div>
      </SettingRow>
      {editingEmail && (
        <div className="setting-section" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="email" dir="ltr" className="form-input" placeholder={a.newEmail} aria-label={a.newEmail} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ width: 240 }} />
          <button className="btn-primary" style={{ fontSize: ".76rem" }} type="button" disabled={pending || !newEmail.trim()} onClick={requestEmailChange}>{a.sendChange}</button>
          <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" onClick={() => { setEditingEmail(false); setNewEmail(""); }}>{a.cancel}</button>
        </div>
      )}
      {emailNote && <p className="setting-desc" role="status" style={{ marginTop: 6 }}>{emailNote}</p>}

      <TwoFactorSetting />

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

/* Two-factor authentication (TOTP, Supabase MFA). Supabase emails the
   "enabled" / "disabled" security notices itself. */
function TwoFactorSetting() {
  const { t } = useI18n();
  const a = t.settings.account;
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void createClient().auth.mfa.listFactors().then(({ data }) => setFactorId(data?.totp.find((f) => f.status === "verified")?.id ?? null));
  }, []);

  const start = async () => {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Drop a half-finished enrollment first, so a new one can start.
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all.filter((f) => f.status === "unverified") ?? []) await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Yolias ${Date.now()}` });
    setBusy(false);
    if (err || !data) return setError(a.twoFactorFailed);
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  };

  const confirm = async () => {
    if (!enroll) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    setBusy(false);
    if (err) return setError(a.twoFactorInvalid);
    setFactorId(enroll.id);
    setEnroll(null);
    setCode("");
  };

  const disable = async () => {
    if (!factorId || !window.confirm(a.twoFactorDisableConfirm)) return;
    setBusy(true);
    setError(null);
    const { error: err } = await createClient().auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (err) return setError(a.twoFactorFailed);
    setFactorId(null);
  };

  return (
    <>
      <SettingRow label={a.twoFactor} desc={a.twoFactorDesc}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {factorId ? (
            <>
              <span className="setting-ok">{a.twoFactorOn}</span>
              <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" onClick={disable} disabled={busy}>{a.twoFactorDisable}</button>
            </>
          ) : !enroll ? (
            <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" onClick={start} disabled={busy}>{a.twoFactorEnable}</button>
          ) : null}
        </div>
      </SettingRow>
      {enroll && (
        <div className="setting-section">
          <p className="setting-desc" style={{ marginBottom: 10 }}>{a.twoFactorScan}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="" width={168} height={168} style={{ background: "#fff", borderRadius: 8, padding: 6 }} />
          <p className="setting-desc" style={{ marginTop: 8 }}>{a.twoFactorSecret} <code dir="ltr" style={{ userSelect: "all" }}>{enroll.secret}</code></p>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <input className="form-input" dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} style={{ width: 120 }}
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label={a.twoFactor} />
            <button className="btn-primary" style={{ fontSize: ".76rem" }} type="button" onClick={confirm} disabled={busy || code.length !== 6}>{a.twoFactorVerify}</button>
          </div>
        </div>
      )}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}

/* ─────────────── Notifications ─────────────── */

function NotificationsTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const nt = t.settings.notifications;
  const [prefs, setPrefs] = useState(data.preferences);
  const { error, run } = useSave();
  const items = [
    { key: "notify_campaign_done", label: nt.discovery, desc: nt.discoveryDesc },
    { key: "notify_usage", label: nt.usage, desc: nt.usageDesc },
    { key: "notify_billing", label: nt.billing, desc: nt.billingDesc },
    { key: "notify_product", label: nt.product, desc: nt.productDesc },
  ] as const;

  const toggle = (key: (typeof items)[number]["key"], value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    run(() => updatePreferences({ [key]: value }));
  };

  return (
    <div className="setting-group">
      <p className="setting-intro">{fmt(nt.intro, { email: data.user.email })}</p>
      {items.map((it) => (
        <SettingRow key={it.key} label={it.label} desc={it.desc}>
          <label className="switch">
            <input type="checkbox" checked={prefs[it.key]} onChange={(e) => toggle(it.key, e.target.checked)} aria-label={it.label} />
            <span className="slider" />
          </label>
        </SettingRow>
      ))}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ─────────────── Usage ─────────────── */

function UsageTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const u = t.settings.usage;
  const { workspace } = data;
  const [usage, setUsage] = useState(() => ({ ...data.usage, allowance: workspace.prospects, checkedAt: Date.now() }));
  const [refreshing, startRefresh] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const n = (v: number) => formatNumber(v, locale);
  const pct = Math.min(100, usage.allowance ? (usage.prospects / usage.allowance) * 100 : 0);

  const refresh = () =>
    startRefresh(async () => {
      const r = await refreshUsage();
      setUsage({ prospects: r.prospects, allowance: r.allowance, extra: r.extra, resetsAt: r.resetsAt, checkedAt: Date.parse(r.checkedAt) });
      setNow(Date.parse(r.checkedAt));
    });

  // Fresh numbers whenever the tab opens, and "Last updated" keeps ticking.
  useEffect(() => {
    refresh();
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="setting-group">
      <div className="usage-head">
        <div>
          <div className="setting-label">{u.title}</div>
          <div className="setting-desc">{fmt(workspace.plan === "free" ? u.planLineFree : u.planLine, { plan: planName(workspace.plan, t) })}</div>
        </div>
        {workspace.plan !== "growth" && (data.role === "owner" || data.role === "admin") && (
          <a className="btn-secondary" href="/checkout">{u.upgrade}</a>
        )}
      </div>

      <div className="usage-meter">
        <div className="usage-meter-row">
          <span className="usage-meter-label">{u.prospects}</span>
          <span className="usage-meter-value">{fmt(u.value, { used: n(usage.prospects), total: n(usage.allowance) })}</span>
        </div>
        <div className="progress-track"><div className={`progress-fill${pct >= 100 ? " red" : pct >= 80 ? " amber" : ""}`} style={{ width: `${pct.toFixed(1)}%` }} /></div>
        <div className="usage-meter-foot">
          <span>{u.prospectsDesc}</span>
          <span>{usage.resetsAt ? fmt(u.resets, { date: formatDate(usage.resetsAt, locale, data.preferences.timezone) }) : u.oneTime}</span>
        </div>
        {usage.extra > 0 && <div className="usage-extra">{fmt(t.buyMore.extraBalance, { count: n(usage.extra) })}</div>}
      </div>

      <BuyMore data={data} pct={pct} onBought={refresh} />

      <div className="usage-updated">
        <span>{fmt(u.lastUpdated, { when: relativeTime(usage.checkedAt, now, locale, u.justNow) })}</span>
        <button type="button" className={`usage-refresh${refreshing ? " spinning" : ""}`} onClick={refresh} disabled={refreshing} aria-label={u.refresh} title={u.refresh}>
          <RotateCw />
        </button>
      </div>
    </div>
  );
}

// "less than a minute ago" / "5 minutes ago" in the interface language.
function relativeTime(ms: number, now: number, locale: string, justNow: string): string {
  const mins = Math.floor((now - ms) / 60_000);
  if (mins < 1) return justNow;
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? "ar-u-nu-latn" : "en", { numeric: "auto" });
  return mins < 60 ? rtf.format(-mins, "minute") : rtf.format(-Math.floor(mins / 60), "hour");
}

/* ─────────────── Buy More Prospects ─────────────── */

function BuyMore({ data, pct, onBought }: { data: ShellData; pct: number; onBought: () => void }) {
  const { t, locale } = useI18n();
  const bm = t.buyMore;
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = data.role === "owner" || data.role === "admin";
  const available = data.billing.online || data.billing.testMode;
  if (!available || data.packs.length === 0) return null;

  const buy = async (id: string) => {
    setBusy(id);
    setError(null);
    const r = await buyProspectPack(id);
    setBusy(null);
    if (!r) return; // redirected to the payment page
    if (!r.ok) return setError(r.error);
    toast(`${fmt(bm.added, { count: formatNumber(r.added, locale) })} ${bm.testMode}`);
    onBought();
    router.refresh();
  };

  // Like a usage limit: a callout when it's close or reached, packs right under it.
  const state = pct >= 100 ? "out" : pct >= 80 ? "near" : null;
  return (
    <section className="buy-more">
      {state && (
        <div className={`buy-more-callout ${state}`} role="status">
          <strong>{state === "out" ? bm.outTitle : fmt(bm.nearTitle, { pct: Math.floor(pct) })}</strong>
          <span>{state === "out" ? bm.outBody : bm.nearBody}</span>
        </div>
      )}
      <div className="setting-label">{bm.title}</div>
      <div className="setting-desc">{bm.lead}</div>
      {canManage ? (
        <ul className="buy-more-packs">
          {data.packs.map((p) => (
            <li key={p.id}>
              <span className="buy-more-name">
                {fmt(bm.packName, { count: formatNumber(p.prospects, locale) })}
                <small><bdi dir="ltr">{`$${(p.price / p.prospects).toFixed(3).replace(/0$/, "")}`}</bdi> {bm.each}</small>
              </span>
              <span dir="ltr" className="buy-more-price">{formatMoney(p.price, data.workspace.currency)}</span>
              <button className={state ? "btn-primary" : "btn-secondary"} type="button" disabled={busy !== null} onClick={() => buy(p.id)}>{busy === p.id ? bm.buying : bm.buy}</button>
            </li>
          ))}
        </ul>
      ) : <p className="billing-empty">{bm.onlyAdmins}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}

/* ─────────────── Billing ─────────────── */

function BillingTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
  const b = t.settings.billing;
  const toast = useToast();
  const router = useRouter();
  const { workspace } = data;
  const canManage = data.role === "owner" || data.role === "admin";
  const paid = workspace.plan !== "free";
  const [confirming, setConfirming] = useState(false);
  const { pending, error, run } = useSave();
  const money = (v: number, currency: Currency = "USD") => formatMoney(v, currency, true);
  const price = workspace.billingPeriod === "annual" ? workspace.price * 12 : workspace.price;

  const setCanceled = (cancel: boolean) =>
    run(async () => {
      const r = await setPlanCanceled(cancel);
      if (r.ok) {
        setConfirming(false);
        toast(cancel ? b.canceledToast : b.resumedToast);
        router.refresh();
      }
      return r;
    });

  const renewLine = !paid
    ? fmt(b.freeLine, { count: formatNumber(workspace.prospects, locale) })
    : workspace.periodEnd
      ? fmt(workspace.cancelAtPeriodEnd ? b.endsOn : b.renewsOn, { date: formatDate(workspace.periodEnd, locale, data.preferences.timezone) })
      : "";

  return (
    <div className="billing">
      <section className="billing-plan">
        <div className="billing-plan-icon"><YoliasMarkStatic /></div>
        <div className="billing-plan-main">
          <div className="billing-plan-name">
            {planName(workspace.plan, t)}
            {workspace.subscriptionStatus === "test" && <span className="coming-soon">{b.testMode}</span>}
          </div>
          <div className="billing-plan-sub">
            {paid && <>{workspace.billingPeriod === "annual" ? t.plans.annual : t.plans.monthly} · <span dir="ltr">{money(price, workspace.currency)}</span>{workspace.billingPeriod === "annual" ? b.perYear : t.common.perMonth}<br /></>}
            {renewLine}
          </div>
        </div>
        {canManage && <a className="btn-secondary" href="/checkout">{paid ? b.adjustPlan : b.upgrade}</a>}
      </section>

      {canManage && (
        <>
          <section className="billing-section">
            <h4>{b.payment}</h4>
            <div className="billing-row">
              <div className="billing-card">
                <CreditCard />
                <span>{data.billing.online ? t.checkout.paymentSecure : b.noCard}</span>
              </div>
            </div>
          </section>

          <section className="billing-section">
            <h4>{b.invoices}</h4>
            {data.invoices.length === 0 ? (
              <p className="billing-empty">{b.noInvoices}</p>
            ) : (
              <table className="billing-table">
                <thead>
                  <tr><th>{b.colDate}</th><th>{b.colTotal}</th><th>{b.colStatus}</th><th><span className="sr-only">{b.colActions}</span></th></tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{formatDate(inv.date, locale, data.preferences.timezone)}</td>
                      <td dir="ltr" className="text-start">{money(inv.amount, inv.currency)}</td>
                      <td>
                        <span className={`status-pill ${inv.status}`}>{b.status[inv.status]}</span>
                        {inv.test && <span className="billing-test">{b.test}</span>}
                      </td>
                      <td className="billing-actions"><a href={`/invoices/${inv.id}`} target="_blank" rel="noopener">{b.view}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {paid && (
            <section className="billing-section">
              <h4>{b.cancellation}</h4>
              {workspace.cancelAtPeriodEnd ? (
                <div className="billing-row">
                  <div className="billing-row-text">{fmt(b.canceledNote, { date: workspace.periodEnd ? formatDate(workspace.periodEnd, locale, data.preferences.timezone) : "" })}</div>
                  <button className="btn-secondary" type="button" disabled={pending} onClick={() => setCanceled(false)}>{b.resume}</button>
                </div>
              ) : confirming ? (
                <div className="billing-confirm">
                  <p>{fmt(b.cancelConfirm, { date: workspace.periodEnd ? formatDate(workspace.periodEnd, locale, data.preferences.timezone) : "" })}</p>
                  <div>
                    <button className="btn-secondary" type="button" onClick={() => setConfirming(false)}>{b.keepPlan}</button>
                    <button className="btn-danger solid" type="button" disabled={pending} onClick={() => setCanceled(true)}>{b.cancelPlan}</button>
                  </div>
                </div>
              ) : (
                <div className="billing-row">
                  <div className="billing-row-text">{b.cancelPlan}</div>
                  <button className="btn-danger-ghost" type="button" onClick={() => setConfirming(true)}>{b.cancel}</button>
                </div>
              )}
            </section>
          )}
          {error && <p className="form-error">{error}</p>}
        </>
      )}
      {!canManage && <p className="billing-empty">{b.adminsOnly}</p>}
    </div>
  );
}

function YoliasMarkStatic() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/logo-mark.png" alt="" width={20} height={21} />;
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

/* ─────────────── Integrations ─────────────── */

function IntegrationTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const it = t.settings.integration;
  const connectors = [
    { id: "sheets", name: "Google Sheets", desc: it.sheetsDesc, Icon: GoogleSheetsIcon },
    { id: "hubspot", name: "HubSpot", desc: it.hubspotDesc, Icon: HubSpotIcon },
    { id: "gmail", name: "Gmail", desc: it.gmailDesc, Icon: GmailIcon },
    { id: "outlook", name: "Outlook", desc: it.outlookDesc, Icon: OutlookIcon },
  ];
  return (
    <div className="setting-group">
      <p className="setting-intro">{it.intro}</p>
      <div className="connector-list">
        {connectors.map(({ id, name, desc, Icon }) => {
          // Gmail / Outlook are real (outreach, final spec phase 8); the others are still coming.
          const mail = id === "gmail" || id === "outlook" ? id : null;
          const box = mail ? data.mailboxes.find((m) => m.provider === mail) : undefined;
          return (
            <div className="connector" key={id}>
              <div className="connector-icon"><Icon /></div>
              <div className="connector-main">
                <div className="connector-name">{name}</div>
                <div className="connector-desc">{box?.status === "connected" ? <span dir="ltr">{fmt(t.outreach.connectedAs, { email: box.email })}</span> : desc}</div>
              </div>
              {mail && data.mailProviders[mail]
                ? <a className="btn-secondary" href={box?.status === "connected" ? "/outreach" : `/api/integrations/${mail}/connect`}>{box?.status === "connected" ? t.outreach.title : it.connect}</a>
                : <button className="btn-secondary" type="button" disabled title={t.common.comingSoon}>{it.connect}</button>}
            </div>
          );
        })}
      </div>
      <p className="setting-hint connector-note">{it.soon}</p>
    </div>
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
