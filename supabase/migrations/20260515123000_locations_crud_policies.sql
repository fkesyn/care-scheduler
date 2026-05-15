create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.locations enable row level security;

create index if not exists locations_active_idx
  on public.locations(active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_set_updated_at on public.locations;

create trigger locations_set_updated_at
before update on public.locations
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read locations" on public.locations;
create policy "Authenticated users can read locations"
on public.locations
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert locations" on public.locations;
create policy "Authenticated users can insert locations"
on public.locations
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update locations" on public.locations;
create policy "Authenticated users can update locations"
on public.locations
for update
to authenticated
using (true)
with check (true);
