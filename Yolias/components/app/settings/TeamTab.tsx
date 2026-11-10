"use client";

import { useState } from "react";
import { Crown, Plus, X } from "lucide-react";
import { fmt } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/client";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation, transferOwnership } from "@/app/(app)/settings/actions";
import type { ShellData } from "../types";
import { useSave } from "./shared";

function AddPeopleDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const tm = t.settings.team;
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member" | "analyst">("member");
  const { pending, error, run } = useSave();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await inviteMember({ email, role });
      if (r.ok) onClose();
      return r;
    });
  };
  return (
    <div className="sdr-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sdr-dialog" role="dialog" aria-modal="true" aria-label={tm.addTitle}>
        <div className="sdr-dialog-head"><h4>{tm.addTitle}</h4><button type="button" className="sdr-icon-btn" aria-label={t.common.close} onClick={onClose}><X /></button></div>
        <form className="sdr-dialog-body team-add" onSubmit={submit}>
          <label className="ws-field"><span className="ws-label">{tm.email}</span>
            <input type="email" className="form-input" dir="ltr" placeholder={tm.invitePlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <fieldset className="team-roles">
            <legend className="ws-label">{tm.assign}</legend>
            {(["admin", "member", "analyst"] as const).map((r) => (
              <label key={r} className={`team-role-card${role === r ? " on" : ""}`}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <div className="team-role-text"><strong>{tm.roles[r]}</strong><small>{tm.roleDesc[r]}</small></div>
              </label>
            ))}
          </fieldset>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="sdr-foot">
            <button type="button" className="sdr-btn" onClick={onClose}>{tm.cancel}</button>
            <button type="submit" className="sdr-btn primary" disabled={pending || !email.trim()}>{pending ? t.common.sending : tm.send}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
export function TeamTab({ data }: { data: ShellData }) {
  const { t } = useI18n();
  const tm = t.settings.team;
  const canManage = data.role === "owner" || data.role === "admin";
  const [adding, setAdding] = useState(false);
  const { pending, error, run } = useSave();
  const roleLabel = (r: string) => tm.roles[r as keyof typeof tm.roles] ?? r;

  return (
    <div className="setting-group">
      <div data-setting="members" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
        <div>
          <div className="setting-label">{tm.members}</div>
          <div className="setting-desc">{tm.membersDesc}</div>
        </div>
        {canManage && (
          <button className="btn-primary" style={{ fontSize: ".75rem" }} type="button" onClick={() => setAdding(true)}>
            <Plus /> {tm.invite}
          </button>
        )}
      </div>

      {adding && <AddPeopleDialog onClose={() => setAdding(false)} />}

      <div>
        {data.team.members.map((m) => (
          <div className="device-card" key={m.user_id}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: ".7rem" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.avatarUrl ? <img src={m.avatarUrl} alt="" /> : m.initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <strong>{m.name}</strong>
                <div className="cell-sub" dir="ltr" style={{ textAlign: "start" }}>{m.email}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {canManage && m.role !== "owner" && m.user_id !== data.user.id ? (
                <select className="form-select team-role" aria-label={fmt(tm.roleLabel, { name: m.name })} value={m.role} disabled={pending} onChange={(e) => run(() => changeMemberRole(m.user_id, e.target.value as "admin" | "member" | "analyst"))}>
                  {(["admin", "member", "analyst"] as const).map((r) => <option key={r} value={r}>{tm.roles[r]}</option>)}
                </select>
              ) : (
                <span className="plan-badge">{roleLabel(m.role)}</span>
              )}
              {data.role === "owner" && m.user_id !== data.user.id && (
                <button
                  className="modal-close-btn"
                  type="button"
                  aria-label={fmt(tm.makeOwner, { name: m.name })}
                  title={fmt(tm.makeOwner, { name: m.name })}
                  disabled={pending}
                  onClick={() => window.confirm(fmt(tm.makeOwnerConfirm, { name: m.name })) && run(() => transferOwnership(m.user_id))}
                >
                  <Crown />
                </button>
              )}
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

// Integrations → Email (D-256): Mailboxes, Connection and Sending rules, after AgentSDR.
