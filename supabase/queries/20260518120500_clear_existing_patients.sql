-- Run this once before applying the VOTSF patient seed migration.
-- It removes the current test patients for the first organization in this project.

do $$
declare
  target_organization_id uuid;
begin
  select id
  into target_organization_id
  from public.organizations
  order by id
  limit 1;

  if target_organization_id is null then
    raise exception 'No organization found to clean patients.';
  end if;

  if to_regclass('public.appointments') is not null then
    delete from public.appointments
    where organization_id = target_organization_id
      and patient_id in (
        select id
        from public.patients
        where organization_id = target_organization_id
      );
  end if;

  if to_regclass('public.patient_family_contacts') is not null then
    delete from public.patient_family_contacts
    where organization_id = target_organization_id
      and patient_id in (
        select id
        from public.patients
        where organization_id = target_organization_id
      );
  end if;

  delete from public.patients
  where organization_id = target_organization_id;
end;
$$;
