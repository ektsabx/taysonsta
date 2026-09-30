-- Taysonsta BOS — Phase 3: commercial operations.
-- Contracts, payment schedules, invoices, payments, commission engine,
-- vendors, expenses. Money is numeric(14,3) everywhere (§76) and every
-- multi-row money update happens inside one SQL function so partial
-- failures can't leave invoice/deal/commission totals out of sync.
-- See docs/bos/09-finance.md and 08-proposals-contracts.md.

create type contract_status as enum ('draft','sent','viewed','partially_signed','signed','expired','cancelled');
create type schedule_trigger as enum ('on_signing','on_date','on_milestone','on_completion');
create type schedule_status as enum ('scheduled','invoiced','paid','cancelled');
create type invoice_status as enum ('draft','sent','partially_paid','paid','overdue','cancelled');
create type payment_method as enum ('bank_transfer','card','cash','paypal','stripe','wise','instapay','vodafone_cash','other');
create type payment_status as enum ('pending','processing','completed','failed','refunded');
create type commission_trigger as enum ('deal_won','contract_signed','payment_collected','full_payment','milestone_payment');
create type commission_status as enum ('pending','eligible','approved','paid','cancelled');
create type cost_type as enum ('employee','freelancer','vendor','infrastructure','third_party','other');

-- ---------------------------------------------------------------------------
-- Shared SQL helpers used by lifecycle functions (events, audit, status)
-- ---------------------------------------------------------------------------

-- Writes one activity event + its links. Returns null when dedupe_key already
-- exists (the event was already recorded). The TypeScript dispatcher picks
-- up rows with processed_at is null for notifications/automations.
create or replace function public.bos_emit(
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_actor uuid,
  p_summary text,
  p_payload jsonb default '{}'::jsonb,
  p_links jsonb default '[]'::jsonb,
  p_actor_type text default 'user',
  p_visibility text default 'internal',
  p_dedupe_key text default null
)
returns bigint
language plpgsql
as $$
declare
  v_id bigint;
  v_link jsonb;
begin
  insert into activity_events (event_type, entity_type, entity_id, actor_user_id, actor_type, summary, payload, visibility, dedupe_key)
  values (p_event_type, p_entity_type, p_entity_id, p_actor,
          case when p_actor is null and p_actor_type = 'user' then 'system' else p_actor_type end,
          p_summary, coalesce(p_payload, '{}'::jsonb), p_visibility, p_dedupe_key)
  on conflict (dedupe_key) do nothing
  returning id into v_id;

  if v_id is null then
    return null;
  end if;

  insert into activity_event_links (event_id, entity_type, entity_id)
  values (v_id, p_entity_type, p_entity_id)
  on conflict do nothing;

  for v_link in select * from jsonb_array_elements(coalesce(p_links, '[]'::jsonb))
  loop
    if v_link->>'id' is not null then
      insert into activity_event_links (event_id, entity_type, entity_id)
      values (v_id, v_link->>'type', (v_link->>'id')::uuid)
      on conflict do nothing;
    end if;
  end loop;

  return v_id;
end;
$$;

create or replace function public.bos_audit(
  p_actor uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_old jsonb default null,
  p_new jsonb default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_type text default 'user'
)
returns void
language sql
as $$
  insert into audit_logs (actor_user_id, actor_type, action, entity_type, entity_id, old_value, new_value, reason, metadata)
  values (p_actor, case when p_actor is null and p_actor_type = 'user' then 'system' else p_actor_type end,
          p_action, p_entity_type, p_entity_id, p_old, p_new, p_reason, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.bos_status(
  p_entity_type text,
  p_entity_id uuid,
  p_from text,
  p_to text,
  p_by uuid,
  p_reason text default null
)
returns void
language sql
as $$
  insert into status_history (entity_type, entity_id, from_status, to_status, changed_by, reason)
  select p_entity_type, p_entity_id, p_from, p_to, p_by, p_reason
  where p_from is distinct from p_to;
$$;

create or replace function public.bos_round_money(p_amount numeric, p_currency char(3))
returns numeric
language sql
stable
as $$
  select round(p_amount, coalesce((select decimals from currencies where code = p_currency), 2));
$$;

-- Latest rate converting 1 unit of p_from into p_to on/before p_date.
-- Returns null when no rate is known (callers must handle it explicitly).
create or replace function public.bos_fx_rate(p_from char(3), p_to char(3), p_date date default current_date)
returns numeric
language sql
stable
as $$
  select case
    when p_from = p_to then 1::numeric
    else coalesce(
      (select rate from exchange_rates where base = p_from and quote = p_to and effective_date <= p_date
        order by effective_date desc limit 1),
      (select 1 / rate from exchange_rates where base = p_to and quote = p_from and effective_date <= p_date
        order by effective_date desc limit 1)
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

create table contracts (
  id uuid primary key default gen_random_uuid(),
  contract_number text not null unique default bos_next_number('contract'),
  title text not null,
  client_id uuid not null references clients(id) on delete restrict,
  deal_id uuid references deals(id) on delete restrict,
  project_id uuid,
  proposal_id uuid references proposals(id) on delete set null,
  value numeric(14,3) not null default 0 check (value >= 0),
  currency char(3) not null references currencies(code),
  start_date date,
  end_date date,
  payment_terms text,
  file_id uuid references files(id) on delete set null,
  status contract_status not null default 'draft',
  document_version integer not null default 1 check (document_version > 0),
  required_signers smallint not null default 1 check (required_signers > 0),
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  esign_provider text,
  esign_reference text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index contracts_client_idx on contracts (client_id);
create index contracts_deal_idx on contracts (deal_id);
create index contracts_status_idx on contracts (status);

create table contract_signatures (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  signer_name text not null,
  signer_email text,
  contact_id uuid references contacts(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  signed_at timestamptz not null default now(),
  ip inet,
  document_version integer not null,
  method text not null default 'manual' check (method in ('manual','click','esign')),
  provider_reference text,
  is_valid boolean not null default true,
  recorded_by uuid references auth.users(id) on delete set null
);
create index contract_signatures_contract_idx on contract_signatures (contract_id);

-- ---------------------------------------------------------------------------
-- Payment schedules, invoices, payments
-- ---------------------------------------------------------------------------

create table payment_schedules (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete restrict,
  project_id uuid,
  client_id uuid not null references clients(id) on delete restrict,
  label text not null,
  percent numeric(5,2) not null check (percent > 0 and percent <= 100),
  amount numeric(14,3) not null check (amount >= 0),
  currency char(3) not null references currencies(code),
  due_date date,
  trigger schedule_trigger not null default 'on_date',
  milestone_id uuid,
  status schedule_status not null default 'scheduled',
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (deal_id, sort_order)
);
create index payment_schedules_project_idx on payment_schedules (project_id);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default bos_next_number('invoice'),
  client_id uuid not null references clients(id) on delete restrict,
  project_id uuid,
  deal_id uuid references deals(id) on delete restrict,
  schedule_id uuid unique references payment_schedules(id) on delete restrict,
  currency char(3) not null references currencies(code),
  subtotal numeric(14,3) not null default 0 check (subtotal >= 0),
  discount_amount numeric(14,3) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(6,3) not null default 0 check (tax_rate between 0 and 100),
  tax_amount numeric(14,3) not null default 0,
  total numeric(14,3) not null default 0,
  amount_paid numeric(14,3) not null default 0 check (amount_paid >= 0),
  amount_refunded numeric(14,3) not null default 0 check (amount_refunded >= 0),
  balance numeric(14,3) generated always as (total - amount_paid + amount_refunded) stored,
  issue_date date not null default current_date,
  due_date date not null,
  status invoice_status not null default 'draft',
  payment_terms text,
  notes text,
  sent_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  overdue_notified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= issue_date),
  check (discount_amount <= subtotal)
);
create index invoices_client_idx on invoices (client_id);
create index invoices_project_idx on invoices (project_id);
create index invoices_deal_idx on invoices (deal_id);
create index invoices_status_due_idx on invoices (status, due_date);

alter table payment_schedules add column invoice_id uuid references invoices(id) on delete set null;

create table invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(14,3) not null default 0 check (unit_price >= 0),
  line_total numeric(14,3) generated always as (round(quantity * unit_price, 3)) stored,
  sort_order integer not null default 0
);
create index invoice_items_invoice_idx on invoice_items (invoice_id);

-- Totals: items → subtotal; row trigger → tax + total (rounded per currency).
create or replace function public.bos_invoice_compute_totals()
returns trigger
language plpgsql
as $$
begin
  new.tax_amount := bos_round_money((new.subtotal - new.discount_amount) * new.tax_rate / 100, new.currency);
  new.total := new.subtotal - new.discount_amount + new.tax_amount;
  return new;
end;
$$;

create trigger invoices_compute_totals before insert or update of subtotal, discount_amount, tax_rate, currency
on invoices for each row execute function bos_invoice_compute_totals();

create or replace function public.bos_invoice_items_changed()
returns trigger
language plpgsql
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
begin
  update invoices
     set subtotal = coalesce((select sum(line_total) from invoice_items where invoice_id = v_invoice), 0)
   where id = v_invoice;
  return null;
end;
$$;

create trigger invoice_items_recalc after insert or update or delete on invoice_items
for each row execute function bos_invoice_items_changed();

create table payments (
  id uuid primary key default gen_random_uuid(),
  payment_number text not null unique default bos_next_number('payment'),
  client_id uuid not null references clients(id) on delete restrict,
  invoice_id uuid references invoices(id) on delete restrict,
  deal_id uuid references deals(id) on delete restrict,
  project_id uuid,
  amount numeric(14,3) not null check (amount > 0),
  currency char(3) not null references currencies(code),
  exchange_rate numeric(18,8) check (exchange_rate is null or exchange_rate > 0),
  invoice_amount numeric(14,3),
  deal_amount numeric(14,3),
  method payment_method not null default 'bank_transfer',
  payment_date date not null default current_date,
  reference text,
  status payment_status not null default 'completed',
  refunded_amount numeric(14,3) not null default 0 check (refunded_amount >= 0),
  refund_reason text,
  notes text,
  idempotency_key text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_amount <= amount)
);
create index payments_client_idx on payments (client_id);
create index payments_invoice_idx on payments (invoice_id);
create index payments_deal_idx on payments (deal_id);
create index payments_date_idx on payments (payment_date);
create unique index payments_invoice_reference_idx on payments (invoice_id, reference) where reference is not null and invoice_id is not null;

-- ---------------------------------------------------------------------------
-- Commission engine
-- ---------------------------------------------------------------------------

create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  priority integer not null default 0,
  basis text not null default 'percentage' check (basis in ('percentage','fixed')),
  rate numeric(7,4) check (rate is null or rate between 0 and 100),
  fixed_amount numeric(14,3) check (fixed_amount is null or fixed_amount >= 0),
  currency char(3) references currencies(code),
  product_id uuid references products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role_id uuid references roles(id) on delete cascade,
  trigger commission_trigger not null default 'payment_collected',
  min_amount numeric(14,3) check (min_amount is null or min_amount >= 0),
  max_amount numeric(14,3) check (max_amount is null or max_amount >= 0),
  valid_from date,
  valid_to date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((basis = 'percentage' and rate is not null) or (basis = 'fixed' and fixed_amount is not null and currency is not null)),
  check (min_amount is null or max_amount is null or min_amount <= max_amount),
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

-- Seed a default company rule (editable in Settings → Commission): 10% on
-- collected payments for Business Development, matching the spec example.
insert into commission_rules (name, basis, rate, trigger, role_id, priority)
select 'Default BD commission (10% of collected)', 'percentage', 10, 'payment_collected', id, 0
from roles where key = 'business_development';

create table commissions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  rule_id uuid references commission_rules(id) on delete set null,
  base_amount numeric(14,3) not null default 0,
  currency char(3) not null references currencies(code),
  amount numeric(14,3) not null default 0,
  eligible_amount numeric(14,3) not null default 0,
  status commission_status not null default 'pending',
  eligible_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, user_id, rule_id)
);
create index commissions_user_idx on commissions (user_id, status);
create index commissions_status_idx on commissions (status);

-- Creates commission rows for the deal owner from the best-matching rule
-- (employee+product > employee > product > role > company-wide, then priority).
create or replace function public.bos_evaluate_commissions(p_deal_id uuid, p_actor uuid default null)
returns void
language plpgsql
as $$
declare
  v_deal deals%rowtype;
  v_rule commission_rules%rowtype;
  v_base numeric;
  v_amount numeric;
  v_currency char(3);
  v_commission_id uuid;
begin
  select * into v_deal from deals where id = p_deal_id;
  if v_deal.id is null or v_deal.assigned_to is null then
    return;
  end if;

  select r.* into v_rule
  from commission_rules r
  where r.is_active
    and (r.valid_from is null or r.valid_from <= current_date)
    and (r.valid_to is null or r.valid_to >= current_date)
    and (r.user_id is null or r.user_id = v_deal.assigned_to)
    and (r.role_id is null or exists (select 1 from user_roles ur where ur.user_id = v_deal.assigned_to and ur.role_id = r.role_id))
    and (r.product_id is null or exists (select 1 from deal_products dp where dp.deal_id = v_deal.id and dp.product_id = r.product_id))
  order by (case when r.user_id is not null then 4 else 0 end
          + case when r.product_id is not null then 2 else 0 end
          + case when r.role_id is not null then 1 else 0 end) desc,
           r.priority desc, r.created_at
  limit 1;

  if v_rule.id is null then
    return;
  end if;

  if v_rule.product_id is not null then
    v_base := coalesce((select sum(line_total) from deal_products where deal_id = v_deal.id and product_id = v_rule.product_id), 0);
  else
    v_base := v_deal.value;
  end if;

  if v_rule.basis = 'percentage' then
    v_currency := v_deal.currency;
    v_amount := bos_round_money(v_base * v_rule.rate / 100, v_currency);
  else
    v_currency := v_rule.currency;
    v_amount := v_rule.fixed_amount;
  end if;

  if v_rule.min_amount is not null then v_amount := greatest(v_amount, v_rule.min_amount); end if;
  if v_rule.max_amount is not null then v_amount := least(v_amount, v_rule.max_amount); end if;

  insert into commissions (deal_id, user_id, rule_id, base_amount, currency, amount)
  values (v_deal.id, v_deal.assigned_to, v_rule.id, v_base, v_currency, v_amount)
  on conflict (deal_id, user_id, rule_id) do update
    set base_amount = excluded.base_amount, amount = excluded.amount, currency = excluded.currency
    where commissions.status in ('pending','eligible')
  returning id into v_commission_id;

  if v_commission_id is not null then
    perform bos_emit('commission.created', 'commission', v_commission_id, p_actor,
      'Commission calculated: ' || v_amount || ' ' || v_currency,
      jsonb_build_object('deal_id', v_deal.id, 'user_id', v_deal.assigned_to, 'amount', v_amount, 'currency', v_currency, 'employee_user_id', v_deal.assigned_to),
      jsonb_build_array(jsonb_build_object('type','deal','id',v_deal.id)),
      'automation', 'internal', 'commission.created:' || v_commission_id);
  end if;

  perform bos_update_commission_eligibility(p_deal_id, p_actor);
end;
$$;

-- Moves commissions between pending/eligible according to each rule's
-- trigger and the deal's current commercial state. Approved/paid rows are
-- never changed automatically; a refund against them raises an event so
-- Finance can decide on an adjustment.
create or replace function public.bos_update_commission_eligibility(p_deal_id uuid, p_actor uuid default null)
returns void
language plpgsql
as $$
declare
  v_deal deals%rowtype;
  v_c record;
  v_collected numeric;
  v_ratio numeric;
  v_ok boolean;
  v_eligible numeric;
  v_milestone_paid numeric;
begin
  select * into v_deal from deals where id = p_deal_id;
  if v_deal.id is null then return; end if;

  v_collected := coalesce((
    select sum(coalesce(p.deal_amount, 0) * (p.amount - p.refunded_amount) / p.amount)
    from payments p where p.deal_id = p_deal_id and p.status in ('completed','refunded')
  ), 0);
  v_ratio := case when v_deal.value > 0 then least(1, v_collected / v_deal.value) else 0 end;

  v_milestone_paid := coalesce((
    select sum(ps.amount) from payment_schedules ps
    where ps.deal_id = p_deal_id and ps.trigger = 'on_milestone' and ps.status = 'paid'
  ), 0);

  for v_c in
    select c.*, r.trigger as rule_trigger
    from commissions c left join commission_rules r on r.id = c.rule_id
    where c.deal_id = p_deal_id and c.status in ('pending','eligible','approved','paid')
  loop
    if v_deal.lost_at is not null then
      if v_c.status in ('pending','eligible') then
        update commissions set status = 'cancelled', updated_at = now() where id = v_c.id;
        perform bos_status('commission', v_c.id, v_c.status::text, 'cancelled', p_actor, 'Deal lost');
      end if;
      continue;
    end if;

    v_ok := false;
    v_eligible := 0;
    case coalesce(v_c.rule_trigger, 'deal_won')
      when 'deal_won' then
        v_ok := v_deal.won_at is not null; v_eligible := v_c.amount;
      when 'contract_signed' then
        v_ok := exists (select 1 from contracts ct where ct.deal_id = p_deal_id and ct.status = 'signed'); v_eligible := v_c.amount;
      when 'payment_collected' then
        v_ok := v_collected > 0; v_eligible := bos_round_money(v_c.amount * v_ratio, v_c.currency);
      when 'full_payment' then
        v_ok := v_deal.payment_status = 'paid'; v_eligible := v_c.amount;
      when 'milestone_payment' then
        v_ok := v_milestone_paid > 0;
        v_eligible := case when v_deal.value > 0 then bos_round_money(v_c.amount * least(1, v_milestone_paid / v_deal.value), v_c.currency) else 0 end;
    end case;

    if v_c.status in ('approved','paid') then
      if v_eligible < v_c.eligible_amount then
        perform bos_emit('commission.adjustment_required', 'commission', v_c.id, p_actor,
          'Commission already ' || v_c.status || ' but eligible amount dropped to ' || v_eligible,
          jsonb_build_object('deal_id', p_deal_id, 'previous', v_c.eligible_amount, 'current', v_eligible),
          jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id)), 'system', 'internal',
          'commission.adjustment_required:' || v_c.id || ':' || v_eligible);
      end if;
      continue;
    end if;

    if v_ok and v_eligible > 0 then
      update commissions
         set status = 'eligible', eligible_amount = v_eligible,
             eligible_at = coalesce(eligible_at, now()), updated_at = now()
       where id = v_c.id and (status <> 'eligible' or eligible_amount <> v_eligible);
      if v_c.status = 'pending' then
        perform bos_status('commission', v_c.id, 'pending', 'eligible', p_actor, 'Trigger satisfied: ' || coalesce(v_c.rule_trigger::text, 'deal_won'));
        perform bos_emit('commission.eligible', 'commission', v_c.id, p_actor,
          'Commission eligible: ' || v_eligible || ' ' || v_c.currency,
          jsonb_build_object('deal_id', p_deal_id, 'amount', v_eligible, 'currency', v_c.currency, 'employee_user_id', v_c.user_id),
          jsonb_build_array(jsonb_build_object('type','deal','id',p_deal_id)), 'automation', 'internal',
          'commission.eligible:' || v_c.id);
      end if;
    elsif v_c.status = 'eligible' then
      update commissions set status = 'pending', eligible_amount = 0, updated_at = now() where id = v_c.id;
      perform bos_status('commission', v_c.id, 'eligible', 'pending', p_actor, 'Trigger no longer satisfied');
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment effects (atomic)
-- ---------------------------------------------------------------------------

create or replace function public.bos_recalc_invoice(p_invoice_id uuid, p_actor uuid default null)
returns void
language plpgsql
as $$
declare
  v_inv invoices%rowtype;
  v_paid numeric;
  v_refunded numeric;
  v_new invoice_status;
begin
  select * into v_inv from invoices where id = p_invoice_id for update;
  if v_inv.id is null then return; end if;

  select coalesce(sum(invoice_amount), 0),
         coalesce(sum(invoice_amount * refunded_amount / amount), 0)
    into v_paid, v_refunded
    from payments
   where invoice_id = p_invoice_id and status in ('completed','refunded');

  v_refunded := bos_round_money(v_refunded, v_inv.currency);

  if v_inv.status = 'cancelled' then
    v_new := 'cancelled';
  elsif v_inv.total > 0 and v_paid - v_refunded >= v_inv.total then
    v_new := 'paid';
  elsif v_paid - v_refunded > 0 then
    v_new := case when v_inv.due_date < current_date then 'overdue' else 'partially_paid' end;
  elsif v_inv.status in ('paid','partially_paid') then
    v_new := case when v_inv.due_date < current_date then 'overdue' else 'sent' end;
  else
    v_new := v_inv.status;
  end if;

  update invoices
     set amount_paid = v_paid,
         amount_refunded = v_refunded,
         status = v_new,
         paid_at = case when v_new = 'paid' then coalesce(paid_at, now()) else null end,
         updated_at = now()
   where id = p_invoice_id;

  if v_new is distinct from v_inv.status then
    perform bos_status('invoice', p_invoice_id, v_inv.status::text, v_new::text, p_actor, 'Payment update');
    if v_new = 'paid' then
      perform bos_emit('invoice.paid', 'invoice', p_invoice_id, p_actor, 'Invoice ' || v_inv.invoice_number || ' paid',
        jsonb_build_object('invoice_id', p_invoice_id, 'client_id', v_inv.client_id, 'deal_id', v_inv.deal_id, 'project_id', v_inv.project_id, 'total', v_inv.total, 'currency', v_inv.currency),
        jsonb_build_array(jsonb_build_object('type','client','id',v_inv.client_id), jsonb_build_object('type','deal','id',v_inv.deal_id), jsonb_build_object('type','project','id',v_inv.project_id)),
        'system');
    end if;
  end if;

  if v_inv.schedule_id is not null then
    update payment_schedules
       set status = case when v_new = 'paid' then 'paid'::schedule_status
                         when v_new = 'cancelled' then 'scheduled'::schedule_status
                         else 'invoiced'::schedule_status end
     where id = v_inv.schedule_id and status <> 'cancelled';
  end if;
end;
$$;

create or replace function public.bos_recalc_deal_payments(p_deal_id uuid, p_actor uuid default null)
returns void
language plpgsql
as $$
declare
  v_deal deals%rowtype;
  v_collected numeric;
  v_new deal_payment_status;
begin
  select * into v_deal from deals where id = p_deal_id for update;
  if v_deal.id is null then return; end if;

  v_collected := coalesce((
    select sum(coalesce(deal_amount, 0) * (amount - refunded_amount) / amount)
    from payments where deal_id = p_deal_id and status in ('completed','refunded')
  ), 0);

  v_new := case
    when v_deal.value > 0 and v_collected >= v_deal.value then 'paid'
    when v_collected > 0 then 'partially_paid'
    else 'unpaid' end;

  if v_new is distinct from v_deal.payment_status then
    update deals set payment_status = v_new where id = p_deal_id;
    perform bos_audit(p_actor, 'deal.payment_status_changed', 'deal', p_deal_id,
      jsonb_build_object('payment_status', v_deal.payment_status), jsonb_build_object('payment_status', v_new),
      null, jsonb_build_object('collected', v_collected), 'system');
  end if;

  perform bos_update_commission_eligibility(p_deal_id, p_actor);
end;
$$;

-- Records a payment. Idempotent on p->>'idempotency_key'.
create or replace function public.bos_record_payment(p jsonb, p_actor uuid)
returns uuid
language plpgsql
as $$
declare
  v_existing uuid;
  v_inv invoices%rowtype;
  v_deal deals%rowtype;
  v_amount numeric := (p->>'amount')::numeric;
  v_currency char(3) := upper(p->>'currency');
  v_rate numeric := nullif(p->>'exchange_rate', '')::numeric;
  v_invoice_amount numeric;
  v_deal_amount numeric;
  v_status payment_status := coalesce(nullif(p->>'status', ''), 'completed')::payment_status;
  v_allow_over boolean := coalesce((select (value->>'allow_overpayment')::boolean from bos_settings where key = 'finance'), false);
  v_client uuid := (p->>'client_id')::uuid;
  v_id uuid;
  v_project uuid := nullif(p->>'project_id', '')::uuid;
begin
  if nullif(p->>'idempotency_key', '') is not null then
    select id into v_existing from payments where idempotency_key = p->>'idempotency_key';
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Payment amount must be greater than zero' using errcode = '22023';
  end if;

  if nullif(p->>'invoice_id', '') is not null then
    select * into v_inv from invoices where id = (p->>'invoice_id')::uuid for update;
    if v_inv.id is null then
      raise exception 'Invoice not found' using errcode = 'P0002';
    end if;
    if v_inv.status = 'cancelled' then
      raise exception 'Cannot record a payment against a cancelled invoice' using errcode = '22023';
    end if;
    if v_client is null then v_client := v_inv.client_id; end if;
    if v_inv.client_id <> v_client then
      raise exception 'Invoice belongs to a different client' using errcode = '22023';
    end if;

    if v_currency = v_inv.currency then
      v_invoice_amount := v_amount;
    else
      if v_rate is null then
        v_rate := bos_fx_rate(v_currency, v_inv.currency, coalesce((p->>'payment_date')::date, current_date));
      end if;
      if v_rate is null then
        raise exception 'An exchange rate from % to % is required', v_currency, v_inv.currency using errcode = '22023';
      end if;
      v_invoice_amount := bos_round_money(v_amount * v_rate, v_inv.currency);
    end if;

    if not v_allow_over and v_status in ('completed','processing','pending') and v_invoice_amount > v_inv.balance then
      raise exception 'Payment exceeds the invoice outstanding balance (%)', v_inv.balance using errcode = '22023';
    end if;

    if v_inv.status = 'draft' then
      update invoices set status = 'sent', sent_at = coalesce(sent_at, now()) where id = v_inv.id;
      perform bos_status('invoice', v_inv.id, 'draft', 'sent', p_actor, 'Payment recorded');
    end if;
    v_project := coalesce(v_project, v_inv.project_id);
  end if;

  if coalesce(nullif(p->>'deal_id', '')::uuid, v_inv.deal_id) is not null then
    select * into v_deal from deals where id = coalesce(nullif(p->>'deal_id', '')::uuid, v_inv.deal_id);
    if v_deal.currency = v_currency then
      v_deal_amount := v_amount;
    elsif v_inv.id is not null and v_inv.currency = v_deal.currency then
      v_deal_amount := v_invoice_amount;
    else
      v_deal_amount := bos_round_money(v_amount * coalesce(bos_fx_rate(v_currency, v_deal.currency, coalesce((p->>'payment_date')::date, current_date)), 0), v_deal.currency);
    end if;
  end if;

  insert into payments (client_id, invoice_id, deal_id, project_id, amount, currency, exchange_rate, invoice_amount, deal_amount,
                        method, payment_date, reference, status, notes, idempotency_key, created_by)
  values (v_client, v_inv.id, v_deal.id, v_project, v_amount, v_currency, v_rate, v_invoice_amount, v_deal_amount,
          coalesce(nullif(p->>'method', ''), 'bank_transfer')::payment_method,
          coalesce((p->>'payment_date')::date, current_date), nullif(p->>'reference', ''), v_status,
          nullif(p->>'notes', ''), nullif(p->>'idempotency_key', ''), p_actor)
  returning id into v_id;

  perform bos_status('payment', v_id, null, v_status::text, p_actor, null);
  perform bos_audit(p_actor, 'payment.created', 'payment', v_id, null,
    jsonb_build_object('amount', v_amount, 'currency', v_currency, 'invoice_id', v_inv.id, 'status', v_status, 'reference', p->>'reference'));
  perform bos_emit('payment.created', 'payment', v_id, p_actor,
    'Payment of ' || v_amount || ' ' || v_currency || ' recorded',
    jsonb_build_object('amount', v_amount, 'currency', v_currency, 'invoice_id', v_inv.id, 'deal_id', v_deal.id, 'project_id', v_project, 'client_id', v_client),
    jsonb_build_array(jsonb_build_object('type','client','id',v_client), jsonb_build_object('type','invoice','id',v_inv.id),
                      jsonb_build_object('type','deal','id',v_deal.id), jsonb_build_object('type','project','id',v_project)));

  if v_status = 'completed' then
    perform bos_apply_payment_completed(v_id, p_actor);
  end if;

  return v_id;
end;
$$;

create or replace function public.bos_apply_payment_completed(p_payment_id uuid, p_actor uuid)
returns void
language plpgsql
as $$
declare
  v_pay payments%rowtype;
begin
  select * into v_pay from payments where id = p_payment_id;
  if v_pay.invoice_id is not null then
    perform bos_recalc_invoice(v_pay.invoice_id, p_actor);
  end if;
  if v_pay.deal_id is not null then
    perform bos_recalc_deal_payments(v_pay.deal_id, p_actor);
  end if;

  perform bos_emit('payment.completed', 'payment', v_pay.id, p_actor,
    'Payment received: ' || v_pay.amount || ' ' || v_pay.currency,
    jsonb_build_object('amount', v_pay.amount, 'currency', v_pay.currency, 'invoice_id', v_pay.invoice_id, 'deal_id', v_pay.deal_id,
                       'project_id', v_pay.project_id, 'client_id', v_pay.client_id),
    jsonb_build_array(jsonb_build_object('type','client','id',v_pay.client_id), jsonb_build_object('type','invoice','id',v_pay.invoice_id),
                      jsonb_build_object('type','deal','id',v_pay.deal_id), jsonb_build_object('type','project','id',v_pay.project_id)),
    'user', 'client', 'payment.completed:' || v_pay.id);
end;
$$;

create or replace function public.bos_set_payment_status(p_payment_id uuid, p_status payment_status, p_actor uuid, p_reason text default null)
returns void
language plpgsql
as $$
declare
  v_pay payments%rowtype;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if v_pay.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  if not (
    (v_pay.status = 'pending' and p_status in ('processing','completed','failed')) or
    (v_pay.status = 'processing' and p_status in ('completed','failed'))
  ) then
    raise exception 'Invalid payment status transition % → %', v_pay.status, p_status using errcode = '22023';
  end if;

  update payments set status = p_status, updated_at = now() where id = p_payment_id;
  perform bos_status('payment', p_payment_id, v_pay.status::text, p_status::text, p_actor, p_reason);
  perform bos_audit(p_actor, 'payment.status_changed', 'payment', p_payment_id,
    jsonb_build_object('status', v_pay.status), jsonb_build_object('status', p_status), p_reason);

  if p_status = 'completed' then
    perform bos_apply_payment_completed(p_payment_id, p_actor);
  elsif p_status = 'failed' then
    perform bos_emit('payment.failed', 'payment', p_payment_id, p_actor, 'Payment failed',
      jsonb_build_object('amount', v_pay.amount, 'currency', v_pay.currency, 'invoice_id', v_pay.invoice_id, 'deal_id', v_pay.deal_id),
      jsonb_build_array(jsonb_build_object('type','client','id',v_pay.client_id), jsonb_build_object('type','invoice','id',v_pay.invoice_id)));
  end if;
end;
$$;

create or replace function public.bos_refund_payment(p_payment_id uuid, p_amount numeric, p_reason text, p_actor uuid)
returns void
language plpgsql
as $$
declare
  v_pay payments%rowtype;
  v_new_refunded numeric;
begin
  select * into v_pay from payments where id = p_payment_id for update;
  if v_pay.id is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_pay.status not in ('completed','refunded') then
    raise exception 'Only completed payments can be refunded' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Refund amount must be greater than zero' using errcode = '22023';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A refund reason is required' using errcode = '22023';
  end if;

  v_new_refunded := v_pay.refunded_amount + p_amount;
  if v_new_refunded > v_pay.amount then
    raise exception 'Refund exceeds the payment amount' using errcode = '22023';
  end if;

  update payments
     set refunded_amount = v_new_refunded,
         refund_reason = p_reason,
         status = case when v_new_refunded = amount then 'refunded'::payment_status else status end,
         updated_at = now()
   where id = p_payment_id;

  if v_new_refunded = v_pay.amount then
    perform bos_status('payment', p_payment_id, v_pay.status::text, 'refunded', p_actor, p_reason);
  end if;
  perform bos_audit(p_actor, 'payment.refunded', 'payment', p_payment_id,
    jsonb_build_object('refunded_amount', v_pay.refunded_amount), jsonb_build_object('refunded_amount', v_new_refunded), p_reason);

  if v_pay.invoice_id is not null then perform bos_recalc_invoice(v_pay.invoice_id, p_actor); end if;
  if v_pay.deal_id is not null then perform bos_recalc_deal_payments(v_pay.deal_id, p_actor); end if;

  perform bos_emit('payment.refunded', 'payment', p_payment_id, p_actor,
    'Refund of ' || p_amount || ' ' || v_pay.currency,
    jsonb_build_object('amount', p_amount, 'currency', v_pay.currency, 'reason', p_reason, 'deal_id', v_pay.deal_id),
    jsonb_build_array(jsonb_build_object('type','client','id',v_pay.client_id), jsonb_build_object('type','invoice','id',v_pay.invoice_id),
                      jsonb_build_object('type','deal','id',v_pay.deal_id)));
end;
$$;

-- Overdue sweep: sent/partially paid invoices past due → overdue (once).
create or replace function public.bos_mark_overdue_invoices()
returns integer
language plpgsql
as $$
declare
  v_inv record;
  v_count integer := 0;
begin
  for v_inv in
    select * from invoices
    where status in ('sent','partially_paid') and due_date < current_date and balance > 0
    for update skip locked
  loop
    update invoices set status = 'overdue', overdue_notified_at = now() where id = v_inv.id;
    perform bos_status('invoice', v_inv.id, v_inv.status::text, 'overdue', null, 'Past due date');
    perform bos_emit('invoice.overdue', 'invoice', v_inv.id, null,
      'Invoice ' || v_inv.invoice_number || ' is overdue (' || v_inv.balance || ' ' || v_inv.currency || ')',
      jsonb_build_object('invoice_id', v_inv.id, 'client_id', v_inv.client_id, 'deal_id', v_inv.deal_id, 'balance', v_inv.balance, 'currency', v_inv.currency, 'due_date', v_inv.due_date),
      jsonb_build_array(jsonb_build_object('type','client','id',v_inv.client_id), jsonb_build_object('type','deal','id',v_inv.deal_id), jsonb_build_object('type','project','id',v_inv.project_id)),
      'system', 'internal', 'invoice.overdue:' || v_inv.id || ':' || v_inv.due_date);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Vendors, expenses
-- ---------------------------------------------------------------------------

create table vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  contact_name text,
  email text,
  phone text,
  services text,
  notes text,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index vendors_name_idx on vendors (lower(name)) where archived_at is null;

create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  cost_type cost_type not null default 'other',
  is_active boolean not null default true
);

insert into expense_categories (name, cost_type) values
  ('Hosting', 'infrastructure'), ('APIs', 'third_party'), ('Freelancers', 'freelancer'),
  ('Software', 'third_party'), ('Advertising', 'other'), ('Travel', 'other'), ('Operations', 'other'),
  ('Vendor services', 'vendor');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references expense_categories(id) on delete restrict,
  description text not null,
  amount numeric(14,3) not null check (amount > 0),
  currency char(3) not null references currencies(code),
  expense_date date not null default current_date,
  vendor_id uuid references vendors(id) on delete set null,
  project_id uuid,
  client_id uuid references clients(id) on delete set null,
  employee_user_id uuid references auth.users(id) on delete set null,
  receipt_file_id uuid references files(id) on delete set null,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index expenses_project_idx on expenses (project_id);
create index expenses_date_idx on expenses (expense_date);
create index expenses_vendor_idx on expenses (vendor_id);

-- ---------------------------------------------------------------------------
-- Triggers, RLS, grants
-- ---------------------------------------------------------------------------

create trigger contracts_touch before update on contracts for each row execute function bos_touch_updated_at();
create trigger invoices_touch before update on invoices for each row execute function bos_touch_updated_at();
create trigger payments_touch before update on payments for each row execute function bos_touch_updated_at();
create trigger commission_rules_touch before update on commission_rules for each row execute function bos_touch_updated_at();
create trigger commissions_touch before update on commissions for each row execute function bos_touch_updated_at();
create trigger vendors_touch before update on vendors for each row execute function bos_touch_updated_at();
create trigger expenses_touch before update on expenses for each row execute function bos_touch_updated_at();

alter table contracts enable row level security;
alter table contract_signatures enable row level security;
alter table payment_schedules enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table commission_rules enable row level security;
alter table commissions enable row level security;
alter table vendors enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke execute on function
  public.bos_emit(text, text, uuid, uuid, text, jsonb, jsonb, text, text, text),
  public.bos_audit(uuid, text, text, uuid, jsonb, jsonb, text, jsonb, text),
  public.bos_status(text, uuid, text, text, uuid, text),
  public.bos_evaluate_commissions(uuid, uuid),
  public.bos_update_commission_eligibility(uuid, uuid),
  public.bos_recalc_invoice(uuid, uuid),
  public.bos_recalc_deal_payments(uuid, uuid),
  public.bos_record_payment(jsonb, uuid),
  public.bos_apply_payment_completed(uuid, uuid),
  public.bos_set_payment_status(uuid, payment_status, uuid, text),
  public.bos_refund_payment(uuid, numeric, text, uuid),
  public.bos_mark_overdue_invoices()
from public, anon, authenticated;
