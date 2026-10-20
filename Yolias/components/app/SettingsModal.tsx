"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, AtSign, Bell, ChevronRight, CreditCard, Plug, Plus, RotateCw, Search, SlidersHorizontal, User, Users, X } from "lucide-react";
import { IMAGE_ACCEPT, checkImageFile } from "@/lib/uploads/image";
import { createClient } from "@/lib/supabase/client";
import { countryLabel, formatDate, formatMoney, formatNumber } from "@/lib/format";
import { COUNTRIES, timeZoneChoices, timeZoneLabel } from "@/lib/regions";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { planName, priceFor, topPlan } from "@/lib/plans";
import { useToast } from "@/components/Toast";
import { buyProspectPack } from "@/app/checkout/actions";
import { GmailIcon } from "./ConnectorIcons";
import {
  changeEmail, deleteAccount, inviteMember, refreshUsage, removeMember, revokeInvitation, setAvatar, setPlanCanceled, signOut, updatePhone, updatePreferences, type ActionResult,
} from "@/app/(app)/settings/actions";
import { connectImapMailbox, connectTestMailbox, mailboxState, removeMailbox } from "@/app/(app)/settings/mailbox-actions";
import { callAction, isNetworkFailure } from "@/lib/action-client";
import { metaTrack, track } from "@/lib/analytics/client";
import type { SettingsTab, ShellData } from "./types";
import { searchSettings } from "./settings-search";
import type { Currency } from "@/types/database";

const tabs: { tab: SettingsTab; icon: typeof User }[] = [
  { tab: "general", icon: SlidersHorizontal },
  { tab: "account", icon: User },
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
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const searching = query.trim().length > 0;
  const hits = searching ? searchSettings(query, t, tabs.map((x) => x.tab)) : [];
  // Escape clears the search first, then closes the window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (query) setQuery("");
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, query]);

  const open = (hit: { tab: SettingsTab; id: string }) => {
    setQuery("");
    onTab(hit.tab);
    setFocus(hit.id);
  };
  // After a result opens its tab, bring the setting into view and mark it briefly.
  useEffect(() => {
    if (!focus) return;
    const el = document.querySelector<HTMLElement>(`[data-setting="${focus}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("setting-found");
    const id = window.setTimeout(() => { el.classList.remove("setting-found"); setFocus(null); }, 1800);
    return () => window.clearTimeout(id);
  }, [focus, tab]);


  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <aside className="modal-sidebar">
          <div className="modal-sidebar-title">{t.settings.title}</div>
          <div className="settings-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && hits[0]) { e.preventDefault(); open(hits[0]); } }}
              placeholder={t.settings.search.placeholder}
              aria-label={t.settings.search.placeholder}
              aria-controls="settings-results"
              autoComplete="off"
            />
            {searching && <button type="button" className="settings-search-clear" onClick={() => setQuery("")} aria-label={t.settings.search.clear}><X /></button>}
          </div>
          <nav className="modal-nav-list">
            {tabs.map(({ tab: id, icon: Icon }) => (
              <button key={id} className={`modal-nav-item${id === tab && !searching ? " active" : ""}`} type="button" onClick={() => { setQuery(""); onTab(id); }}>
                <Icon />
                <span>{t.settings.tabs[id]}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="modal-content-area">
          <div className="modal-header-clean">
            <h3 id="settings-title">{searching ? t.settings.search.placeholder : t.settings.titles[tab]}</h3>
            <button className="modal-close-btn" type="button" onClick={onClose} aria-label={t.common.close}>
              <X />
            </button>
          </div>
          <div className="modal-body-scroll">
            {searching ? (
              hits.length ? (
                <ul className="settings-results" id="settings-results">
                  {hits.map((h) => {
                    const Icon = tabs.find((x) => x.tab === h.tab)!.icon;
                    return (
                      <li key={`${h.tab}:${h.id}`}>
                        <button type="button" onClick={() => open(h)}>
                          <Icon aria-hidden="true" />
                          <span className="settings-result-main">
                            <span className="settings-result-label">{h.label}</span>
                            {h.desc && <span className="settings-result-desc">{h.desc}</span>}
                          </span>
                          <span className="settings-result-tab">{t.settings.tabs[h.tab]}</span>
                          <ChevronRight className="settings-result-go" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="settings-results-empty" id="settings-results" role="status">
                  <strong>{fmt(t.settings.search.empty, { q: query.trim() })}</strong>
                  <span>{t.settings.search.hint}</span>
                </div>
              )
            ) : <>
            {tab === "general" && <GeneralTab data={data} />}
            {tab === "account" && <AccountTab data={data} />}
            {tab === "notifications" && <NotificationsTab data={data} />}
            {tab === "usage" && <UsageTab data={data} />}
            {tab === "billing" && <BillingTab data={data} />}
            {tab === "team" && <TeamTab data={data} />}
            {tab === "integration" && <IntegrationTab />}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}

function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useI18n();
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setError(null);
      const r = await callAction(fn);
      if (isNetworkFailure(r)) setError(t.feedback.errors.network);
      else if (!r.ok) setError(r.error);
    });
  return { pending, error, run };
}

function applyAppearance(theme?: string, size?: string) {
  const d = document.documentElement;
  if (theme) d.setAttribute("data-theme", theme === "light" ? "light" : "dark");
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
      <SettingRow id="theme" label={g.theme} desc={g.themeDesc}>
        <select className="form-select" value={prefs.theme} onChange={(e) => change("theme", e.target.value as typeof prefs.theme)}>
          <option value="light">{g.light}</option>
          <option value="dark">{g.dark}</option>
        </select>
      </SettingRow>
      <SettingRow id="text-size" label={g.textSize} desc={g.textSizeDesc}>
        <select className="form-select" value={prefs.text_size} onChange={(e) => change("text_size", e.target.value as typeof prefs.text_size)}>
          <option value="compact">{g.compact}</option>
          <option value="normal">{g.normal}</option>
          <option value="large">{g.large}</option>
        </select>
      </SettingRow>
      <SettingRow id="language" label={g.languages} desc={g.languagesDesc}>
        <select className="form-select" value={prefs.language} onChange={(e) => change("language", e.target.value as typeof prefs.language)}>
          <option value="en">{t.language.en}</option>
          <option value="ar">{t.language.ar}</option>
        </select>
      </SettingRow>
      <SettingRow id="timezone" label={g.timezone} desc={g.timezoneDesc}>
        <select className="form-select" value={prefs.timezone} onChange={(e) => change("timezone", e.target.value)}>
          {timeZoneChoices(prefs.timezone).map((tz) => <option key={tz} value={tz}>{timeZoneLabel(tz, locale)}</option>)}
        </select>
      </SettingRow>
      <SettingRow id="country" label={g.country} desc={g.countryDesc}>
        <select className="form-select" value={prefs.country} onChange={(e) => change("country", e.target.value)}>
          {COUNTRIES.map((c) => <option key={c} value={c}>{countryLabel(c, locale)}</option>)}
        </select>
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

  const [phone, setPhone] = useState(data.user.phone ?? "");
  const [savedPhone, setSavedPhone] = useState(data.user.phone ?? "");
  const savePhone = () => {
    if (phone.trim() === savedPhone) return;
    run(async () => {
      const r = await updatePhone(phone);
      if (r.ok) {
        setPhone(r.phone ?? "");
        setSavedPhone(r.phone ?? "");
      }
      return r;
    });
  };

  const upload = async (file: File) => {
    setLocalError(null);
    const bad = checkImageFile(file);
    if (bad) return setLocalError(bad === "size" ? t.uploads.imageSize : t.uploads.imageType);
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${data.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("avatars").upload(path, file, { upsert: false, contentType: file.type });
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
      <SettingRow id="avatar" label={a.avatar} desc={a.avatarDesc}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar" style={{ width: 40, height: 40, fontSize: ".8rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarUrl ? <img src={avatarUrl} alt="" /> : data.user.initials}
          </div>
          <div>
            <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? a.uploading : a.change}
            </button>
            <p className="upload-hint" id="avatar-hint">{t.uploads.imageHint}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden-input"
            accept={IMAGE_ACCEPT}
            aria-describedby="avatar-hint"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>
      </SettingRow>

      <SettingRow id="full-name" label={a.fullName} desc={a.fullNameDesc}>
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

      <SettingRow id="phone" label={a.phone} desc={a.phoneDesc}>
        <div style={{ width: 200 }}>
          <input
            type="tel"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            className="form-input"
            placeholder={a.phonePlaceholder}
            aria-label={a.phone}
            maxLength={40}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={savePhone}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
        </div>
      </SettingRow>

      <SettingRow id="email" label={a.email} desc={a.emailDesc}>
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

      <div className="setting-section" data-setting="devices">
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

      <div className="danger-zone-box" data-setting="delete-account">
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
      <SettingRow id="two-factor" label={a.twoFactor} desc={a.twoFactorDesc}>
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
    { key: "notify_campaign_done", id: "notify-discovery", label: nt.discovery, desc: nt.discoveryDesc },
    { key: "notify_usage", id: "notify-usage", label: nt.usage, desc: nt.usageDesc },
    { key: "notify_billing", id: "notify-billing", label: nt.billing, desc: nt.billingDesc },
    { key: "notify_product", id: "notify-product", label: nt.product, desc: nt.productDesc },
  ] as const;

  const toggle = (key: (typeof items)[number]["key"], value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    run(() => updatePreferences({ [key]: value }));
  };

  return (
    <div className="setting-group">
      <p className="setting-intro">{fmt(nt.intro, { email: data.user.email })}</p>
      {items.map((it) => (
        <SettingRow key={it.key} id={it.id} label={it.label} desc={it.desc}>
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
      setUsage({ prospects: r.prospects, allowance: r.allowance, extra: r.extra, resetsAt: r.resetsAt, emails: r.emails, contacts: r.contacts, trialEndsAt: r.trialEndsAt, checkedAt: Date.parse(r.checkedAt) });
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
      <div className="usage-head" data-setting="plan-usage">
        <div>
          <div className="setting-label">{u.title}</div>
          <div className="setting-desc">{usage.trialEndsAt
            ? fmt(u.trialLine, { plan: planName(workspace.plan, t), date: formatDate(usage.trialEndsAt, locale, data.preferences.timezone) })
            : fmt(workspace.plan === "free" ? u.planLineFree : u.planLine, { plan: planName(workspace.plan, t) })}</div>
        </div>
        {workspace.plan !== topPlan && (data.role === "owner" || data.role === "admin") && (
          <a className="btn-secondary" href="/checkout">{u.upgrade}</a>
        )}
      </div>

      <div className="usage-meter">
        <div className="usage-meter-row">
          <span className="usage-meter-label">{u.prospects}</span>
          <span className="usage-meter-value">{fmt(u.value, { used: n(usage.prospects), total: n(usage.allowance) })}</span>
        </div>
        <div className="progress-track"><div className={`progress-fill${pct >= 100 ? " red" : pct >= 80 ? " near" : ""}`} style={{ width: `${pct.toFixed(1)}%` }} /></div>
        <div className="usage-meter-foot">
          <span />
          <span>{usage.resetsAt ? fmt(u.resets, { date: formatDate(usage.resetsAt, locale, data.preferences.timezone) }) : usage.trialEndsAt ? u.trialOnly : u.oneTime}</span>
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
    const pack = data.packs.find((p) => p.id === id);
    if (pack) {
      track("buy_more_opened", { prospects: pack.prospects, value: pack.price, currency: data.workspace.currency });
      metaTrack("InitiateCheckout", { value: pack.price, currency: data.workspace.currency, content_type: "product", content_ids: [`prospects_${pack.prospects}`], num_items: 1 });
    }
    const r = await callAction(() => buyProspectPack(id)).finally(() => setBusy(null));
    if (!r) return; // redirected to the payment page
    if (isNetworkFailure(r)) return setError(t.checkout.errors.network);
    if (!r.ok) return setError(r.error);
    toast(`${fmt(bm.added, { count: formatNumber(r.added, locale) })} ${bm.testMode}`);
    onBought();
    router.refresh();
  };

  // Like a usage limit: a callout when it's close or reached, packs right under it.
  const state = pct >= 100 ? "out" : pct >= 80 ? "near" : null;
  return (
    <section className="buy-more" data-setting="buy-more">
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
  const price = priceFor(workspace.price, workspace.billingPeriod);

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

  const trialing = workspace.subscriptionStatus === "trialing";
  const renewLine = !paid
    ? fmt(b.freeLine, { count: formatNumber(workspace.prospects, locale) })
    : trialing && data.usage.trialEndsAt
      ? fmt(t.plans.trialEnds, { date: formatDate(data.usage.trialEndsAt, locale, data.preferences.timezone) })
    : workspace.periodEnd
      ? fmt(workspace.cancelAtPeriodEnd ? b.endsOn : b.renewsOn, { date: formatDate(workspace.periodEnd, locale, data.preferences.timezone) })
      : "";

  return (
    <div className="billing">
      <section className="billing-plan" data-setting="plan">
        <div className="billing-plan-icon"><YoliasMarkStatic /></div>
        <div className="billing-plan-main">
          <div className="billing-plan-name">
            {planName(workspace.plan, t)}
            {workspace.subscriptionStatus === "test" && <span className="coming-soon">{b.testMode}</span>}
            {trialing && <span className="coming-soon">{t.plans.trialing}</span>}
          </div>
          <div className="billing-plan-sub">
            {paid && <>{workspace.billingPeriod === "annual" ? t.plans.annual : t.plans.monthly} · <span dir="ltr">{money(price, workspace.currency)}</span>{workspace.billingPeriod === "annual" ? b.perYear : t.common.perMonth}<br /></>}
            {renewLine}
          </div>
        </div>
        {/* Polar subscriptions are managed in Polar's hosted customer portal (plan, card, invoices, cancel). */}
        {canManage && (data.billing.portalUrl
          ? <a className="btn-secondary" href={data.billing.portalUrl} target="_blank" rel="noopener noreferrer">{b.manageBilling}</a>
          : <a className="btn-secondary" href="/checkout">{paid ? b.adjustPlan : b.upgrade}</a>)}
      </section>

      {canManage && (
        <>
          <section className="billing-section" data-setting="payment">
            <h4>{b.payment}</h4>
            <div className="billing-row">
              <div className="billing-card">
                <CreditCard />
                <span>{data.billing.online ? t.checkout.paymentSecure : b.noCard}</span>
              </div>
            </div>
          </section>

          <section className="billing-section" data-setting="invoices">
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
            <section className="billing-section" data-setting="cancellation">
              <h4>{b.cancellation}</h4>
              {data.billing.portalUrl ? (
                // Polar subscriptions are canceled or resumed in Polar's portal; its webhook updates Yolias.
                <div className="billing-row">
                  <div className="billing-row-text">{workspace.cancelAtPeriodEnd ? fmt(b.canceledNote, { date: workspace.periodEnd ? formatDate(workspace.periodEnd, locale, data.preferences.timezone) : "" }) : b.cancelInPortal}</div>
                  <a className="btn-secondary" href={data.billing.portalUrl} target="_blank" rel="noopener noreferrer">{b.manageBilling}</a>
                </div>
              ) : workspace.cancelAtPeriodEnd ? (
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
      <div data-setting="members" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
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

function IntegrationTab() {
  const { t } = useI18n();
  const it = t.settings.integration;
  const toast = useToast();
  const [state, setState] = useState<Awaited<ReturnType<typeof mailboxState>> | null>(null);
  const [pending, start] = useTransition();
  const load = () => mailboxState().then(setState).catch(() => setState({ mailboxes: [], available: [] }));
  useEffect(() => { void load(); }, []);
  // Coming back from Google / Microsoft: say what happened.
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("mailbox");
    if (!status) return;
    const msg = { connected: it.mailboxConnected, denied: it.mailboxDenied, not_configured: it.mailboxNotConfigured }[status] ?? it.mailboxFailed;
    toast(msg, status === "connected" ? undefined : "error");
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mailboxes (D-228; Outlook hidden by the owner 2026-10-20): connect your own Gmail or IMAP to send approved
  // campaigns and read the replies. LinkedIn has no official messaging API
  // for this, so it stays "write here, send from your account". Calendars
  // aren't built yet and say so.
  const mailboxRow = (provider: "gmail" | "outlook" | "test", name: string, desc: string, Icon: React.ComponentType) => {
    const m = state?.mailboxes.find((x) => x.provider === provider && x.status !== "disconnected");
    const can = state?.available.includes(provider);
    return (
      <div className="connector" key={provider} data-setting={provider}>
        <div className="connector-icon"><Icon /></div>
        <div className="connector-main">
          <div className="connector-name">{name}{m ? <span className="connector-account" dir="ltr"> · {m.email}</span> : null}</div>
          <div className="connector-desc">{m?.status === "error" ? (m.lastError ?? it.needsReconnect) : desc}</div>
          {m?.status === "connected" ? <div className="connector-desc">{fmt(it.sentToday, { count: m.sentToday, limit: m.dailyLimit })}</div> : null}
        </div>
        {m ? (
          <span className="connector-actions">
            <span className={m.status === "connected" ? "status-pill paid" : "status-pill failed"}>{m.status === "connected" ? it.connected : it.needsReconnect}</span>
            {m.status === "error" && provider !== "test" ? <a className="btn-secondary" href={`/api/integrations/${provider}/start`}>{it.reconnect}</a> : null}
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => {
              if (!window.confirm(fmt(it.disconnectConfirm, { email: m.email }))) return;
              start(async () => { await removeMailbox(m.id); await load(); });
            }}>{it.disconnect}</button>
          </span>
        ) : can ? (
          provider === "test"
            ? <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { await connectTestMailbox(); await load(); })}>{it.connect}</button>
            : <a className="btn-primary" href={`/api/integrations/${provider}/start`}>{it.connect}</a>
        ) : <span className="coming-soon">{state ? it.notSetUp : "…"}</span>}
      </div>
    );
  };
  return (
    <div className="setting-group">
      <p className="setting-intro">{it.intro}</p>
      <div className="connector-group">
        <div className="setting-label">{it.channels}</div>
        <div className="connector-list">
          {mailboxRow("gmail", "Gmail", it.gmailDesc, GmailIcon)}
          <ImapRow mailbox={state?.mailboxes.find((x) => x.provider === "imap" && x.status !== "disconnected") ?? null} loaded={Boolean(state)} pending={pending} onDisconnect={(id) => start(async () => { await removeMailbox(id); await load(); })} onConnected={() => { toast(it.mailboxConnected); void load(); }} />
          {state?.available.includes("test") || state?.mailboxes.some((m) => m.provider === "test") ? mailboxRow("test", "Test mailbox", it.testDesc, Plug) : null}
        </div>
      </div>
    </div>
  );
}

/** Any mailbox with IMAP/SMTP (D-238): connected with its server settings and an app password. */
function ImapRow({ mailbox, loaded, pending, onDisconnect, onConnected }: { mailbox: Awaited<ReturnType<typeof mailboxState>>["mailboxes"][number] | null; loaded: boolean; pending: boolean; onDisconnect: (id: string) => void; onConnected: () => void }) {
  const { t } = useI18n();
  const it = t.settings.integration;
  const im = it.imap;
  const [open, setOpen] = useState(false);
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ email: "", name: "", user: "", pass: "", imapHost: "", imapPort: "993", smtpHost: "", smtpPort: "465" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setF((o) => {
      const next = { ...o, [k]: v };
      // Typing the address suggests the usual server names; the member can change them.
      if (k === "email") {
        const domain = v.split("@")[1] ?? "";
        if (!o.user || o.user === o.email) next.user = v;
        if (domain && (!o.imapHost || o.imapHost === `imap.${o.email.split("@")[1] ?? ""}`)) next.imapHost = `imap.${domain}`;
        if (domain && (!o.smtpHost || o.smtpHost === `smtp.${o.email.split("@")[1] ?? ""}`)) next.smtpHost = `smtp.${domain}`;
      }
      return next;
    });
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startBusy(async () => {
      const r = await connectImapMailbox({ ...f, imapPort: Number(f.imapPort), smtpPort: Number(f.smtpPort) });
      if (r.ok) { setOpen(false); setF((o) => ({ ...o, pass: "" })); onConnected(); }
      else setError(im.errors[r.error]);
    });
  };
  return (
    <div className="connector connector-stack" data-setting="imap">
      <div className="connector-row">
        <div className="connector-icon"><AtSign /></div>
        <div className="connector-main">
          <div className="connector-name">{im.name}{mailbox ? <span className="connector-account" dir="ltr"> · {mailbox.email}</span> : null}</div>
          <div className="connector-desc">{mailbox?.status === "error" ? (mailbox.lastError ?? it.needsReconnect) : im.desc}</div>
          {mailbox?.status === "connected" ? <div className="connector-desc">{fmt(it.sentToday, { count: mailbox.sentToday, limit: mailbox.dailyLimit })}</div> : null}
        </div>
        {mailbox ? (
          <span className="connector-actions">
            <span className={mailbox.status === "connected" ? "status-pill paid" : "status-pill failed"}>{mailbox.status === "connected" ? it.connected : it.needsReconnect}</span>
            {mailbox.status === "error" ? <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>{it.reconnect}</button> : null}
            <button type="button" className="btn-secondary" disabled={pending} onClick={() => { if (window.confirm(fmt(it.disconnectConfirm, { email: mailbox.email }))) onDisconnect(mailbox.id); }}>{it.disconnect}</button>
          </span>
        ) : loaded ? <button type="button" className="btn-primary" onClick={() => setOpen((o) => !o)}>{it.connect}</button> : <span className="coming-soon">…</span>}
      </div>
      {open && (
        <form className="imap-form" onSubmit={submit}>
          <p className="connector-desc">{im.help}</p>
          <div className="imap-grid">
            <label><span>{im.email}</span><input className="form-input" dir="ltr" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></label>
            <label><span>{im.senderName}</span><input className="form-input" value={f.name} onChange={set("name")} /></label>
            <label><span>{im.user}</span><input className="form-input" dir="ltr" required autoComplete="username" value={f.user} onChange={set("user")} /></label>
            <label><span>{im.pass}</span><input className="form-input" dir="ltr" type="password" required autoComplete="current-password" value={f.pass} onChange={set("pass")} /></label>
            <label><span>{im.imapHost}</span><input className="form-input" dir="ltr" required value={f.imapHost} onChange={set("imapHost")} /></label>
            <label><span>{im.port}</span><select className="form-select" value={f.imapPort} onChange={(e) => setF((o) => ({ ...o, imapPort: e.target.value }))}><option value="993">993 (SSL/TLS)</option><option value="143">143 (STARTTLS)</option></select></label>
            <label><span>{im.smtpHost}</span><input className="form-input" dir="ltr" required value={f.smtpHost} onChange={set("smtpHost")} /></label>
            <label><span>{im.port}</span><select className="form-select" value={f.smtpPort} onChange={(e) => setF((o) => ({ ...o, smtpPort: e.target.value }))}><option value="465">465 (SSL/TLS)</option><option value="587">587 (STARTTLS)</option><option value="2525">2525 (STARTTLS)</option></select></label>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="imap-actions">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>{im.cancel}</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? im.checking : im.save}</button>
          </div>
        </form>
      )}
    </div>
  );
}

function SettingRow({ id, label, desc, children }: { id?: string; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="setting-row" data-setting={id}>
      <div className="setting-label-wrap">
        <div className="setting-label">{label}</div>
        <div className="setting-desc">{desc}</div>
      </div>
      {children}
    </div>
  );
}
