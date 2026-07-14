do $profile_roles$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      add column if not exists role text;

    update public.profiles
    set role = 'viewer'
    where role is null
      or role not in ('admin', 'viewer');

    update public.profiles
    set role = 'admin'
    where lower(email) in (
      'fabio.gomes.mota@gmail.com',
      'lipa.vale@gmail.com'
    );

    alter table public.profiles
      alter column role set default 'viewer';

    alter table public.profiles
      alter column role set not null;

    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.profiles'::regclass
        and conname = 'profiles_role_check'
    )
    then
      alter table public.profiles
        add constraint profiles_role_check
        check (role in ('admin', 'viewer'));
    end if;
  end if;
end;
$profile_roles$;

insert into public.profiles (id, email, full_name, role)
select
  auth_user.id,
  auth_user.email,
  coalesce(auth_user.raw_user_meta_data->>'full_name', auth_user.email),
  case
    when lower(auth_user.email) in (
      'fabio.gomes.mota@gmail.com',
      'lipa.vale@gmail.com'
    )
    then 'admin'
    else 'viewer'
  end
from auth.users auth_user
where to_regclass('public.profiles') is not null
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  role = case
    when lower(excluded.email) in (
      'fabio.gomes.mota@gmail.com',
      'lipa.vale@gmail.com'
    )
    then 'admin'
    else public.profiles.role
  end;

create or replace function public.current_user_role()
returns text
language plpgsql
security definer
set search_path = public
as $current_user_role$
declare
  jwt_email text;
begin
  if auth.uid() is null then
    return 'viewer';
  end if;

  jwt_email := lower(coalesce(auth.jwt()->>'email', ''));

  if jwt_email in (
    'fabio.gomes.mota@gmail.com',
    'lipa.vale@gmail.com'
  )
  then
    return 'admin';
  end if;

  return 'viewer';
end;
$current_user_role$;

grant execute on function public.current_user_role() to authenticated;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $is_admin_user$
  select public.current_user_role() = 'admin';
$is_admin_user$;

grant execute on function public.is_admin_user() to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user_profile$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when lower(new.email) in (
        'fabio.gomes.mota@gmail.com',
        'lipa.vale@gmail.com'
      )
      then 'admin'
      else 'viewer'
    end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = case
      when lower(excluded.email) in (
        'fabio.gomes.mota@gmail.com',
        'lipa.vale@gmail.com'
      )
      then 'admin'
      else public.profiles.role
    end;

  return new;
end;
$handle_new_user_profile$;

do $drop_write_policies$
declare
  target_table text;
  policy_record record;
begin
  foreach target_table in array array[
    'locations',
    'patients',
    'services',
    'employees',
    'appointments',
    'patient_family_contacts',
    'appointment_clinical_records',
    'shift_types',
    'monthly_schedules',
    'schedule_entries',
    'employee_schedule_constraints',
    'schedule_generation_warnings',
    'employee_work_preferences'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = target_table
          and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      loop
        execute format(
          'drop policy if exists %I on public.%I',
          policy_record.policyname,
          target_table
        );
      end loop;
    end if;
  end loop;
end;
$drop_write_policies$;

create policy "Organization admins can insert locations"
on public.locations
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can update locations"
on public.locations
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can delete locations"
on public.locations
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert patients"
on public.patients
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.locations location
    where location.id = location_id
      and location.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can update patients"
on public.patients
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.locations location
    where location.id = location_id
      and location.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can delete patients"
on public.patients
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert services"
on public.services
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can update services"
on public.services
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can delete services"
on public.services
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert employees"
on public.employees
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can update employees"
on public.employees
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can delete employees"
on public.employees
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert appointments"
on public.appointments
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and (
    employee_id is null
    or exists (
      select 1
      from public.employees employee
      where employee.id = employee_id
        and employee.organization_id = public.my_organization_id()
    )
  )
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_id
      and patient.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.services service
    where service.id = service_id
      and service.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can update appointments"
on public.appointments
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and (
    employee_id is null
    or exists (
      select 1
      from public.employees employee
      where employee.id = employee_id
        and employee.organization_id = public.my_organization_id()
    )
  )
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_id
      and patient.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.services service
    where service.id = service_id
      and service.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can delete appointments"
on public.appointments
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert patient family contacts"
on public.patient_family_contacts
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_id
      and patient.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can update patient family contacts"
on public.patient_family_contacts
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_id
      and patient.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can delete patient family contacts"
on public.patient_family_contacts
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert appointment clinical records"
on public.appointment_clinical_records
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can update appointment clinical records"
on public.appointment_clinical_records
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can delete appointment clinical records"
on public.appointment_clinical_records
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert shift types"
on public.shift_types
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can update shift types"
on public.shift_types
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can delete shift types"
on public.shift_types
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert monthly schedules"
on public.monthly_schedules
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and (
    location_id is null
    or exists (
      select 1
      from public.locations location
      where location.id = location_id
        and location.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can update monthly schedules"
on public.monthly_schedules
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and (
    location_id is null
    or exists (
      select 1
      from public.locations location
      where location.id = location_id
        and location.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can delete monthly schedules"
on public.monthly_schedules
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert schedule entries"
on public.schedule_entries
for insert
to authenticated
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.shift_types shift_type
    where shift_type.id = shift_type_id
      and shift_type.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can update schedule entries"
on public.schedule_entries
for update
to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.shift_types shift_type
    where shift_type.id = shift_type_id
      and shift_type.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can delete schedule entries"
on public.schedule_entries
for delete
to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can insert employee schedule constraints"
on public.employee_schedule_constraints
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can update employee schedule constraints"
on public.employee_schedule_constraints
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can delete employee schedule constraints"
on public.employee_schedule_constraints
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

create policy "Organization admins can insert schedule generation warnings"
on public.schedule_generation_warnings
for insert
to authenticated
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can update schedule generation warnings"
on public.schedule_generation_warnings
for update
to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can delete schedule generation warnings"
on public.schedule_generation_warnings
for delete
to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
);

create policy "Organization admins can insert employee work preferences"
on public.employee_work_preferences
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can update employee work preferences"
on public.employee_work_preferences
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

create policy "Organization admins can delete employee work preferences"
on public.employee_work_preferences
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);

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

  if not public.is_admin_user() then
    raise exception 'Sem permissões para alterar dados';
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
    and normalized_measurement_type not in ('blood_pressure', 'glucose', 'wound_care')
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

  if not public.is_admin_user() then
    raise exception 'Sem permissões para alterar dados';
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

create or replace function public.create_patient(
  p_name text,
  p_location_id uuid,
  p_notes text default null,
  p_is_diabetic boolean default false,
  p_active boolean default true,
  p_birth_date date default null,
  p_health_center text default null,
  p_family_doctor text default null,
  p_patient_number text default null,
  p_is_hypertensive boolean default false,
  p_has_active_wounds boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $create_patient$
declare
  current_organization_id uuid;
  created_patient_id uuid;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_admin_user() then
    raise exception 'Sem permissões para alterar dados';
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
    birth_date,
    health_center,
    family_doctor,
    patient_number,
    notes,
    is_diabetic,
    is_hypertensive,
    has_active_wounds,
    active
  )
  values (
    current_organization_id,
    p_location_id,
    normalized_name,
    p_birth_date,
    nullif(trim(p_health_center), ''),
    nullif(trim(p_family_doctor), ''),
    nullif(trim(p_patient_number), ''),
    nullif(trim(p_notes), ''),
    coalesce(p_is_diabetic, false),
    coalesce(p_is_hypertensive, false),
    coalesce(p_has_active_wounds, false),
    coalesce(p_active, true)
  )
  returning id into created_patient_id;

  return created_patient_id;
end;
$create_patient$;

grant execute on function public.create_patient(
  text,
  uuid,
  text,
  boolean,
  boolean,
  date,
  text,
  text,
  text,
  boolean,
  boolean
) to authenticated;

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

  if not public.is_admin_user() then
    raise exception 'Sem permissões para alterar dados';
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

  if p_employee_id is not null
    and not exists (
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
