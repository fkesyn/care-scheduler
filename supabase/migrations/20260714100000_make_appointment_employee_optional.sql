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
