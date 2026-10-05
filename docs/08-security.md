# 08 — Security & Multi-tenancy

- **Auth:** Supabase Auth, magic link only (Yolias). BOS has its own auth and RBAC.
- **Tenancy:** every workspace table has RLS using `is_workspace_member`. Billing is owner/admin only.
- **Service role:** only in server code (workers, admin server, specific actions). Never sent to the browser. Queries made with it always filter by workspace explicitly.
- **`intel` schema:** no grants to `anon` / `authenticated`.
- **Secrets:** provider keys in Supabase Vault, referenced by id from the registry. Env vars only for bootstrap keys (Supabase, LLM, STT).
- **Frontend is untrusted:** quota, prices, permissions and plan limits are enforced in SQL/server code.
- **Agent:** tool-level authorization; prompt is never the guard.
- **Admin:** BOS RBAC permission keys (e.g. `platform.providers.manage`, `platform.users.read`). Every admin write is audited (who, what, before/after).
- **Suppression list:** checked before delivering any person; supports opt-out requests.
- **Licensing:** enforced by the Intelligence Layer at storage, display, export and cross-workspace reuse.
- **PII:** minimise stored raw provider payloads; respect `retention_limit`.

## Built (2026-10-05)

- **Two-factor authentication** (TOTP, Supabase MFA). Enforced three times:
  the proxy sends an aal1 session to `/two-factor`, `getSession()` returns
  nothing until the code is entered, and restrictive RLS policies
  (`public.mfa_ok()`) block customer tables for an aal1 session of a user
  with a verified factor — even when calling the database API directly.
- **Agent:** tools authorized in code and audited (`agent_tool_calls`); the
  browser sends only text; assistant turns are written by the server only;
  rate limit 8 messages / minute and 300 / day per user.
- **Suspend user** (Yolias Admin): Supabase Auth ban + audit + security
  email. Existing access tokens expire within the hour.
- **Security emails:** new device sign-in, repeated sign-in link requests,
  email changed, 2FA on/off, signed out everywhere, suspended/restored.
- **Secrets:** LLM, email and STT keys only in server env; provider data
  keys in Vault; the worker heartbeat reports only yes/no per service.
- **Emails** are logged without secrets; announcement links must be https and
  admin text is escaped.

## BYOK (later)

Workspaces may bring their own provider keys on higher plans, stored in
Vault per workspace. Conditions: their key's data is licensed to them only
(not written to shared intel unless their terms allow), their calls are
costed separately, and our quota still counts delivered Prospects unless a
plan says otherwise. Not in the current phases.
