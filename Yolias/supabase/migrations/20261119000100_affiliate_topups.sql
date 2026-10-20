-- Affiliate commission on Pay As You Go top-ups (owner 2026-10-20, D-247):
-- a referred customer's top-ups earn the commission rate during the first
-- 12 months after their first commissioned payment (recurring.pack_months),
-- like the 12 payments of a monthly plan. Subscription renewals are counted
-- on subscription payments only, so top-ups never use up the 12 payments.

create or replace function public.affiliate_record_payment(p_payment uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cfg jsonb; v_version bigint; p public.payments; r public.affiliate_referrals; v_aff public.affiliates;
  v_base bigint; v_amount bigint; v_seq int; v_max int; v_rule jsonb; v_hold int; v_flags text[] := '{}';
  v_email text; v_id uuid; v_type text; v_first timestamptz; v_months int; v_sub_seq int;
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
  select count(*) + 1, min(created_at) into v_seq, v_first from public.affiliate_commissions where referral_id = r.id and kind = 'payment' and status <> 'rejected';
  if p.kind = 'prospect_pack' then
    -- Pay As You Go top-ups (D-247): every top-up earns a commission during the
    -- first N months (recurring.pack_months, default 12) after the customer's
    -- first commissioned payment, like the monthly plans' 12 payments.
    v_months := greatest(1, least(120, coalesce(nullif(v_cfg->'recurring'->>'pack_months', '')::int, 12)));
    if v_first is not null and coalesce(p.paid_at, now()) > v_first + make_interval(months => v_months) then
      perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, jsonb_build_object('why', 'pack_window_over', 'months', v_months)); return null;
    end if;
  elsif v_seq > 1 then
    -- Subscription renewals: counted on subscription payments only.
    select count(*) + 1 into v_sub_seq from public.affiliate_commissions where referral_id = r.id and kind = 'payment' and status <> 'rejected' and coalesce(payment_kind, 'subscription') = 'subscription';
    if v_sub_seq > 1 and not coalesce((v_cfg->'recurring'->>'enabled')::boolean, false) then
      perform public.affiliate_log(v_aff.id, 'system', 'commission.skipped', 'payment', p.id::text, null, '{"why":"not_recurring"}'); return null;
    end if;
    v_max := nullif(v_cfg->'recurring'->>'max_payments', '')::int;
    if v_max is not null and v_sub_seq > v_max then
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

-- New program version: top-ups eligible, 12 months (history kept).
insert into public.affiliate_program_versions (settings, terms_version, terms_text, note, created_by)
select jsonb_set(jsonb_set(settings, '{eligible,packs}', 'true'::jsonb), '{recurring,pack_months}', '12'::jsonb),
       terms_version, terms_text, 'Top-ups earn commission for 12 months (D-247)', 'D-247'
from public.affiliate_program_versions order by id desc limit 1;
