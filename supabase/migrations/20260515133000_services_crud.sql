create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  duration_minutes integer not null default 30,
  color text not null default '#0f766e',
  measurement_type text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services
  add column if not exists organization_id uuid;

alter table public.services
  add column if not exists name text;

alter table public.services
  add column if not exists duration_minutes integer not null default 30;

alter table public.services
  add column if not exists color text not null default '#0f766e';

alter table public.services
  add column if not exists measurement_type text;

alter table public.services
  add column if not exists active boolean not null default true;

alter table public.services
  add column if not exists created_at timestamptz not null default now();

alter table public.services
  add column if not exists updated_at timestamptz not null default now();

do $services_constraints$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.services'::regclass
        and conname = 'services_organization_id_fkey'
    )
  then
    alter table public.services
      add constraint services_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_duration_minutes_check'
  )
  then
    alter table public.services
      add constraint services_duration_minutes_check
      check (duration_minutes > 0 and duration_minutes <= 480);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.services'::regclass
      and conname = 'services_measurement_type_check'
  )
  then
    alter table public.services
      add constraint services_measurement_type_check
      check (
        measurement_type is null
        or measurement_type in ('blood_pressure', 'glucose')
      );
  end if;
end;
$services_constraints$;

update public.services
set organization_id = public.my_organization_id()
where organization_id is null
  and public.my_organization_id() is not null;

do $services_not_nulls$
begin
  if not exists (
    select 1
    from public.services
    where organization_id is null
  )
  then
    alter table public.services
      alter column organization_id set not null;
  end if;

  if not exists (
    select 1
    from public.services
    where name is null
  )
  then
    alter table public.services
      alter column name set not null;
  end if;
end;
$services_not_nulls$;

alter table public.services enable row level security;

create index if not exists services_organization_id_idx
  on public.services(organization_id);

create index if not exists services_active_idx
  on public.services(active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$set_updated_at$;

drop trigger if exists services_set_updated_at on public.services;

create trigger services_set_updated_at
  before update on public.services
  for each row
  execute function public.set_updated_at();

drop policy if exists "Organization members can read services" on public.services;
create policy "Organization members can read services"
on public.services
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert services" on public.services;
create policy "Organization members can insert services"
on public.services
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update services" on public.services;
create policy "Organization members can update services"
on public.services
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());

create or replace function public.create_service(
  p_name text,
  p_duration_minutes integer default 30,
  p_color text default '#0f766e',
  p_measurement_type text default null,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $create_service$
declare
  current_organization_id uuid;
  created_service_id uuid;
  normalized_name text;
  normalized_color text;
  normalized_measurement_type text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();

  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  normalized_name := nullif(trim(p_name), '');
  normalized_color := coalesce(nullif(trim(p_color), ''), '#0f766e');
  normalized_measurement_type := nullif(trim(p_measurement_type), '');

  if normalized_name is null then
    raise exception 'Service name is required';
  end if;

  if p_duration_minutes is null
    or p_duration_minutes <= 0
    or p_duration_minutes > 480
  then
    raise exception 'Invalid duration';
  end if;

  if normalized_measurement_type is not null
    and normalized_measurement_type not in ('blood_pressure', 'glucose')
  then
    raise exception 'Invalid measurement type';
  end if;

  insert into public.services (
    organization_id,
    name,
    duration_minutes,
    color,
    measurement_type,
    active
  )
  values (
    current_organization_id,
    normalized_name,
    p_duration_minutes,
    normalized_color,
    normalized_measurement_type,
    coalesce(p_active, true)
  )
  returning id into created_service_id;

  return created_service_id;
end;
$create_service$;

grant execute on function public.create_service(text, integer, text, text, boolean)
to authenticated;
