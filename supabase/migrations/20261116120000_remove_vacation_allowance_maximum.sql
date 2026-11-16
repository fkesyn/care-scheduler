alter table public.employee_vacation_allowances
drop constraint if exists employee_vacation_allowances_days_check;

alter table public.employee_vacation_allowances
add constraint employee_vacation_allowances_days_check
check (total_days >= 22);
