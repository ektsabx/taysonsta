-- The support widget shown on the Yolias website (owner request): one widget
-- can be marked; Admin copies its key to the Yolias database and Yolias
-- serves it from its own domain, so the Admin domain never appears there.
alter table public.support_widgets add column on_yolias boolean not null default false;
create unique index support_widgets_on_yolias_uq on public.support_widgets (on_yolias) where on_yolias;
