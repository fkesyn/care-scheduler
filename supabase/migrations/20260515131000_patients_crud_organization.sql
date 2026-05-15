alter table public.patients
add column if not exists organization_id uuid;

do $$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'patients_organization_id_fkey'
    )
  then
    alter table public.patients
    add constraint patients_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade;
  end if;
end;
$$;

update public.patients patient
set organization_id = location.organization_id
from public.locations location
where patient.location_id = location.id
  and patient.organization_id is null;

update public.patients
set organization_id = public.my_organization_id()
where organization_id is null
  and public.my_organization_id() is not null;

do $$
begin
  if not exists (
    select 1
    from public.patients
    where organization_id is null
  )
  then
    alter table public.patients
    alter column organization_id set not null;
  end if;
end;
$$;

create index if not exists patients_organization_id_idx
  on public.patients(organization_id);

drop policy if exists "Authenticated users can read patients" on public.patients;
drop policy if exists "Authenticated users can insert patients" on public.patients;
drop policy if exists "Authenticated users can update patients" on public.patients;

drop policy if exists "Organization members can read patients" on public.patients;
create policy "Organization members can read patients"
on public.patients
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert patients" on public.patients;
create policy "Organization members can insert patients"
on public.patients
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update patients" on public.patients;
create policy "Organization members can update patients"
on public.patients
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());

create or replace function public.create_patient(
  p_name text,
  p_location_id uuid,
  p_room text default null,
  p_notes text default null,
  p_is_diabetic boolean default false,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_organization_id uuid;
  created_patient_id uuid;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();

  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  normalized_name := nullif(trim(p_name), '');

  if normalized_name is null then
    raise exception 'Patient name is required';
  end if;

  if p_location_id is null then
    raise exception 'Location is required';
  end if;

  if not exists (
    select 1
    from public.locations
    where id = p_location_id
      and organization_id = current_organization_id
  )
  then
    raise exception 'Invalid location';
  end if;

  insert into public.patients (
    organization_id,
    location_id,
    name,
    room,
    notes,
    is_diabetic,
    active
  )
  values (
    current_organization_id,
    p_location_id,
    normalized_name,
    nullif(trim(p_room), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_is_diabetic, false),
    coalesce(p_active, true)
  )
  returning id into created_patient_id;

  return created_patient_id;
end;
$$;

grant execute on function public.create_patient(text, uuid, text, text, boolean, boolean)
to authenticated;
