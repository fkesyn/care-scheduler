create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid,
  name text not null,
  role text not null default 'assistant',
  phone text,
  email text,
  professional_license_number text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees
  add column if not exists organization_id uuid;

alter table public.employees
  add column if not exists name text;

alter table public.employees
  add column if not exists role text default 'assistant';

alter table public.employees
  add column if not exists phone text;

alter table public.employees
  add column if not exists email text;

alter table public.employees
  add column if not exists professional_license_number text;

alter table public.employees
  add column if not exists notes text;

alter table public.employees
  add column if not exists active boolean not null default true;

alter table public.employees
  add column if not exists created_at timestamptz not null default now();

alter table public.employees
  add column if not exists updated_at timestamptz not null default now();

update public.employees
set role = 'assistant'
where role is null;

update public.employees
set organization_id = public.my_organization_id()
where organization_id is null
  and public.my_organization_id() is not null;

do $employees_constraints$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.employees'::regclass
        and conname = 'employees_organization_id_fkey'
    )
  then
    alter table public.employees
      add constraint employees_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and conname = 'employees_role_check'
  )
  then
    alter table public.employees
      add constraint employees_role_check
      check (role in ('nurse', 'assistant', 'caregiver', 'other'));
  end if;
end;
$employees_constraints$;

do $employees_not_nulls$
begin
  if not exists (
    select 1
    from public.employees
    where organization_id is null
  )
  then
    alter table public.employees
      alter column organization_id set not null;
  end if;

  if not exists (
    select 1
    from public.employees
    where name is null
  )
  then
    alter table public.employees
      alter column name set not null;
  end if;

  if not exists (
    select 1
    from public.employees
    where role is null
  )
  then
    alter table public.employees
      alter column role set not null;
  end if;
end;
$employees_not_nulls$;

alter table public.employees enable row level security;

create index if not exists employees_organization_id_idx
  on public.employees(organization_id);

create index if not exists employees_active_idx
  on public.employees(active);

create index if not exists employees_role_idx
  on public.employees(role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$set_updated_at$;

drop trigger if exists employees_set_updated_at on public.employees;

create trigger employees_set_updated_at
  before update on public.employees
  for each row
  execute function public.set_updated_at();

drop policy if exists "Organization members can read employees" on public.employees;
create policy "Organization members can read employees"
on public.employees
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert employees" on public.employees;
create policy "Organization members can insert employees"
on public.employees
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update employees" on public.employees;
create policy "Organization members can update employees"
on public.employees
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());

create or replace function public.create_employee(
  p_name text,
  p_role text default 'assistant',
  p_phone text default null,
  p_email text default null,
  p_professional_license_number text default null,
  p_notes text default null,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $create_employee$
declare
  current_organization_id uuid;
  created_employee_id uuid;
  normalized_name text;
  normalized_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();

  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  normalized_name := nullif(trim(p_name), '');
  normalized_role := coalesce(nullif(trim(p_role), ''), 'assistant');

  if normalized_name is null then
    raise exception 'Employee name is required';
  end if;

  if normalized_role not in ('nurse', 'assistant', 'caregiver', 'other') then
    raise exception 'Invalid employee role';
  end if;

  insert into public.employees (
    organization_id,
    name,
    role,
    phone,
    email,
    professional_license_number,
    notes,
    active
  )
  values (
    current_organization_id,
    normalized_name,
    normalized_role,
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), ''),
    nullif(trim(p_professional_license_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_active, true)
  )
  returning id into created_employee_id;

  return created_employee_id;
end;
$create_employee$;

grant execute on function public.create_employee(text, text, text, text, text, text, boolean)
to authenticated;

alter table public.appointments
  add column if not exists employee_id uuid;

do $appointment_employee_constraint$
begin
  if to_regclass('public.appointments') is not null
    and to_regclass('public.employees') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.appointments'::regclass
        and conname = 'appointments_employee_id_fkey'
    )
  then
    alter table public.appointments
      add constraint appointments_employee_id_fkey
      foreign key (employee_id)
      references public.employees(id)
      on delete set null;
  end if;
end;
$appointment_employee_constraint$;

create index if not exists appointments_employee_id_idx
  on public.appointments(employee_id);

drop function if exists public.create_appointment(uuid, uuid, date, time, text, text);

create or replace function public.create_appointment(
  p_employee_id uuid,
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

  if p_employee_id is null then
    raise exception 'Employee is required';
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

  if not exists (
    select 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.organization_id = current_organization_id
      and coalesce(employee.active, true) = true
  )
  then
    raise exception 'Invalid employee';
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
    employee_id,
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
    p_employee_id,
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

grant execute on function public.create_appointment(uuid, uuid, uuid, date, time, text, text)
to authenticated;
