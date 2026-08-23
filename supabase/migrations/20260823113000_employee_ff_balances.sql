create table if not exists public.employee_ff_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  ff_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_ff_balances_organization_employee_unique
    unique (organization_id, employee_id),
  constraint employee_ff_balances_value_check
    check (ff_days >= 0 and ff_days <= 999)
);

do $employee_ff_balances_foreign_keys$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.employee_ff_balances'::regclass
        and conname = 'employee_ff_balances_organization_id_fkey'
    )
  then
    alter table public.employee_ff_balances
      add constraint employee_ff_balances_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;
end;
$employee_ff_balances_foreign_keys$;

create index if not exists employee_ff_balances_organization_id_idx
  on public.employee_ff_balances(organization_id);

create index if not exists employee_ff_balances_employee_id_idx
  on public.employee_ff_balances(employee_id);

drop trigger if exists employee_ff_balances_set_updated_at
on public.employee_ff_balances;

create trigger employee_ff_balances_set_updated_at
before update on public.employee_ff_balances
for each row
execute function public.set_updated_at();

insert into public.employee_ff_balances (
  organization_id,
  employee_id,
  ff_days
)
select
  latest.organization_id,
  latest.employee_id,
  latest.ff_days
from (
  select distinct on (schedule.organization_id, employee_ff_days.employee_id)
    schedule.organization_id,
    employee_ff_days.employee_id,
    employee_ff_days.ff_days,
    employee_ff_days.updated_at,
    employee_ff_days.created_at
  from public.schedule_employee_ff_days employee_ff_days
  join public.monthly_schedules schedule
    on schedule.id = employee_ff_days.schedule_id
  order by
    schedule.organization_id,
    employee_ff_days.employee_id,
    employee_ff_days.updated_at desc,
    employee_ff_days.created_at desc
) latest
on conflict (organization_id, employee_id)
do update set
  ff_days = excluded.ff_days,
  updated_at = now();

alter table public.employee_ff_balances enable row level security;

drop policy if exists "Organization members can read employee FF balances"
on public.employee_ff_balances;
create policy "Organization members can read employee FF balances"
on public.employee_ff_balances
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization admins can insert employee FF balances"
on public.employee_ff_balances;
create policy "Organization admins can insert employee FF balances"
on public.employee_ff_balances
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization admins can update employee FF balances"
on public.employee_ff_balances;
create policy "Organization admins can update employee FF balances"
on public.employee_ff_balances
for update
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
)
with check (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization admins can delete employee FF balances"
on public.employee_ff_balances;
create policy "Organization admins can delete employee FF balances"
on public.employee_ff_balances
for delete
to authenticated
using (
  organization_id = public.my_organization_id()
  and public.is_admin_user()
);
