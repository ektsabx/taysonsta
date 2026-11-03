"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_ACCEPT, checkImageFile } from "@/lib/uploads/image";
import { createClient } from "@/lib/supabase/client";
import { countryLabel } from "@/lib/format";
import { DIAL_CODES, joinPhone, splitPhone } from "@/lib/dial-codes";
import { flagEmoji } from "@/lib/country-codes";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { changeEmail, deleteAccount, setAvatar, signOut, updatePhone, updatePreferences } from "@/app/(app)/settings/actions";
import type { ShellData } from "../types";
import { useSave, SettingRow } from "./shared";

function dialCountries(locale: "en" | "ar") {
  return Object.keys(DIAL_CODES).map((code) => ({ code, name: countryLabel(code, locale) })).sort((x, y) => Number(DIAL_CODES[x.code]) - Number(DIAL_CODES[y.code]) || x.name.localeCompare(y.name, locale));
}
export function AccountTab({ data }: { data: ShellData }) {
  const { t, locale } = useI18n();
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

  // Country picker + the number (owner, 2026-11-03); saved as one E.164 number.
  const initial = splitPhone(data.user.phone, data.preferences.country);
  const [dial, setDial] = useState(initial.country ?? "");
  const [phone, setPhone] = useState(initial.national);
  const [savedPhone, setSavedPhone] = useState(data.user.phone ?? "");
  const savePhone = (country = dial, national = phone) => {
    const full = joinPhone(country || null, national);
    if (full === savedPhone) return;
    run(async () => {
      const r = await updatePhone(full);
      if (r.ok) {
        const next = splitPhone(r.phone, country);
        setPhone(next.national);
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
        <div className="phone-field" dir="ltr">
          <select className="form-select" aria-label={a.phoneCountry} value={dial} onChange={(e) => { setDial(e.target.value); if (phone) savePhone(e.target.value, phone); }}>
            <option value="">+</option>
            {dialCountries(locale).map((c) => <option key={c.code} value={c.code} title={c.name}>{`${flagEmoji(c.code)} +${DIAL_CODES[c.code]}`}</option>)}
          </select>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            className="form-input"
            placeholder={a.phonePlaceholder}
            aria-label={a.phone}
            maxLength={24}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => savePhone()}
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
