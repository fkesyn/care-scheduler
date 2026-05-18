alter table public.patients
add column if not exists is_hypertensive boolean not null default false,
add column if not exists has_active_wounds boolean not null default false;

drop function if exists public.create_patient(
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  date,
  text,
  text,
  text
);

create or replace function public.create_patient(
  p_name text,
  p_location_id uuid,
  p_room text default null,
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
    nullif(trim(p_room), ''),
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
$$;

grant execute on function public.create_patient(
  text,
  uuid,
  text,
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
