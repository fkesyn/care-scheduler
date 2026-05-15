do $appointments_patient_fk$
declare
  constraint_record record;
begin
  if to_regclass('public.appointments') is null
    or to_regclass('public.patients') is null
  then
    return;
  end if;

  for constraint_record in
    select constraint_item.conname
    from pg_constraint constraint_item
    where constraint_item.conrelid = 'public.appointments'::regclass
      and constraint_item.confrelid = 'public.patients'::regclass
      and constraint_item.contype = 'f'
  loop
    execute format(
      'alter table public.appointments drop constraint %I',
      constraint_record.conname
    );
  end loop;

  alter table public.appointments
    add constraint appointments_patient_id_fkey
    foreign key (patient_id)
    references public.patients(id)
    on delete cascade;
end;
$appointments_patient_fk$;

do $appointments_service_fk$
declare
  constraint_record record;
begin
  if to_regclass('public.appointments') is null
    or to_regclass('public.services') is null
  then
    return;
  end if;

  for constraint_record in
    select constraint_item.conname
    from pg_constraint constraint_item
    where constraint_item.conrelid = 'public.appointments'::regclass
      and constraint_item.confrelid = 'public.services'::regclass
      and constraint_item.contype = 'f'
  loop
    execute format(
      'alter table public.appointments drop constraint %I',
      constraint_record.conname
    );
  end loop;

  alter table public.appointments
    add constraint appointments_service_id_fkey
    foreign key (service_id)
    references public.services(id)
    on delete cascade;
end;
$appointments_service_fk$;
