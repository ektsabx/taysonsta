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

## BYOK (later)

Workspaces may bring their own provider keys on higher plans, stored in
Vault per workspace. Conditions: their key's data is licensed to them only
(not written to shared intel unless their terms allow), their calls are
costed separately, and our quota still counts delivered Prospects unless a
plan says otherwise. Not in the current phases.
