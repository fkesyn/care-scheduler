do $seed_susana_management_shift_preference$
begin
  if to_regclass('public.employee_work_preferences') is null then
    return;
  end if;

  insert into public.employee_work_preferences (
    organization_id,
    employee_id,
    preference_type,
    shift_type_id,
    weekday,
    active,
    notes
  )
  select
    employee.organization_id,
    employee.id,
    'preferred_shift',
    shift_type.id,
    null,
    true,
    'Turno E* mensal (1x/mês) - preferência fixa'
  from public.employees employee
  inner join public.shift_types shift_type
    on shift_type.organization_id = employee.organization_id
   and shift_type.code = 'E*'
  where employee.active is true
    and lower(employee.name) like 'susana%'
    and not exists (
      select 1
      from public.employee_work_preferences preference
      where preference.organization_id = employee.organization_id
        and preference.employee_id = employee.id
        and preference.preference_type = 'preferred_shift'
        and preference.shift_type_id = shift_type.id
        and preference.active is true
    );
end;
$seed_susana_management_shift_preference$;
