create table if not exists public.employee_work_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  preference_type text not null,
  shift_type_id uuid references public.shift_types(id) on delete set null,
  weekday integer,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_work_preferences_type_check
    check (
      preference_type in (
        'preferred_shift',
        'avoid_shift',
        'only_shift',
        'preferred_day_off',
        'unavailable_weekday',
        'max_shifts_per_week'
      )
    ),
  constraint employee_work_preferences_weekday_check
    check (weekday is null or (weekday >= 0 and weekday <= 6))
);

create index if not exists employee_work_preferences_organization_id_idx
  on public.employee_work_preferences(organization_id);

create index if not exists employee_work_preferences_employee_id_idx
  on public.employee_work_preferences(employee_id);

create index if not exists employee_work_preferences_active_idx
  on public.employee_work_preferences(active);

create index if not exists employee_work_preferences_type_idx
  on public.employee_work_preferences(preference_type);

drop trigger if exists employee_work_preferences_set_updated_at
on public.employee_work_preferences;

create trigger employee_work_preferences_set_updated_at
before update on public.employee_work_preferences
for each row
execute function public.set_updated_at();

alter table public.employee_work_preferences enable row level security;

drop policy if exists "Organization members can read employee work preferences"
on public.employee_work_preferences;
create policy "Organization members can read employee work preferences"
on public.employee_work_preferences
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert employee work preferences"
on public.employee_work_preferences;
create policy "Organization members can insert employee work preferences"
on public.employee_work_preferences
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

drop policy if exists "Organization members can update employee work preferences"
on public.employee_work_preferences;
create policy "Organization members can update employee work preferences"
on public.employee_work_preferences
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (
  organization_id = public.my_organization_id()
  and exists (
    select 1
    from public.employees employee
    where employee.id = employee_id
      and employee.organization_id = public.my_organization_id()
  )
  and (
    shift_type_id is null
    or exists (
      select 1
      from public.shift_types shift_type
      where shift_type.id = shift_type_id
        and shift_type.organization_id = public.my_organization_id()
    )
  )
);

drop policy if exists "Organization members can delete employee work preferences"
on public.employee_work_preferences;
create policy "Organization members can delete employee work preferences"
on public.employee_work_preferences
for delete
to authenticated
using (organization_id = public.my_organization_id());
