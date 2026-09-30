-- Fix: 'order by 2' referenced a column not in the sub-select list (runtime error).
create or replace function public.bos_report_revenue(f jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_from date := bos_filter_from(f);
  v_to date := bos_filter_to(f);
  v_client uuid := nullif(f->>'client_id', '')::uuid;
  v_project uuid := nullif(f->>'project_id', '')::uuid;
  r jsonb;
begin
  with inv as (
    select i.* from invoices i
    where i.status <> 'cancelled'
      and (v_client is null or i.client_id = v_client)
      and (v_project is null or i.project_id = v_project)
  ), pay as (
    select p.* from payments p
    where p.status in ('completed','refunded')
      and (v_client is null or p.client_id = v_client)
      and (v_project is null or p.project_id = v_project)
  )
  select jsonb_build_object(
    'from', v_from, 'to', v_to, 'base_currency', bos_base_currency(),
    'revenue', (select coalesce(sum(bos_to_base(total, currency, issue_date)), 0) from inv where status <> 'draft' and issue_date between v_from and v_to),
    'collected', (select coalesce(sum(bos_to_base(amount - refunded_amount, currency, payment_date)), 0) from pay where payment_date between v_from and v_to),
    'outstanding', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue')),
    'overdue', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and due_date < current_date),
    'by_currency', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'invoiced', invoiced, 'outstanding', outstanding)) from (
        select currency, sum(total) filter (where issue_date between v_from and v_to and status <> 'draft') invoiced,
               sum(balance) filter (where status in ('sent','partially_paid','overdue')) outstanding
        from inv group by currency) c), '[]'::jsonb),
    'aging', jsonb_build_object(
        'd0_30', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 1 and 30),
        'd31_60', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 31 and 60),
        'd61_90', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date between 61 and 90),
        'd90_plus', (select coalesce(sum(bos_to_base(balance, currency, issue_date)), 0) from inv where status in ('sent','partially_paid','overdue') and current_date - due_date > 90)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'invoiced', (select coalesce(sum(bos_to_base(total, currency, issue_date)), 0) from inv where status <> 'draft' and date_trunc('month', issue_date) = m),
        'collected', (select coalesce(sum(bos_to_base(amount - refunded_amount, currency, payment_date)), 0) from pay where date_trunc('month', payment_date) = m),
        'expenses', (select coalesce(sum(bos_to_base(amount, currency, expense_date)), 0) from expenses e where e.approval_status = 'approved' and date_trunc('month', e.expense_date) = m)) order by m)
      from generate_series(date_trunc('month', v_to::timestamp) - interval '11 months', date_trunc('month', v_to::timestamp), interval '1 month') m), '[]'::jsonb),
    'by_client', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('client_id', c.id, 'client', c.name,
               'collected', coalesce(sum(bos_to_base(p.amount - p.refunded_amount, p.currency, p.payment_date)), 0)) x
        from pay p join clients c on c.id = p.client_id
        where p.payment_date between v_from and v_to
        group by c.id, c.name order by coalesce(sum(bos_to_base(p.amount - p.refunded_amount, p.currency, p.payment_date)), 0) desc limit 20) s), '[]'::jsonb),
    'expenses', (select coalesce(sum(bos_to_base(amount, currency, expense_date)), 0) from expenses where approval_status = 'approved' and expense_date between v_from and v_to),
    'expenses_by_category', coalesce((select jsonb_agg(jsonb_build_object('category', ec.name, 'amount', t.amount)) from (
        select category_id, sum(bos_to_base(amount, currency, expense_date)) amount from expenses
        where approval_status = 'approved' and expense_date between v_from and v_to group by category_id) t
        join expense_categories ec on ec.id = t.category_id), '[]'::jsonb),
    'commissions', jsonb_build_object(
        'pending', (select coalesce(sum(bos_to_base(amount, currency)), 0) from commissions where status = 'pending'),
        'eligible', (select coalesce(sum(bos_to_base(eligible_amount, currency)), 0) from commissions where status = 'eligible'),
        'approved', (select coalesce(sum(bos_to_base(eligible_amount, currency)), 0) from commissions where status = 'approved'),
        'paid', (select coalesce(sum(bos_to_base(eligible_amount, currency, paid_at::date)), 0) from commissions where status = 'paid' and paid_at::date between v_from and v_to))
  ) into r;
  return r;
end;
$$;
