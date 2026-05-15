create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  patient_id uuid not null,
  service_id uuid not null,
  scheduled_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists organization_id uuid;

alter table public.appointments
  add column if not exists patient_id uuid;

alter table public.appointments
  add column if not exists service_id uuid;

alter table public.appointments
  add column if not exists scheduled_date date;

alter table public.appointments
  add column if not exists start_time time;

alter table public.appointments
  add column if not exists end_time time;

alter table public.appointments
  add column if not exists status text default 'planned';

alter table public.appointments
  add column if not exists notes text;

alter table public.appointments
  add column if not exists created_at timestamptz not null default now();

alter table public.appointments
  add column if not exists updated_at timestamptz not null default now();

update public.appointments
set status = 'planned'
where status is null;

update public.appointments
set organization_id = public.my_organization_id()
where organization_id is null
  and public.my_organization_id() is not null;

do $appointments_constraints$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.appointments'::regclass
        and conname = 'appointments_organization_id_fkey'
    )
  then
    alter table public.appointments
      add constraint appointments_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;

  if to_regclass('public.patients') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.appointments'::regclass
        and conname = 'appointments_patient_id_fkey'
    )
  then
    alter table public.appointments
      add constraint appointments_patient_id_fkey
      foreign key (patient_id)
      references public.patients(id)
      on delete restrict;
  end if;

  if to_regclass('public.services') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.appointments'::regclass
        and conname = 'appointments_service_id_fkey'
    )
  then
    alter table public.appointments
      add constraint appointments_service_id_fkey
      foreign key (service_id)
      references public.services(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_status_check'
  )
  then
    alter table public.appointments
      add constraint appointments_status_check
      check (status in ('planned', 'completed', 'canceled'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_time_check'
  )
  then
    alter table public.appointments
      add constraint appointments_time_check
      check (end_time > start_time);
  end if;
end;
$appointments_constraints$;

do $appointments_not_nulls$
begin
  if not exists (
    select 1
    from public.appointments
    where organization_id is null
  )
  then
    alter table public.appointments
      alter column organization_id set not null;
  end if;

  if not exists (
    select 1
    from public.appointments
    where patient_id is null
  )
  then
    alter table public.appointments
      alter column patient_id set not null;
  end if;

  if not exists (
    select 1
    from public.appointments
    where service_id is null
  )
  then
    alter table public.appointments
      alter column service_id set not null;
  end if;

  if not exists (
    select 1
    from public.appointments
    where scheduled_date is null
  )
  then
    alter table public.appointments
      alter column scheduled_date set not null;
  end if;

  if not exists (
    select 1
    from public.appointments
    where start_time is null
  )
  then
    alter table public.appointments
      alter column start_time set not null;
  end if;

  if not exists (
    select 1
    from public.appointments
    where end_time is null
  )
  then
    alter table public.appointments
      alter column end_time set not null;
  end if;

  if not exists (
    select 1
    from public.appointments
    where status is null
  )
  then
    alter table public.appointments
      alter column status set not null;
  end if;
end;
$appointments_not_nulls$;

alter table public.appointments enable row level security;

create index if not exists appointments_organization_id_idx
  on public.appointments(organization_id);

create index if not exists appointments_scheduled_date_idx
  on public.appointments(scheduled_date);

create index if not exists appointments_patient_id_idx
  on public.appointments(patient_id);

create index if not exists appointments_service_id_idx
  on public.appointments(service_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$set_updated_at$;

drop trigger if exists appointments_set_updated_at on public.appointments;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

drop policy if exists "Organization members can read appointments" on public.appointments;
create policy "Organization members can read appointments"
on public.appointments
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert appointments" on public.appointments;
create policy "Organization members can insert appointments"
on public.appointments
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update appointments" on public.appointments;
create policy "Organization members can update appointments"
on public.appointments
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());

create or replace function public.create_appointment(
  p_patient_id uuid,
  p_service_id uuid,
  p_scheduled_date date,
  p_start_time time,
  p_notes text default null,
  p_status text default 'planned'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $create_appointment$
declare
  current_organization_id uuid;
  created_appointment_id uuid;
  computed_end_time time;
  normalized_status text;
  patient_is_diabetic boolean;
  service_duration_minutes integer;
  service_measurement_type text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();

  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  if p_patient_id is null then
    raise exception 'Patient is required';
  end if;

  if p_service_id is null then
    raise exception 'Service is required';
  end if;

  if p_scheduled_date is null then
    raise exception 'Date is required';
  end if;

  if p_start_time is null then
    raise exception 'Start time is required';
  end if;

  normalized_status := coalesce(nullif(trim(p_status), ''), 'planned');

  if normalized_status not in ('planned', 'completed', 'canceled') then
    raise exception 'Invalid status';
  end if;

  select coalesce(patient.is_diabetic, false)
  into patient_is_diabetic
  from public.patients patient
  where patient.id = p_patient_id
    and patient.organization_id = current_organization_id
    and coalesce(patient.active, true) = true;

  if not found then
    raise exception 'Invalid patient';
  end if;

  select service.duration_minutes, service.measurement_type
  into service_duration_minutes, service_measurement_type
  from public.services service
  where service.id = p_service_id
    and service.organization_id = current_organization_id
    and coalesce(service.active, true) = true;

  if not found then
    raise exception 'Invalid service';
  end if;

  if service_measurement_type = 'glucose'
    and patient_is_diabetic = false
  then
    raise exception 'Glucose appointments require a diabetic patient';
  end if;

  computed_end_time := (p_start_time + make_interval(mins => service_duration_minutes))::time;

  if computed_end_time <= p_start_time then
    raise exception 'Invalid appointment end time';
  end if;

  insert into public.appointments (
    organization_id,
    patient_id,
    service_id,
    scheduled_date,
    start_time,
    end_time,
    status,
    notes
  )
  values (
    current_organization_id,
    p_patient_id,
    p_service_id,
    p_scheduled_date,
    p_start_time,
    computed_end_time,
    normalized_status,
    nullif(trim(p_notes), '')
  )
  returning id into created_appointment_id;

  return created_appointment_id;
end;
$create_appointment$;

grant execute on function public.create_appointment(uuid, uuid, date, time, text, text)
to authenticated;
