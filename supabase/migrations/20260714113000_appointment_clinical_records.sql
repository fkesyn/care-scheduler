alter table public.services
drop constraint if exists services_measurement_type_check;

alter table public.services
add constraint services_measurement_type_check
check (
  measurement_type is null
  or measurement_type in ('blood_pressure', 'glucose', 'wound_care')
);

update public.services
set measurement_type = 'wound_care'
where measurement_type is null
  and lower(name) like '%ferida%';

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

create table if not exists public.appointment_clinical_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  record_date date not null,
  record_type text not null,
  blood_pressure_value text,
  wound_characteristics text,
  wound_treatment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_clinical_records_appointment_unique unique (appointment_id),
  constraint appointment_clinical_records_type_check check (
    record_type in ('blood_pressure', 'wound_care')
  )
);

alter table public.appointment_clinical_records enable row level security;

create index if not exists appointment_clinical_records_organization_id_idx
  on public.appointment_clinical_records(organization_id);

create index if not exists appointment_clinical_records_patient_date_idx
  on public.appointment_clinical_records(patient_id, record_date desc);

create index if not exists appointment_clinical_records_service_date_idx
  on public.appointment_clinical_records(service_id, record_date desc);

create index if not exists appointment_clinical_records_employee_id_idx
  on public.appointment_clinical_records(employee_id);

drop trigger if exists appointment_clinical_records_set_updated_at
on public.appointment_clinical_records;

create trigger appointment_clinical_records_set_updated_at
before update on public.appointment_clinical_records
for each row
execute function public.set_updated_at();

drop policy if exists "Organization members can read appointment clinical records"
on public.appointment_clinical_records;
create policy "Organization members can read appointment clinical records"
on public.appointment_clinical_records
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert appointment clinical records"
on public.appointment_clinical_records;
create policy "Organization members can insert appointment clinical records"
on public.appointment_clinical_records
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update appointment clinical records"
on public.appointment_clinical_records;
create policy "Organization members can update appointment clinical records"
on public.appointment_clinical_records
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can delete appointment clinical records"
on public.appointment_clinical_records;
create policy "Organization members can delete appointment clinical records"
on public.appointment_clinical_records
for delete
to authenticated
using (organization_id = public.my_organization_id());
