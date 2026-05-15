create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  room text,
  notes text,
  is_diabetic boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patients enable row level security;

create index if not exists patients_location_id_idx
  on public.patients(location_id);

create index if not exists patients_active_idx
  on public.patients(active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists patients_set_updated_at on public.patients;

create trigger patients_set_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

drop policy if exists "Authenticated users can read patients" on public.patients;
create policy "Authenticated users can read patients"
on public.patients
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can insert patients" on public.patients;
create policy "Authenticated users can insert patients"
on public.patients
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated users can update patients" on public.patients;
create policy "Authenticated users can update patients"
on public.patients
for update
to authenticated
using (true)
with check (true);
