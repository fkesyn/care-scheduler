do $add_locations_updated_at$
begin
  if to_regclass('public.locations') is not null then
    alter table public.locations
      add column if not exists updated_at timestamptz;

    update public.locations
    set updated_at = now()
    where updated_at is null;

    alter table public.locations
      alter column updated_at set default now();

    alter table public.locations
      alter column updated_at set not null;
  end if;
end;
$add_locations_updated_at$;

do $add_patients_updated_at$
begin
  if to_regclass('public.patients') is not null then
    alter table public.patients
      add column if not exists updated_at timestamptz;

    update public.patients
    set updated_at = now()
    where updated_at is null;

    alter table public.patients
      alter column updated_at set default now();

    alter table public.patients
      alter column updated_at set not null;
  end if;
end;
$add_patients_updated_at$;

do $add_services_updated_at$
begin
  if to_regclass('public.services') is not null then
    alter table public.services
      add column if not exists updated_at timestamptz;

    update public.services
    set updated_at = now()
    where updated_at is null;

    alter table public.services
      alter column updated_at set default now();

    alter table public.services
      alter column updated_at set not null;
  end if;
end;
$add_services_updated_at$;

do $add_employees_updated_at$
begin
  if to_regclass('public.employees') is not null then
    alter table public.employees
      add column if not exists updated_at timestamptz;

    update public.employees
    set updated_at = now()
    where updated_at is null;

    alter table public.employees
      alter column updated_at set default now();

    alter table public.employees
      alter column updated_at set not null;
  end if;
end;
$add_employees_updated_at$;

do $add_appointments_updated_at$
begin
  if to_regclass('public.appointments') is not null then
    alter table public.appointments
      add column if not exists updated_at timestamptz;

    update public.appointments
    set updated_at = now()
    where updated_at is null;

    alter table public.appointments
      alter column updated_at set default now();

    alter table public.appointments
      alter column updated_at set not null;
  end if;
end;
$add_appointments_updated_at$;
