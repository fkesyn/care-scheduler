alter table public.appointment_clinical_records
add column if not exists heart_rate_value integer;

alter table public.appointments
add column if not exists updated_by uuid;

do $appointments_updated_by_fk$
begin
  if to_regclass('public.profiles') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.appointments'::regclass
        and conname = 'appointments_updated_by_fkey'
    )
  then
    alter table public.appointments
    add constraint appointments_updated_by_fkey
    foreign key (updated_by)
    references public.profiles(id)
    on delete set null;
  end if;
end;
$appointments_updated_by_fk$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointment_clinical_records'::regclass
      and conname = 'appointment_clinical_records_heart_rate_check'
  ) then
    alter table public.appointment_clinical_records
    add constraint appointment_clinical_records_heart_rate_check
    check (
      heart_rate_value is null
      or (heart_rate_value > 0 and heart_rate_value <= 300)
    );
  end if;
end;
$$;

create or replace function public.update_appointment_execution(
  p_appointment_id uuid,
  p_status text,
  p_notes text default null,
  p_blood_pressure_value text default null,
  p_heart_rate_value integer default null,
  p_wound_characteristics text default null,
  p_wound_treatment text default null
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

  select profile.id
  into audit_profile_id
  from public.profiles profile
  where profile.id = auth.uid()
  limit 1;

  update public.appointments
  set
    status = normalized_status,
    notes = nullif(trim(p_notes), ''),
    updated_at = now(),
    updated_by = coalesce(audit_profile_id, updated_by)
  where id = appointment_record.id;

  if appointment_record.measurement_type in ('blood_pressure', 'wound_care') then
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
      wound_characteristics,
      wound_treatment
    )
    values (
      appointment_record.organization_id,
      appointment_record.id,
      appointment_record.patient_id,
      appointment_record.service_id,
      appointment_record.employee_id,
      appointment_record.scheduled_date,
      'blood_pressure',
      nullif(trim(p_blood_pressure_value), ''),
      p_heart_rate_value,
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
      wound_characteristics,
      wound_treatment
    )
    values (
      appointment_record.organization_id,
      appointment_record.id,
      appointment_record.patient_id,
      appointment_record.service_id,
      appointment_record.employee_id,
      appointment_record.scheduled_date,
      'wound_care',
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
  text,
  text,
  text,
  integer,
  text,
  text
) to authenticated;

notify pgrst, 'reload schema';
