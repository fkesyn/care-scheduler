alter table public.employees
  add column if not exists display_order integer;

with ordered_employees as (
  select
    employee.id,
    row_number() over (
      partition by employee.organization_id
      order by employee.name
    ) as next_order
  from public.employees employee
  where employee.display_order is null
)
update public.employees as employee
set display_order = ordered_employees.next_order
from ordered_employees
where employee.id = ordered_employees.id;

create index if not exists employees_organization_display_order_idx
  on public.employees(organization_id, display_order);
