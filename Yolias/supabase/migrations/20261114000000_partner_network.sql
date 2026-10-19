-- Partner network on /affiliates (owner brief 2026-10-19): "شبكة شركائنا
-- المعتمدين". A partner chooses to be listed (off by default), with a role and
-- a country. Name and photo come from the partner's profile; the partnership
-- level and success rate are computed by the server from real referrals and
-- confirmed payments. Read by the server only (service role).

alter table public.affiliates
  add column if not exists listed boolean not null default false,
  add column if not exists partner_role text check (partner_role is null or partner_role in ('influencer', 'creator', 'entrepreneur', 'agency', 'consultant', 'educator', 'community')),
  add column if not exists country text check (country is null or country ~ '^[A-Z]{2}$');

create index if not exists affiliates_listed_idx on public.affiliates (listed) where listed;

-- One row per listed, approved partner with its counts (service role only).
create or replace view public.partner_directory_v with (security_invoker = true) as
select a.id, a.user_id, a.partner_role, a.country, a.created_at,
       p.full_name, p.avatar_url,
       (select count(*) from public.affiliate_referrals r where r.affiliate_id = a.id and r.status = 'active') as referrals,
       (select count(distinct c.referral_id) from public.affiliate_commissions c
         where c.affiliate_id = a.id and c.kind = 'payment' and c.status not in ('reversed', 'rejected') and c.referral_id is not null) as paying
from public.affiliates a
left join public.profiles p on p.id = a.user_id
where a.listed and a.status = 'approved';

revoke all on public.partner_directory_v from anon, authenticated;
grant select on public.partner_directory_v to service_role;
