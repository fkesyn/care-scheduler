create table if not exists public.schedule_employee_ff_days (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.monthly_schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  ff_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_employee_ff_days_schedule_employee_unique
    unique (schedule_id, employee_id),
  constraint schedule_employee_ff_days_value_check
    check (ff_days >= 0 and ff_days <= 31)
);

create index if not exists schedule_employee_ff_days_schedule_id_idx
  on public.schedule_employee_ff_days(schedule_id);

create index if not exists schedule_employee_ff_days_employee_id_idx
  on public.schedule_employee_ff_days(employee_id);

drop trigger if exists schedule_employee_ff_days_set_updated_at
on public.schedule_employee_ff_days;

create trigger schedule_employee_ff_days_set_updated_at
before update on public.schedule_employee_ff_days
for each row
execute function public.set_updated_at();

alter table public.schedule_employee_ff_days enable row level security;

drop policy if exists "Organization members can read schedule employee FF days"
on public.schedule_employee_ff_days;
create policy "Organization members can read schedule employee FF days"
on public.schedule_employee_ff_days
for select
to authenticated
using (
  exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization admins can insert schedule employee FF days"
on public.schedule_employee_ff_days;
create policy "Organization admins can insert schedule employee FF days"
on public.schedule_employee_ff_days
for insert
to authenticated
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization admins can update schedule employee FF days"
on public.schedule_employee_ff_days;
create policy "Organization admins can update schedule employee FF days"
on public.schedule_employee_ff_days
for update
to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
)
with check (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization admins can delete schedule employee FF days"
on public.schedule_employee_ff_days;
create policy "Organization admins can delete schedule employee FF days"
on public.schedule_employee_ff_days
for delete
to authenticated
using (
  public.is_admin_user()
  and exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
);
