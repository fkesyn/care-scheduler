create or replace function public.employee_holiday_balances_at(p_date date)
returns table(employee_id uuid, ff_days bigint)
language sql
stable
security definer
set search_path = public
as $employee_holiday_balances_at$
  select
    employee.id,
    count(holiday.id)
  from public.employees employee
  left join public.employee_holidays holiday
    on holiday.organization_id = employee.organization_id
   and holiday.employee_id = employee.id
   and (holiday.holiday_date is null or holiday.holiday_date <= p_date)
   and (holiday.used_date is null or holiday.used_date > p_date)
  where employee.organization_id = public.my_organization_id()
    and employee.role = 'nurse'
  group by employee.id;
$employee_holiday_balances_at$;

revoke all on function public.employee_holiday_balances_at(date) from public, anon;
grant execute on function public.employee_holiday_balances_at(date) to authenticated;
