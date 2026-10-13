-- Affiliate program (2026-10-12, docs/12 D-178).
-- Marketers apply with their Yolias account; an approved affiliate gets a
-- referral link (/r/<code>). A visit sets a first-party cookie; the signup
-- that follows is attributed to the affiliate (referral). Commissions are
-- created by the database itself when a referred workspace's payment is
-- fulfilled (trigger on payments), never from anything the browser sends,
-- and reversed when the payment is refunded. Money is in cents (bigint).
-- Financial rows are never deleted: corrections are reversals/adjustments.
-- Every program setting is a new version row; each commission keeps the
-- version and the rule it was calculated with.

-- ───────────────────────── Program settings (versioned) ─────────────────────────

create table public.affiliate_program_versions (
  id bigint generated always as identity primary key,
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  terms_version text not null check (length(terms_version) between 1 and 40),
  terms_text text not null check (length(terms_text) between 1 and 40000),
  note text check (note is null or length(note) <= 300),
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);
alter table public.affiliate_program_versions enable row level security;  -- service role only

insert into public.affiliate_program_versions (settings, terms_version, terms_text, note)
values (
  '{
    "enabled": true,
    "auto_approve": false,
    "questions": [
      {"id": "website", "label": "Website or main social profile", "required": true},
      {"id": "audience", "label": "Who is your audience?", "required": true},
      {"id": "promotion", "label": "How will you promote Yolias?", "required": true}
    ],
    "commission": {"type": "percent", "percent_bps": 2000, "fixed_cents": 0},
    "eligible": {"plans": ["pro", "growth"], "periods": ["monthly", "annual"], "packs": false},
    "recurring": {"enabled": true, "max_payments": 12},
    "attribution": {"days": 60, "model": "first_touch"},
    "min_payment_cents": 100,
    "hold_days": 30,
    "min_payout_cents": 5000,
    "currencies": ["USD"],
    "refund_policy": "reverse",
    "dispute_policy": "reverse",
    "excluded_workspaces": [],
    "excluded_emails": [],
    "risk": {"hold_same_ip": true, "max_signups_per_ip_day": 3},
    "payout_methods": [
      {"id": "paypal", "label": "PayPal", "enabled": true},
      {"id": "bank_transfer", "label": "Bank transfer", "enabled": true},
      {"id": "wise", "label": "Wise", "enabled": false}
    ],
    "include_test_payments": false,
    "notify_affiliates": true
  }'::jsonb,
  '2026-10-12',
  'Yolias Affiliate Program Terms (draft, pending legal review). Commissions are earned only on qualifying payments made by customers you refer, calculated on the amount the customer paid for the plan, and held for the waiting period before they can be withdrawn. Refunded or disputed payments reverse their commission. Self-referrals, paid ads on the Yolias brand name, spam and misleading claims are not allowed and can lead to suspension. Yolias may change these terms; affiliates are told about material changes. Payouts are sent manually by the Yolias team to the payout method you choose.',
  'Initial program'
);

create or replace function public.affiliate_settings()
returns table (version_id bigint, settings jsonb, terms_version text)
language sql stable security definer set search_path = public
as $$
  select id, settings, terms_version from public.affiliate_program_versions order by id desc limit 1;
$$;

-- ───────────────────────── Affiliates ─────────────────────────

create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  -- Kept (set null) if the account is deleted: the financial history stays.
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  code text not null unique check (code ~ '^[a-z0-9]{6,16}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended', 'disabled')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  terms_version text not null,
  terms_accepted_at timestamptz not null,
  program_version_id bigint references public.affiliate_program_versions(id),
  payout_method text check (payout_method is null or payout_method ~ '^[a-z_]{2,30}$'),
  -- Where to send money (e.g. a PayPal email or bank details). Owner + finance only.
  payout_details text check (payout_details is null or length(payout_details) <= 1000),
  decision_reason text check (decision_reason is null or length(decision_reason) <= 500),
  decided_at timestamptz,
  decided_by text,
  ip_hash text,
  risk_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index affiliates_status_idx on public.affiliates (status, created_at desc);
create trigger affiliates_updated_at before update on public.affiliates for each row execute function public.set_updated_at();
alter table public.affiliates enable row level security;
create policy "affiliate reads own profile" on public.affiliates for select using (user_id = auth.uid());
grant select on public.affiliates to authenticated;

-- ───────────────────────── Visits & referrals ─────────────────────────

create table public.affiliate_visits (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  ip_hash text,
  landing_path text check (landing_path is null or length(landing_path) <= 300),
  campaign text check (campaign is null or campaign ~ '^[A-Za-z0-9_.-]{1,60}$'),
  referrer_host text check (referrer_host is null or length(referrer_host) <= 200),
  created_at timestamptz not null default now()
);
create index affiliate_visits_aff_idx on public.affiliate_visits (affiliate_id, created_at desc);
create index affiliate_visits_dedupe_idx on public.affiliate_visits (affiliate_id, ip_hash, created_at desc);
alter table public.affiliate_visits enable row level security;  -- service role only

create table public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  referred_user_id uuid unique references auth.users(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  visit_id uuid references public.affiliate_visits(id) on delete set null,
  visit_at timestamptz,
  attributed_at timestamptz not null default now(),
  model text not null check (model in ('first_touch', 'last_touch')),
  method text not null default 'cookie' check (method in ('cookie', 'manual')),
  campaign text,
  status text not null default 'active' check (status in ('active', 'rejected')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 300),
  risk_flags text[] not null default '{}',
  signup_ip_hash text,
  program_version_id bigint references public.affiliate_program_versions(id),
  created_at timestamptz not null default now()
);
create unique index affiliate_referrals_workspace_uq on public.affiliate_referrals (workspace_id) where workspace_id is not null;
create index affiliate_referrals_aff_idx on public.affiliate_referrals (affiliate_id, created_at desc);
alter table public.affiliate_referrals enable row level security;  -- service role only

-- ───────────────────────── Payouts ─────────────────────────

create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency in ('USD')),
  method text not null,
  details_snapshot text,
  status text not null default 'requested' check (status in ('requested', 'approved', 'processing', 'paid', 'rejected', 'failed')),
  reference text check (reference is null or length(reference) <= 200),
  reason text check (reason is null or length(reason) <= 500),
  admin_note text check (admin_note is null or length(admin_note) <= 2000),
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  paid_at timestamptz,
  paid_by text,
  updated_at timestamptz not null default now()
);
-- One open payout per affiliate: a second (or concurrent) request can't take the same balance.
create unique index affiliate_payouts_open_uq on public.affiliate_payouts (affiliate_id) where status in ('requested', 'approved', 'processing');
create index affiliate_payouts_status_idx on public.affiliate_payouts (status, requested_at desc);
create trigger affiliate_payouts_updated_at before update on public.affiliate_payouts for each row execute function public.set_updated_at();
alter table public.affiliate_payouts enable row level security;
create policy "affiliate reads own payouts" on public.affiliate_payouts for select
  using (exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid()));
grant select on public.affiliate_payouts to authenticated;

-- ───────────────────────── Commissions (the ledger) ─────────────────────────

create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  referral_id uuid references public.affiliate_referrals(id) on delete restrict,
  -- set null keeps the commission if a workspace (and its payments) is deleted.
  payment_id uuid references public.payments(id) on delete set null,
  kind text not null check (kind in ('payment', 'reversal', 'adjustment')),
  status text not null check (status in ('pending', 'approved', 'available', 'processing', 'paid', 'rejected', 'reversed')),
  -- What the customer paid (USD cents) and the commission on it. Reversals and
  -- negative adjustments carry a negative amount.
  base_cents bigint not null default 0,
  amount_cents bigint not null check (amount_cents <> 0),
  currency text not null default 'USD' check (currency in ('USD')),
  rule jsonb not null default '{}'::jsonb,
  program_version_id bigint references public.affiliate_program_versions(id),
  payment_seq int,
  payment_kind text,
  mode text not null default 'live' check (mode in ('test', 'live')),
  on_hold boolean not null default false,
  hold_reasons text[] not null default '{}',
  available_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  payout_id uuid references public.affiliate_payouts(id) on delete restrict,
  reversal_of uuid references public.affiliate_commissions(id) on delete restrict,
  reason text check (reason is null or length(reason) <= 500),
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_commissions_sign check ((kind = 'payment' and amount_cents > 0) or (kind = 'reversal' and amount_cents < 0) or kind = 'adjustment')
);
-- One commission per payment; one clawback per paid commission.
create unique index affiliate_commissions_payment_uq on public.affiliate_commissions (payment_id) where kind = 'payment' and payment_id is not null;
create unique index affiliate_commissions_reversal_uq on public.affiliate_commissions (reversal_of) where reversal_of is not null;
create index affiliate_commissions_aff_idx on public.affiliate_commissions (affiliate_id, status, created_at desc);
create index affiliate_commissions_status_idx on public.affiliate_commissions (status, available_at);
create index affiliate_commissions_payout_idx on public.affiliate_commissions (payout_id) where payout_id is not null;
create trigger affiliate_commissions_updated_at before update on public.affiliate_commissions for each row execute function public.set_updated_at();
alter table public.affiliate_commissions enable row level security;
create policy "affiliate reads own commissions" on public.affiliate_commissions for select
  using (exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid()));
grant select on public.affiliate_commissions to authenticated;

-- Amounts are fixed once written; history is never deleted.
create or replace function public.affiliate_ledger_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'affiliate financial records are never deleted (use a reversal)';
  end if;
  -- (Nested ifs: PL/pgSQL may evaluate both sides of an AND, and each table has different columns.)
  if tg_table_name = 'affiliate_events' then
    raise exception 'the affiliate audit trail is append-only';
  elsif tg_table_name = 'affiliate_commissions' then
    if new.amount_cents <> old.amount_cents or new.base_cents <> old.base_cents or new.affiliate_id <> old.affiliate_id
       or new.kind <> old.kind or new.rule is distinct from old.rule then
      raise exception 'commission amounts are fixed once created';
    end if;
  elsif tg_table_name = 'affiliate_payouts' then
    if new.amount_cents <> old.amount_cents or new.affiliate_id <> old.affiliate_id then
      raise exception 'payout amounts are fixed once requested';
    end if;
  end if;
  return new;
end $$;
create trigger affiliate_commissions_guard before update or delete on public.affiliate_commissions for each row execute function public.affiliate_ledger_guard();
create trigger affiliate_payouts_guard before update or delete on public.affiliate_payouts for each row execute function public.affiliate_ledger_guard();

-- ───────────────────────── Audit log & internal notes ─────────────────────────

create table public.affiliate_events (
  id bigint generated always as identity primary key,
  affiliate_id uuid references public.affiliates(id) on delete restrict,
  actor text not null,
  action text not null,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index affiliate_events_aff_idx on public.affiliate_events (affiliate_id, created_at desc);
create index affiliate_events_created_idx on public.affiliate_events (created_at desc);
create trigger affiliate_events_guard before update or delete on public.affiliate_events for each row execute function public.affiliate_ledger_guard();
alter table public.affiliate_events enable row level security;  -- service role only

create table public.affiliate_notes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  author text not null,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index affiliate_notes_aff_idx on public.affiliate_notes (affiliate_id, created_at desc);
alter table public.affiliate_notes enable row level security;  -- service role only

create or replace function public.affiliate_log(p_affiliate uuid, p_actor text, p_action text, p_type text, p_id text, p_before jsonb, p_after jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.affiliate_events (affiliate_id, actor, action, target_type, target_id, before, after)
  values (p_affiliate, coalesce(nullif(p_actor, ''), 'system'), p_action, p_type, p_id, p_before, p_after);
$$;

-- ───────────────────────── Attribution ─────────────────────────

-- Links a new account to the affiliate whose link it came from. Rules:
--  * the visit must exist, be within the attribution window, and come before
--    the account was created; the account must be new (created < 1 day ago);
--  * the affiliate must be approved and not the person signing up;
--  * one referral per account (the first valid one wins).
-- Weak signals (same network as the affiliate, many signups from one network)
-- only flag the referral for review; they never reject it.
create or replace function public.affiliate_attribute_signup(p_user uuid, p_visit uuid, p_ip_hash text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cfg jsonb; v_version bigint;
  v_visit public.affiliate_visits; v_aff public.affiliates;
  v_user_created timestamptz; v_ws uuid; v_flags text[] := '{}'; v_id uuid; v_days int; v_same int;
begin
  select version_id, settings into v_version, v_cfg from public.affiliate_settings();
  if v_cfg is null or not coalesce((v_cfg->>'enabled')::boolean, false) then return null; end if;
  select * into v_visit from public.affiliate_visits where id = p_visit;
  if not found then return null; end if;
  select created_at into v_user_created from auth.users where id = p_user;
  if v_user_created is null or v_user_created < now() - interval '1 day' then return null; end if;
  v_days := greatest(1, least(365, coalesce((v_cfg->'attribution'->>'days')::int, 60)));
  if v_visit.created_at < now() - make_interval(days => v_days) then return null; end if;
  if v_visit.created_at > v_user_created + interval '5 minutes' then return null; end if;
  select * into v_aff from public.affiliates where id = v_visit.affiliate_id;
  if v_aff.id is null or v_aff.status <> 'approved' then return null; end if;
  if v_aff.user_id = p_user then
    perform public.affiliate_log(v_aff.id, 'system', 'referral.self_blocked', 'user', p_user::text, null, null);
    return null;
  end if;

  if p_ip_hash is not null and v_aff.ip_hash = p_ip_hash and coalesce((v_cfg->'risk'->>'hold_same_ip')::boolean, true) then
    v_flags := array_append(v_flags, 'same_network_as_affiliate');
  end if;
  if p_ip_hash is not null then
    select count(*) into v_same from public.affiliate_referrals
     where affiliate_id = v_aff.id and signup_ip_hash = p_ip_hash and created_at > now() - interval '1 day';
    if v_same >= greatest(1, coalesce((v_cfg->'risk'->>'max_signups_per_ip_day')::int, 3)) then
      v_flags := array_append(v_flags, 'many_signups_same_network');
    end if;
  end if;

  -- The account's own workspace (owner), if it already exists.
  select m.workspace_id into v_ws from public.workspace_members m where m.user_id = p_user and m.role = 'owner' limit 1;
  if v_ws is not null and exists (select 1 from public.affiliate_referrals where workspace_id = v_ws) then v_ws := null; end if;

  insert into public.affiliate_referrals (affiliate_id, referred_user_id, workspace_id, visit_id, visit_at, model, campaign, risk_flags, signup_ip_hash, program_version_id)
  values (v_aff.id, p_user, v_ws, v_visit.id, v_visit.created_at, coalesce(v_cfg->'attribution'->>'model', 'first_touch'), v_visit.campaign, v_flags, p_ip_hash, v_version)
  on conflict (referred_user_id) do nothing
  returning id into v_id;
  if v_id is not null then
    perform public.affiliate_log(v_aff.id, 'system', 'referral.created', 'referral', v_id::text, null,
      jsonb_build_object('visit_at', v_visit.created_at, 'campaign', v_visit.campaign, 'flags', v_flags));
  end if;
  return v_id;
end $$;

-- ───────────────────────── Commission engine ─────────────────────────

-- Creates the commission for a fulfilled payment, if it qualifies. Idempotent
-- (one commission per payment, enforced by a unique index). Returns its id.
create or replace function public.affiliate_record_payment(p_payment uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cfg jsonb; v_version bigint; p public.payments; r public.affiliate_referrals; v_aff public.affiliates;
  v_base bigint; v_amount bigint; v_seq int; v_max int; v_rule jsonb; v_hold int; v_flags text[] := '{}';
  v_email text; v_id uuid; v_type text;
begin
  select * into p from public.payments where id = p_payment;
  if not found or p.status <> 'succeeded' or p.fulfilled_at is null then return null; end if;
  if exists (select 1 from public.affiliate_commissions where payment_id = p.id and kind = 'payment') then return null; end if;

  -- The referral for this workspace, or for the person who paid (first payment).
  select * into r from public.affiliate_referrals where workspace_id = p.workspace_id and status = 'active';
  if not found and p.created_by is not null then
    select * into r from public.affiliate_referrals where referred_user_id = p.created_by and workspace_id is null and status = 'active';
    if found then
      if exists (select 1 from public.affiliate_referrals where workspace_id = p.workspace_id) then return null; end if;
      update public.affiliate_referrals set workspace_id = p.workspace_id where id = r.id;
    end if;
  end if;
  if r.id is null then return null; end if;

  select version_id, settings into v_version, v_cfg from public.affiliate_settings();
  select * into v_aff from public.affiliates where id = r.affiliate_id;

  -- Eligibility (each skip is logged so the admin can see why).
  if not coalesce((v_cfg->>'enabled')::boolean, false) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"program_disabled"}'); return null;
  end if;
  if v_aff.status <> 'approved' then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, jsonb_build_object('why', 'affiliate_' || v_aff.status)); return null;
  end if;
  if p.mode = 'test' and not coalesce((v_cfg->>'include_test_payments')::boolean, false) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"test_payment"}'); return null;
  end if;
  if p.currency <> 'USD' or not (coalesce(v_cfg->'currencies', '["USD"]'::jsonb) ? p.currency) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"currency"}'); return null;
  end if;
  if p.kind = 'subscription' and not (coalesce(v_cfg->'eligible'->'plans', '[]') ? p.plan and coalesce(v_cfg->'eligible'->'periods', '[]') ? p.billing_period) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"plan_not_eligible"}'); return null;
  end if;
  if p.kind = 'prospect_pack' and not coalesce((v_cfg->'eligible'->>'packs')::boolean, false) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"packs_not_eligible"}'); return null;
  end if;
  if coalesce(v_cfg->'excluded_workspaces', '[]') ? p.workspace_id::text then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"customer_excluded"}'); return null;
  end if;
  select lower(email) into v_email from public.profiles where id = p.created_by;
  if v_email is not null and coalesce(v_cfg->'excluded_emails', '[]') ? v_email then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"customer_excluded"}'); return null;
  end if;
  -- The affiliate paying for their own (or a shared) workspace.
  if v_aff.user_id is not null and exists (select 1 from public.workspace_members where workspace_id = p.workspace_id and user_id = v_aff.user_id) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"self_referral"}'); return null;
  end if;

  v_base := round(p.amount * 100)::bigint;
  if v_base < coalesce((v_cfg->>'min_payment_cents')::bigint, 0) then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"below_minimum"}'); return null;
  end if;

  -- Which qualifying payment of this customer this is (1 = first).
  select count(*) + 1 into v_seq from public.affiliate_commissions where referral_id = r.id and kind = 'payment' and status <> 'rejected';
  if v_seq > 1 then
    if not coalesce((v_cfg->'recurring'->>'enabled')::boolean, false) then
      perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"not_recurring"}'); return null;
    end if;
    v_max := nullif(v_cfg->'recurring'->>'max_payments', '')::int;
    if v_max is not null and v_seq > v_max then
      perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, jsonb_build_object('why', 'recurring_limit', 'max', v_max)); return null;
    end if;
  end if;

  v_type := coalesce(v_cfg->'commission'->>'type', 'percent');
  if v_type = 'fixed' then
    v_amount := least(coalesce((v_cfg->'commission'->>'fixed_cents')::bigint, 0), v_base);
  else
    v_amount := (v_base * coalesce((v_cfg->'commission'->>'percent_bps')::bigint, 0)) / 10000;
  end if;
  if v_amount <= 0 then return null; end if;

  v_rule := jsonb_build_object('type', v_type, 'percent_bps', v_cfg->'commission'->'percent_bps', 'fixed_cents', v_cfg->'commission'->'fixed_cents',
    'hold_days', v_cfg->'hold_days', 'recurring', v_cfg->'recurring', 'base', 'payment amount (USD) as charged');
  v_hold := greatest(0, least(365, coalesce((v_cfg->>'hold_days')::int, 30)));
  if array_length(r.risk_flags, 1) is not null then v_flags := r.risk_flags; end if;

  insert into public.affiliate_commissions (affiliate_id, referral_id, payment_id, kind, status, base_cents, amount_cents, rule, program_version_id,
    payment_seq, payment_kind, mode, on_hold, hold_reasons, available_at)
  values (v_aff.id, r.id, p.id, 'payment', 'pending', v_base, v_amount, v_rule, v_version,
    v_seq, p.kind, p.mode, array_length(v_flags, 1) is not null, v_flags, coalesce(p.paid_at, now()) + make_interval(days => v_hold))
  on conflict do nothing
  returning id into v_id;
  if v_id is not null then
    perform public.affiliate_log(v_aff.id, 'system', 'commission.created', 'commission', v_id::text, null,
      jsonb_build_object('payment', p.id, 'amount_cents', v_amount, 'seq', v_seq, 'on_hold', array_length(v_flags, 1) is not null));
  end if;
  return v_id;
end $$;

-- Reverses the commission of a refunded / disputed payment. Not yet paid out:
-- the commission itself becomes `reversed`. Already paid (or in a payout):
-- it is marked `reversed` and a negative entry takes the amount back from the
-- next payout. Idempotent.
create or replace function public.affiliate_reverse_commission(p_commission uuid, p_reason text, p_actor text)
returns text
language plpgsql security definer set search_path = public
as $$
declare c public.affiliate_commissions;
begin
  select * into c from public.affiliate_commissions where id = p_commission for update;
  if not found or c.kind <> 'payment' then return 'not_found'; end if;
  if c.status in ('reversed', 'rejected') then return 'already'; end if;
  if c.status = 'processing' then return 'in_payout'; end if;
  if c.status = 'paid' then
    insert into public.affiliate_commissions (affiliate_id, referral_id, payment_id, kind, status, base_cents, amount_cents, currency, rule, program_version_id, mode, available_at, reversal_of, reason, created_by)
    values (c.affiliate_id, c.referral_id, null, 'reversal', 'available', 0, -c.amount_cents, c.currency, jsonb_build_object('reverses', c.id), c.program_version_id, c.mode, now(), c.id, left(p_reason, 500), coalesce(p_actor, 'system'))
    on conflict do nothing;
  end if;
  update public.affiliate_commissions set status = 'reversed', reason = left(p_reason, 500) where id = c.id;
  perform public.affiliate_log(c.affiliate_id, coalesce(p_actor, 'system'), 'commission.reversed', 'commission', c.id::text,
    jsonb_build_object('status', c.status), jsonb_build_object('status', 'reversed', 'reason', p_reason, 'clawback', c.status = 'paid'));
  return 'reversed';
end $$;

-- Payments → commissions. Runs inside the payment's own transaction, but a
-- failure here never blocks the payment: it is logged for the admin instead.
create or replace function public.affiliate_on_payment()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_c uuid;
begin
  begin
    if new.status = 'succeeded' and new.fulfilled_at is not null and old.fulfilled_at is null then
      perform public.affiliate_record_payment(new.id);
    elsif new.status = 'refunded' and old.status is distinct from 'refunded' then
      select id into v_c from public.affiliate_commissions where payment_id = new.id and kind = 'payment';
      if v_c is not null then
        if public.affiliate_reverse_commission(v_c, 'Payment refunded', 'system') = 'in_payout' then
          update public.affiliate_commissions set on_hold = true, hold_reasons = array_append(hold_reasons, 'refunded_during_payout') where id = v_c;
        end if;
      end if;
    end if;
  exception when others then
    insert into public.affiliate_events (affiliate_id, actor, action, target_type, target_id, after)
    values (null, 'system', 'commission.error', 'payment', new.id::text, jsonb_build_object('error', left(sqlerrm, 300)));
  end;
  return null;
end $$;
create trigger payments_affiliate after update of status, fulfilled_at on public.payments
  for each row execute function public.affiliate_on_payment();

-- Moves commissions forward once their waiting period is over (pending /
-- approved → available). Held commissions stay where they are. Returns the
-- commissions that became available (for the affiliate emails).
create or replace function public.affiliate_mature()
returns table (out_commission uuid, out_affiliate uuid)
language plpgsql security definer set search_path = public
as $$
declare rec record;
begin
  for rec in
    update public.affiliate_commissions c
       set status = 'available', approved_at = coalesce(c.approved_at, now())
     where c.kind = 'payment' and c.status in ('pending', 'approved') and not c.on_hold and c.available_at <= now()
       and exists (select 1 from public.affiliates a where a.id = c.affiliate_id and a.status = 'approved')
    returning c.id, c.affiliate_id
  loop
    perform public.affiliate_log(rec.affiliate_id, 'system', 'commission.available', 'commission', rec.id::text, null, null);
    out_commission := rec.id;
    out_affiliate := rec.affiliate_id;
    return next;
  end loop;
end $$;

-- Admin decisions on one commission (server-checked transitions).
create or replace function public.affiliate_set_commission(p_commission uuid, p_action text, p_actor text, p_reason text)
returns text
language plpgsql security definer set search_path = public
as $$
declare c public.affiliate_commissions; v_to text;
begin
  select * into c from public.affiliate_commissions where id = p_commission for update;
  if not found then return 'not_found'; end if;
  if p_action = 'hold' then
    if c.status not in ('pending', 'approved', 'available') then return 'invalid'; end if;
    if c.status = 'available' then
      update public.affiliate_commissions set on_hold = true, status = 'approved', hold_reasons = array_append(hold_reasons, 'admin_review') where id = c.id;
    else
      update public.affiliate_commissions set on_hold = true, hold_reasons = array_append(hold_reasons, 'admin_review') where id = c.id;
    end if;
  elsif p_action = 'release' then
    if not c.on_hold then return 'invalid'; end if;
    update public.affiliate_commissions set on_hold = false where id = c.id;
  elsif p_action = 'approve' then
    if c.status <> 'pending' then return 'invalid'; end if;
    v_to := case when c.available_at <= now() and not c.on_hold then 'available' else 'approved' end;
    update public.affiliate_commissions set status = v_to, approved_at = now() where id = c.id;
  elsif p_action = 'reject' then
    if c.status not in ('pending', 'approved', 'available') or c.kind <> 'payment' then return 'invalid'; end if;
    update public.affiliate_commissions set status = 'rejected', reason = left(p_reason, 500) where id = c.id;
  elsif p_action = 'reverse' then
    return public.affiliate_reverse_commission(c.id, p_reason, p_actor);
  else
    return 'invalid';
  end if;
  perform public.affiliate_log(c.affiliate_id, p_actor, 'commission.' || p_action, 'commission', c.id::text,
    jsonb_build_object('status', c.status, 'on_hold', c.on_hold), jsonb_build_object('reason', p_reason));
  return 'ok';
end $$;

-- A documented manual correction (positive or negative), never an edit of history.
create or replace function public.affiliate_adjust(p_affiliate uuid, p_amount_cents bigint, p_reason text, p_actor text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if p_amount_cents = 0 or abs(p_amount_cents) > 100000000 then raise exception 'invalid amount'; end if;
  if coalesce(length(trim(p_reason)), 0) < 3 then raise exception 'reason required'; end if;
  insert into public.affiliate_commissions (affiliate_id, kind, status, base_cents, amount_cents, rule, available_at, reason, created_by)
  values (p_affiliate, 'adjustment', 'available', 0, p_amount_cents, '{"manual":true}', now(), left(p_reason, 500), p_actor)
  returning id into v_id;
  perform public.affiliate_log(p_affiliate, p_actor, 'commission.adjustment', 'commission', v_id::text, null, jsonb_build_object('amount_cents', p_amount_cents, 'reason', p_reason));
  return v_id;
end $$;

-- ───────────────────────── Balances & payouts ─────────────────────────

create or replace function public.affiliate_balances(p_affiliate uuid)
returns table (pending_cents bigint, approved_cents bigint, available_cents bigint, processing_cents bigint, paid_cents bigint, reversed_cents bigint, rejected_cents bigint, on_hold_cents bigint)
language sql stable security definer set search_path = public
as $$
  select
    coalesce(sum(amount_cents) filter (where status = 'pending' and kind = 'payment'), 0),
    coalesce(sum(amount_cents) filter (where status = 'approved'), 0),
    coalesce(sum(amount_cents) filter (where status = 'available'), 0),
    coalesce(sum(amount_cents) filter (where status = 'processing'), 0),
    coalesce(sum(amount_cents) filter (where status = 'paid'), 0),
    coalesce(sum(amount_cents) filter (where status = 'reversed' and kind = 'payment'), 0),
    coalesce(sum(amount_cents) filter (where status = 'rejected'), 0),
    coalesce(sum(amount_cents) filter (where on_hold and status in ('pending', 'approved')), 0)
  from public.affiliate_commissions
  where affiliate_id = p_affiliate
    and (mode = 'live' or coalesce((select (s.settings->>'include_test_payments')::boolean from public.affiliate_settings() s), false));
$$;

-- Takes the whole available balance into one payout request. The affiliate
-- row is locked, and only one open payout can exist (unique index), so two
-- requests at the same moment can never spend the same balance.
create or replace function public.affiliate_request_payout(p_affiliate uuid, p_method text)
returns table (out_payout uuid, out_error text)
language plpgsql security definer set search_path = public
as $$
declare a public.affiliates; v_cfg jsonb; v_total bigint; v_min bigint; v_id uuid; v_method jsonb;
begin
  select * into a from public.affiliates where id = p_affiliate for update;
  if not found then return query select null::uuid, 'not_found'; return; end if;
  if a.status <> 'approved' then return query select null::uuid, 'not_approved'; return; end if;
  if exists (select 1 from public.affiliate_payouts where affiliate_id = a.id and status in ('requested', 'approved', 'processing')) then
    return query select null::uuid, 'open_payout'; return;
  end if;
  select settings into v_cfg from public.affiliate_settings();
  select m into v_method from jsonb_array_elements(coalesce(v_cfg->'payout_methods', '[]')) m where m->>'id' = p_method and coalesce((m->>'enabled')::boolean, false);
  if v_method is null then return query select null::uuid, 'method'; return; end if;
  if coalesce(length(trim(a.payout_details)), 0) = 0 then return query select null::uuid, 'details'; return; end if;
  select coalesce(sum(amount_cents), 0) into v_total from public.affiliate_commissions
   where affiliate_id = a.id and status = 'available' and payout_id is null
     and (mode = 'live' or coalesce((v_cfg->>'include_test_payments')::boolean, false));
  v_min := greatest(1, coalesce((v_cfg->>'min_payout_cents')::bigint, 0));
  if v_total < v_min then return query select null::uuid, 'below_minimum'; return; end if;
  insert into public.affiliate_payouts (affiliate_id, amount_cents, method, details_snapshot)
  values (a.id, v_total, p_method, a.payout_details) returning id into v_id;
  update public.affiliate_commissions set status = 'processing', payout_id = v_id
   where affiliate_id = a.id and status = 'available' and payout_id is null
     and (mode = 'live' or coalesce((v_cfg->>'include_test_payments')::boolean, false));
  -- The sum is re-checked against what was actually claimed.
  if (select coalesce(sum(amount_cents), 0) from public.affiliate_commissions where payout_id = v_id) <> v_total then
    raise exception 'payout total changed';
  end if;
  perform public.affiliate_log(a.id, 'user:' || coalesce(a.user_id::text, ''), 'payout.requested', 'payout', v_id::text, null, jsonb_build_object('amount_cents', v_total, 'method', p_method));
  return query select v_id, null::text;
end $$;

-- Admin moves a payout: requested → approved | rejected; approved → processing |
-- rejected; processing → paid | failed. Rejected / failed put the commissions
-- back as available. "paid" records that the team sent the money manually.
create or replace function public.affiliate_set_payout(p_payout uuid, p_to text, p_actor text, p_reference text, p_reason text, p_note text)
returns text
language plpgsql security definer set search_path = public
as $$
declare o public.affiliate_payouts; v_ok boolean;
begin
  select * into o from public.affiliate_payouts where id = p_payout for update;
  if not found then return 'not_found'; end if;
  v_ok := (o.status = 'requested' and p_to in ('approved', 'rejected'))
       or (o.status = 'approved' and p_to in ('processing', 'rejected'))
       or (o.status = 'processing' and p_to in ('paid', 'failed'));
  if not v_ok then return 'invalid'; end if;
  if p_to in ('rejected', 'failed') and coalesce(length(trim(p_reason)), 0) < 3 then return 'reason_required'; end if;

  update public.affiliate_payouts set status = p_to,
    reference = coalesce(nullif(trim(p_reference), ''), reference),
    reason = case when p_to in ('rejected', 'failed') then left(p_reason, 500) else reason end,
    admin_note = coalesce(nullif(trim(p_note), ''), admin_note),
    decided_at = case when o.status = 'requested' then now() else decided_at end,
    decided_by = case when o.status = 'requested' then p_actor else decided_by end,
    paid_at = case when p_to = 'paid' then now() else paid_at end,
    paid_by = case when p_to = 'paid' then p_actor else paid_by end
  where id = o.id;

  if p_to = 'paid' then
    update public.affiliate_commissions set status = 'paid', paid_at = now() where payout_id = o.id and status = 'processing';
  elsif p_to in ('rejected', 'failed') then
    update public.affiliate_commissions set status = 'available', payout_id = null where payout_id = o.id and status = 'processing';
  end if;
  perform public.affiliate_log(o.affiliate_id, p_actor, 'payout.' || p_to, 'payout', o.id::text,
    jsonb_build_object('status', o.status), jsonb_build_object('status', p_to, 'reference', p_reference, 'reason', p_reason));
  return 'ok';
end $$;

-- ───────────────────────── Admin overview ─────────────────────────

create or replace function public.affiliate_overview(p_since timestamptz)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'affiliates', (select jsonb_object_agg(status, n) from (select status, count(*) n from public.affiliates group by status) s),
    'visits', (select count(*) from public.affiliate_visits where created_at >= p_since),
    'referrals', (select count(*) from public.affiliate_referrals where created_at >= p_since and status = 'active'),
    'paying_referrals', (select count(distinct referral_id) from public.affiliate_commissions where kind = 'payment' and mode = 'live' and created_at >= p_since and status not in ('rejected')),
    'qualifying_payments_cents', (select coalesce(sum(base_cents), 0) from public.affiliate_commissions where kind = 'payment' and mode = 'live' and created_at >= p_since and status not in ('rejected', 'reversed')),
    'commissions', (select jsonb_object_agg(status, cents) from (select status, sum(amount_cents) cents from public.affiliate_commissions where mode = 'live' and created_at >= p_since group by status) c),
    'payouts_open', (select jsonb_build_object('count', count(*), 'cents', coalesce(sum(amount_cents), 0)) from public.affiliate_payouts where status in ('requested', 'approved', 'processing')),
    'payouts_paid_cents', (select coalesce(sum(amount_cents), 0) from public.affiliate_payouts where status = 'paid' and paid_at >= p_since)
  );
$$;

-- Per-affiliate counts for the marketer dashboard and the admin list.
create or replace function public.affiliate_stats(p_affiliate uuid, p_since timestamptz)
returns table (visits bigint, signups bigint, paying bigint)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.affiliate_visits where affiliate_id = p_affiliate and created_at >= p_since),
    (select count(*) from public.affiliate_referrals where affiliate_id = p_affiliate and status = 'active' and created_at >= p_since),
    (select count(distinct referral_id) from public.affiliate_commissions where affiliate_id = p_affiliate and kind = 'payment' and mode = 'live' and status <> 'rejected' and created_at >= p_since);
$$;

-- Every function is server-only.
revoke execute on function public.affiliate_settings() from public, anon, authenticated;
revoke execute on function public.affiliate_log(uuid, text, text, text, text, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.affiliate_attribute_signup(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.affiliate_record_payment(uuid) from public, anon, authenticated;
revoke execute on function public.affiliate_reverse_commission(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.affiliate_mature() from public, anon, authenticated;
revoke execute on function public.affiliate_set_commission(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.affiliate_adjust(uuid, bigint, text, text) from public, anon, authenticated;
revoke execute on function public.affiliate_balances(uuid) from public, anon, authenticated;
revoke execute on function public.affiliate_request_payout(uuid, text) from public, anon, authenticated;
revoke execute on function public.affiliate_set_payout(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.affiliate_overview(timestamptz) from public, anon, authenticated;
revoke execute on function public.affiliate_stats(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.affiliate_settings(), public.affiliate_log(uuid, text, text, text, text, jsonb, jsonb),
  public.affiliate_attribute_signup(uuid, uuid, text), public.affiliate_record_payment(uuid), public.affiliate_reverse_commission(uuid, text, text),
  public.affiliate_mature(), public.affiliate_set_commission(uuid, text, text, text), public.affiliate_adjust(uuid, bigint, text, text),
  public.affiliate_balances(uuid), public.affiliate_request_payout(uuid, text), public.affiliate_set_payout(uuid, text, text, text, text, text),
  public.affiliate_overview(timestamptz), public.affiliate_stats(uuid, timestamptz) to service_role;
revoke execute on function public.affiliate_on_payment() from public, anon, authenticated;
grant all on public.affiliate_program_versions, public.affiliates, public.affiliate_visits, public.affiliate_referrals, public.affiliate_payouts,
  public.affiliate_commissions, public.affiliate_events, public.affiliate_notes to service_role;
