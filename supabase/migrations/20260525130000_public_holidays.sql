create table if not exists public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  country_code text not null default 'PT',
  region text,
  created_at timestamptz not null default now()
);

create unique index if not exists public_holidays_country_region_date_unique
  on public.public_holidays(country_code, region, holiday_date);

create index if not exists public_holidays_date_idx
  on public.public_holidays(holiday_date);

create index if not exists public_holidays_country_idx
  on public.public_holidays(country_code);
