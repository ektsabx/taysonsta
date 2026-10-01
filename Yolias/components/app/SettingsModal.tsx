"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Activity, CreditCard, Plug, Plus, SlidersHorizontal, User, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatNumber } from "@/lib/format";
import {
  deleteAccount, inviteMember, removeMember, revokeInvitation, setAvatar, signOut, updatePreferences, type ActionResult,
} from "@/app/(app)/settings/actions";
import type { SettingsTab, ShellData } from "./types";

const tabs: { tab: SettingsTab; label: string; title: string; icon: typeof User }[] = [
  { tab: "general", label: "General", title: "General", icon: SlidersHorizontal },
  { tab: "account", label: "Account", title: "Account", icon: User },
  { tab: "usage", label: "Usage", title: "Usage & Quotas", icon: Activity },
  { tab: "billing", label: "Billing", title: "Billing & Invoices", icon: CreditCard },
  { tab: "team", label: "Team", title: "Team Members", icon: Users },
  { tab: "integration", label: "Integration", title: "Integrations", icon: Plug },
];

interface Props {
  data: ShellData;
  tab: SettingsTab;
  onTab: (t: SettingsTab) => void;
  onClose: () => void;
}

export function SettingsModal({ data, tab, onTab, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = tabs.find((t) => t.tab === tab) ?? tabs[0];

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-window" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <aside className="modal-sidebar">
          <div className="modal-sidebar-title">Settings</div>
          {tabs.map(({ tab: t, label, icon: Icon }) => (
            <button key={t} className={`modal-nav-item${t === tab ? " active" : ""}`} type="button" onClick={() => onTab(t)}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </aside>

        <div className="modal-content-area">
          <div className="modal-header-clean">
            <h3 id="settings-title">{active.title}</h3>
            <button className="modal-close-btn" type="button" onClick={onClose} aria-label="Close modal">
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
  const [prefs, setPrefs] = useState(data.preferences);
  const { error, run } = useSave();

  const change = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    if (key === "theme") applyAppearance(value as string);
    if (key === "text_size") applyAppearance(undefined, value as string);
    run(() => updatePreferences({ [key]: value }));
  };

  return (
    <div className="setting-group">
      <SettingRow label="Theme" desc="Select how Yolias looks on your screen.">
        <select className="form-select" value={prefs.theme} onChange={(e) => change("theme", e.target.value as typeof prefs.theme)}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </SettingRow>
      <SettingRow label="Transcript Text size" desc="Adjust font size for discovery chats and data previews.">
        <select className="form-select" value={prefs.text_size} onChange={(e) => change("text_size", e.target.value as typeof prefs.text_size)}>
          <option value="compact">Compact</option>
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>
      </SettingRow>
      <SettingRow label="Languages" desc="Primary language for customer discovery searches.">
        <select className="form-select" value={prefs.language} onChange={(e) => change("language", e.target.value as typeof prefs.language)}>
          <option value="en">English (US)</option>
          <option value="ar">Arabic (العربية)</option>
        </select>
      </SettingRow>
      <SettingRow label="Time zone" desc="Default regional working hours for discovery tasks.">
        <select className="form-select" value={prefs.timezone} onChange={(e) => change("timezone", e.target.value)}>
          <option value="Asia/Riyadh">(GMT+03:00) Riyadh</option>
          <option value="Asia/Dubai">(GMT+04:00) Dubai</option>
          <option value="Africa/Cairo">(GMT+02:00) Cairo</option>
          <option value="Europe/London">(GMT+00:00) London</option>
        </select>
      </SettingRow>
      <SettingRow label="Country" desc="Primary market headquarters.">
        <select className="form-select" value={prefs.country} onChange={(e) => change("country", e.target.value)}>
          <option value="SA">Saudi Arabia</option>
          <option value="AE">United Arab Emirates</option>
          <option value="EG">Egypt</option>
          <option value="GB">United Kingdom</option>
        </select>
      </SettingRow>
      <SettingRow label="Notifications" desc="Notify when a discovery campaign finishes extracting leads.">
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
    if (!file.type.startsWith("image/")) return setLocalError("Choose an image file.");
    if (file.size > 2 * 1024 * 1024) return setLocalError("Avatar must be under 2 MB.");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${data.user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      return setLocalError("Upload failed. Please try again.");
    }
    const r = await setAvatar(path);
    setUploading(false);
    if (!r.ok) return setLocalError(r.error);
    setAvatarUrl(createClient().storage.from("avatars").getPublicUrl(path).data.publicUrl);
  };

  const removeAccount = () => {
    if (!window.confirm("Permanently delete your Yolias account and its discovered customer data? This can't be undone.")) return;
    run(() => deleteAccount());
  };

  return (
    <div className="setting-group">
      <SettingRow label="Avatar" desc="Your profile avatar.">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar" style={{ width: 40, height: 40, fontSize: ".8rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarUrl ? <img src={avatarUrl} alt="" /> : data.user.initials}
          </div>
          <button className="btn-secondary" style={{ fontSize: ".76rem" }} type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Uploading…" : "Change"}
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

      <SettingRow label="Full Name" desc="Workspace user name.">
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

      <SettingRow label="Email" desc="Your verified account email address.">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="email" className="form-input" value={data.user.email} style={{ width: 190 }} readOnly />
          {data.user.emailConfirmed && <span className="setting-ok">Verified</span>}
        </div>
      </SettingRow>

      <SettingRow label="Two-Factor Authentication" desc="Protect your workspace discovery data with 2FA.">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="coming-soon">Coming soon</span>
          <label className="switch">
            <input type="checkbox" disabled checked={false} readOnly />
            <span className="slider" />
          </label>
        </div>
      </SettingRow>

      <div className="setting-section">
        <div className="setting-label">Devices &amp; Active Sessions</div>
        <div className="setting-desc" style={{ marginBottom: 12 }}>Authorized browsers accessing Yolias.</div>
        <div className="device-card">
          <div>
            <strong>{data.device.label}</strong> (Current Session)
            {data.device.ip && <div className="cell-sub">IP {data.device.ip}</div>}
          </div>
          <span className="setting-ok" style={{ fontWeight: 600 }}>Active Now</span>
        </div>
        <button className="btn-secondary" style={{ marginTop: 12, fontSize: ".76rem" }} type="button" onClick={() => signOut("global")}>
          Log out of all devices
        </button>
      </div>

      {(error || localError) && <p className="form-error">{error ?? localError}</p>}

      <div className="danger-zone-box">
        <div>
          <div className="danger-title">Delete account</div>
          <div className="danger-desc">Permanently delete your profile and extracted customer databases.</div>
        </div>
        <button className="btn-danger" type="button" onClick={removeAccount} disabled={pending}>
          Delete account
        </button>
      </div>
    </div>
  );
}

/* ─────────────── Usage ─────────────── */

function UsageTab({ data }: { data: ShellData }) {
  const { usage, workspace } = data;
  const pct = (used: number, total: number) => `${Math.min(100, total ? (used / total) * 100 : 0).toFixed(1)}%`;
  return (
    <div className="setting-group">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div className="setting-label">Discovery Quota Usage</div>
        <span className="setting-hint">Resets on {formatDate(usage.resetsAt, "UTC")}</span>
      </div>

      <div className="usage-card">
        <div className="usage-card-head">
          <span>Customer Discovery Credits</span>
          <span>{formatNumber(usage.prospects)} / {formatNumber(workspace.prospectCredits)} credits</span>
        </div>
        <div className="progress-track"><div className="progress-fill" style={{ width: pct(usage.prospects, workspace.prospectCredits) }} /></div>
        <div className="setting-desc" style={{ marginTop: 8 }}>
          1 credit per target decision maker discovered with verified email, company data, and direct phone/WhatsApp.
        </div>
      </div>

      <div className="usage-card">
        <div className="usage-card-head">
          <span>Company Deep-Research Lookups</span>
          <span>{formatNumber(usage.companies)} / {formatNumber(workspace.companyLookups)} lookups</span>
        </div>
        <div className="progress-track"><div className="progress-fill red" style={{ width: pct(usage.companies, workspace.companyLookups) }} /></div>
        <div className="setting-desc" style={{ marginTop: 8 }}>Auditing growth signals, headcount changes, tech stacks, and funding history.</div>
      </div>
    </div>
  );
}

/* ─────────────── Billing ─────────────── */

function BillingTab({ data }: { data: ShellData }) {
  const { workspace } = data;
  const canManage = data.role === "owner" || data.role === "admin";
  return (
    <div className="setting-group">
      <SettingRow label="Plan Name" desc="Active customer acquisition subscription.">
        <div style={{ textAlign: "right" }}>
          <span className="plan-badge" style={{ fontSize: ".75rem", padding: "3px 8px" }}>{workspace.planLabel} Plan</span>
          <div style={{ fontSize: ".8rem", fontWeight: 700, marginTop: 4 }}>
            {workspace.priceUsd ? `$${workspace.priceUsd} / month` : "Free"}
          </div>
          <div className="setting-hint">
            {workspace.periodEnd
              ? `Renews on ${formatDate(workspace.periodEnd)}${workspace.subscriptionStatus === "test" ? " · test mode" : ""}`
              : `${formatNumber(workspace.prospectCredits)} discovery credits / month`}
          </div>
          {canManage && (
            <a className="btn-secondary" style={{ fontSize: ".72rem", marginTop: 8 }} href="/pricing">
              {workspace.plan === "free" ? "Choose a plan" : "Change plan"}
            </a>
          )}
        </div>
      </SettingRow>

      <SettingRow label="Payments & Card" desc="Billing credit card on file.">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: ".8rem", fontWeight: 600 }}>No card on file</div>
          <button className="btn-secondary" style={{ fontSize: ".75rem" }} type="button" disabled title="Coming soon">Update</button>
          <span className="coming-soon">Coming soon</span>
        </div>
      </SettingRow>

      <div className="setting-section">
        <div className="setting-label">Invoices</div>
        <div className="setting-desc" style={{ marginBottom: 12 }}>Download previous monthly invoices.</div>
        <div className="data-table-card" style={{ boxShadow: "none" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Invoice</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="empty-cell">No invoices yet.</td>
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
  const canManage = data.role === "owner" || data.role === "admin";
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const { pending, error, run } = useSave();
  const roleLabel = (r: string) => (r === "owner" ? "Owner" : r === "admin" ? "Admin" : "Member");

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
          <div className="setting-label">Team Members</div>
          <div className="setting-desc">Colleagues with access to search campaigns and prospect exports.</div>
        </div>
        {canManage && (
          <button className="btn-primary" style={{ fontSize: ".75rem" }} type="button" onClick={() => setInviting((v) => !v)}>
            <Plus /> Invite User
          </button>
        )}
      </div>

      {inviting && (
        <form className="device-card" style={{ marginTop: 0 }} onSubmit={submitInvite}>
          <input
            type="email"
            className="form-input"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <select className="form-select" style={{ minWidth: 110 }} value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn-primary" type="submit" disabled={pending} style={{ fontSize: ".75rem" }}>
            {pending ? "Sending…" : "Send"}
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
                <strong>{m.name}</strong> ({m.email})
                <div className="cell-sub">{m.role === "owner" ? "Workspace Owner" : roleLabel(m.role)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="plan-badge">{m.role === "member" ? "Member" : "Admin"}</span>
              {canManage && m.role !== "owner" && m.user_id !== data.user.id && (
                <button
                  className="modal-close-btn"
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => window.confirm(`Remove ${m.name} from the workspace?`) && run(() => removeMember(m.user_id))}
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
              <strong>{inv.email}</strong>
              <div className="cell-sub">Invitation sent · {roleLabel(inv.role)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="coming-soon">Pending</span>
              {canManage && (
                <button className="modal-close-btn" type="button" aria-label={`Revoke invitation for ${inv.email}`} onClick={() => run(() => revokeInvitation(inv.id))}>
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
  return (
    <>
      <p style={{ fontSize: ".82rem", color: "var(--muted)", marginBottom: 18 }}>
        Connect your data destinations to automatically sync discovered customers to your CRM or sheets.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="integration-card">
          <div>
            <strong>HubSpot &amp; Salesforce Sync</strong>
            <div className="cell-sub">Export discovered accounts with 1 click</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="coming-soon">Coming soon</span>
            <button className="btn-secondary" style={{ fontSize: ".72rem" }} type="button" disabled>Connect</button>
          </div>
        </div>
        <div className="integration-card">
          <div>
            <strong>Google Sheets / CSV Webhooks</strong>
            <div className="cell-sub">Live lead stream into your spreadsheets</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="coming-soon">Coming soon</span>
            <button className="btn-primary" style={{ fontSize: ".72rem" }} type="button" disabled>Configure</button>
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
