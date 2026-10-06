alter table public.appointments
add column if not exists glucose_period text;

do $appointments_glucose_period_check$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointments'::regclass
      and conname = 'appointments_glucose_period_check'
  ) then
    alter table public.appointments
    add constraint appointments_glucose_period_check
    check (
      glucose_period is null
      or glucose_period in ('fasting', 'dinner')
    );
  end if;
end;
$appointments_glucose_period_check$;

create index if not exists appointments_glucose_period_idx
on public.appointments(glucose_period);

alter table public.appointment_clinical_records
add column if not exists glucose_value integer;

do $appointment_clinical_records_glucose_value_check$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointment_clinical_records'::regclass
      and conname = 'appointment_clinical_records_glucose_value_check'
  ) then
    alter table public.appointment_clinical_records
    add constraint appointment_clinical_records_glucose_value_check
    check (
      glucose_value is null
      or (glucose_value > 0 and glucose_value <= 1000)
    );
  end if;
end;
$appointment_clinical_records_glucose_value_check$;

alter table public.appointment_clinical_records
drop constraint if exists appointment_clinical_records_type_check;

alter table public.appointment_clinical_records
add constraint appointment_clinical_records_type_check
check (record_type in ('blood_pressure', 'glucose', 'wound_care'));

update public.services
set name = 'Glicemia capilar'
where measurement_type = 'glucose'
  and name <> 'Glicemia capilar';

drop function if exists public.create_appointment(
  uuid,
  uuid,
  uuid,
  date,
  time,
  text,
  text
);

create or replace function public.create_appointment(
  p_employee_id uuid,
  p_patient_id uuid,
  p_service_id uuid,
  p_scheduled_date date,
  p_start_time time,
  p_notes text default null,
  p_status text default 'planned',
  p_glucose_period text default null
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
  normalized_glucose_period text;
  patient_is_diabetic boolean;
  service_duration_minutes integer;
  service_measurement_type text;
  current_user_email text;
  current_user_employee_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();

  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  if not public.is_admin_user() then
    current_user_email := lower(nullif(auth.jwt() ->> 'email', ''));

    if current_user_email is null then
      raise exception 'Employee not found for user';
    end if;

    select employee.id
    into current_user_employee_id
    from public.employees employee
    where employee.organization_id = current_organization_id
      and coalesce(employee.active, true) = true
      and lower(employee.email) = current_user_email
    order by employee.name
    limit 1;

    if current_user_employee_id is null then
      raise exception 'Employee not found for user';
    end if;

    if p_employee_id is null or p_employee_id <> current_user_employee_id then
      raise exception 'Invalid employee';
    end if;
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
  normalized_glucose_period := nullif(trim(p_glucose_period), '');

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

  if service_measurement_type = 'glucose' then
    if patient_is_diabetic = false then
      raise exception 'Glucose appointments require a diabetic patient';
    end if;

    if normalized_glucose_period not in ('fasting', 'dinner') then
      raise exception 'Glucose period is required';
    end if;
  else
    normalized_glucose_period := null;
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
    notes,
    glucose_period
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
    nullif(trim(p_notes), ''),
    normalized_glucose_period
  )
  returning id into created_appointment_id;

  return created_appointment_id;
end;
$create_appointment$;

grant execute on function public.create_appointment(
  uuid,
  uuid,
  uuid,
  date,
  time,
  text,
  text,
  text
) to authenticated;

drop function if exists public.update_appointment_execution(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text
);

create or replace function public.update_appointment_execution(
  p_appointment_id uuid,
  p_employee_id uuid default null,
  p_status text default 'planned',
  p_notes text default null,
  p_blood_pressure_value text default null,
  p_heart_rate_value integer default null,
  p_wound_characteristics text default null,
  p_wound_treatment text default null,
  p_glucose_value integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $update_appointment_execution$
declare
  current_organization_id uuid;
  normalized_status text;
  normalized_service_name text;
  clinical_record_type text;
  audit_profile_id uuid;
  appointment_record record;
  selected_employee_id uuid;
  current_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();

  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  normalized_status := coalesce(nullif(trim(p_status), ''), 'planned');

  if normalized_status not in ('planned', 'completed', 'canceled') then
    raise exception 'Invalid status';
  end if;

  if p_blood_pressure_value is not null
    and length(trim(p_blood_pressure_value)) > 80
  then
    raise exception 'Blood pressure value is too long';
  end if;

  if p_heart_rate_value is not null
    and (p_heart_rate_value <= 0 or p_heart_rate_value > 300)
  then
    raise exception 'Invalid heart rate';
  end if;

  if p_glucose_value is not null
    and (p_glucose_value <= 0 or p_glucose_value > 1000)
  then
    raise exception 'Invalid glucose value';
  end if;

  if p_wound_characteristics is not null
    and length(trim(p_wound_characteristics)) > 2000
  then
    raise exception 'Wound characteristics are too long';
  end if;

  if p_wound_treatment is not null
    and length(trim(p_wound_treatment)) > 2000
  then
    raise exception 'Wound treatment is too long';
  end if;

  select
    appointment.id,
    appointment.organization_id,
    appointment.patient_id,
    appointment.service_id,
    appointment.employee_id,
    appointment.scheduled_date,
    service.name as service_name,
    service.measurement_type
  into appointment_record
  from public.appointments appointment
  join public.services service on service.id = appointment.service_id
  where appointment.id = p_appointment_id
    and appointment.organization_id = current_organization_id;

  if not found then
    raise exception 'Appointment not found';
  end if;

  if p_employee_id is not null then
    select employee.id
    into selected_employee_id
    from public.employees employee
    where employee.id = p_employee_id
      and employee.organization_id = current_organization_id
    limit 1;

    if selected_employee_id is null then
      raise exception 'Employee not found';
    end if;
  else
    selected_employee_id := appointment_record.employee_id;
    current_user_email := lower(nullif(auth.jwt() ->> 'email', ''));

    if selected_employee_id is null and current_user_email is not null then
      select employee.id
      into selected_employee_id
      from public.employees employee
      where employee.organization_id = current_organization_id
        and employee.active = true
        and lower(employee.email) = current_user_email
      order by employee.name
      limit 1;
    end if;
  end if;

  select profile.id
  into audit_profile_id
  from public.profiles profile
  where profile.id = auth.uid()
  limit 1;

  update public.appointments
  set
    employee_id = selected_employee_id,
    status = normalized_status,
    notes = nullif(trim(p_notes), ''),
    updated_at = now(),
    updated_by = coalesce(audit_profile_id, updated_by)
  where id = appointment_record.id;

  if appointment_record.measurement_type in ('blood_pressure', 'glucose', 'wound_care') then
    clinical_record_type := appointment_record.measurement_type;
  else
    normalized_service_name := lower(trim(coalesce(appointment_record.service_name, '')));

    if normalized_service_name = 'ta'
      or normalized_service_name like '%tensão arterial%'
      or normalized_service_name like '%tensao arterial%'
      or normalized_service_name like '%pressão arterial%'
      or normalized_service_name like '%pressao arterial%'
    then
      clinical_record_type := 'blood_pressure';
    elsif normalized_service_name like '%glicemia%'
      or normalized_service_name like '%glicémia%'
      or normalized_service_name like '%glucose%'
    then
      clinical_record_type := 'glucose';
    elsif normalized_service_name like '%ferida%' then
      clinical_record_type := 'wound_care';
    else
      clinical_record_type := null;
    end if;
  end if;

  if clinical_record_type = 'blood_pressure'
    and (
      nullif(trim(p_blood_pressure_value), '') is not null
      or p_heart_rate_value is not null
    )
  then
    insert into public.appointment_clinical_records (
      organization_id,
      appointment_id,
      patient_id,
      service_id,
      employee_id,
      record_date,
      record_type,
      blood_pressure_value,
      heart_rate_value,
      glucose_value,
      wound_characteristics,
      wound_treatment
    )
    values (
      appointment_record.organization_id,
      appointment_record.id,
      appointment_record.patient_id,
      appointment_record.service_id,
      selected_employee_id,
      appointment_record.scheduled_date,
      'blood_pressure',
      nullif(trim(p_blood_pressure_value), ''),
      p_heart_rate_value,
      null,
      null,
      null
    )
    on conflict (appointment_id) do update
    set
      patient_id = excluded.patient_id,
      service_id = excluded.service_id,
      employee_id = excluded.employee_id,
      record_date = excluded.record_date,
      record_type = excluded.record_type,
      blood_pressure_value = excluded.blood_pressure_value,
      heart_rate_value = excluded.heart_rate_value,
      glucose_value = null,
      wound_characteristics = null,
      wound_treatment = null;
  elsif clinical_record_type = 'glucose'
    and p_glucose_value is not null
  then
    insert into public.appointment_clinical_records (
      organization_id,
      appointment_id,
      patient_id,
      service_id,
      employee_id,
      record_date,
      record_type,
      blood_pressure_value,
      heart_rate_value,
      glucose_value,
      wound_characteristics,
      wound_treatment
    )
    values (
      appointment_record.organization_id,
      appointment_record.id,
      appointment_record.patient_id,
      appointment_record.service_id,
      selected_employee_id,
      appointment_record.scheduled_date,
      'glucose',
      null,
      null,
      p_glucose_value,
      null,
      null
    )
    on conflict (appointment_id) do update
    set
      patient_id = excluded.patient_id,
      service_id = excluded.service_id,
      employee_id = excluded.employee_id,
      record_date = excluded.record_date,
      record_type = excluded.record_type,
      blood_pressure_value = null,
      heart_rate_value = null,
      glucose_value = excluded.glucose_value,
      wound_characteristics = null,
      wound_treatment = null;
  elsif clinical_record_type = 'wound_care'
    and (
      nullif(trim(p_wound_characteristics), '') is not null
      or nullif(trim(p_wound_treatment), '') is not null
    )
  then
    insert into public.appointment_clinical_records (
      organization_id,
      appointment_id,
      patient_id,
      service_id,
      employee_id,
      record_date,
      record_type,
      blood_pressure_value,
      heart_rate_value,
      glucose_value,
      wound_characteristics,
      wound_treatment
    )
    values (
      appointment_record.organization_id,
      appointment_record.id,
      appointment_record.patient_id,
      appointment_record.service_id,
      selected_employee_id,
      appointment_record.scheduled_date,
      'wound_care',
      null,
      null,
      null,
      nullif(trim(p_wound_characteristics), ''),
      nullif(trim(p_wound_treatment), '')
    )
    on conflict (appointment_id) do update
    set
      patient_id = excluded.patient_id,
      service_id = excluded.service_id,
      employee_id = excluded.employee_id,
      record_date = excluded.record_date,
      record_type = excluded.record_type,
      blood_pressure_value = null,
      heart_rate_value = null,
      glucose_value = null,
      wound_characteristics = excluded.wound_characteristics,
      wound_treatment = excluded.wound_treatment;
  else
    delete from public.appointment_clinical_records
    where appointment_id = appointment_record.id
      and organization_id = appointment_record.organization_id;
  end if;
end;
$update_appointment_execution$;

grant execute on function public.update_appointment_execution(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  text,
  text,
  integer
) to authenticated;

notify pgrst, 'reload schema';
