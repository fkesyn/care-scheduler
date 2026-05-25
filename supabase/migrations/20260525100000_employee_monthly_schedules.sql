create table if not exists public.shift_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  code text not null,
  name text not null,
  description text,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint shift_types_code_check check (length(trim(code)) > 0),
  constraint shift_types_name_check check (length(trim(name)) > 0),
  constraint shift_types_organization_code_unique unique (organization_id, code)
);

create table if not exists public.monthly_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid references public.locations(id) on delete set null,
  month date not null,
  status text not null default 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint monthly_schedules_month_start_check
    check (date_trunc('month', month)::date = month),
  constraint monthly_schedules_status_check
    check (status in ('draft', 'published', 'archived'))
);

create table if not exists public.schedule_entries (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.monthly_schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  shift_type_id uuid not null references public.shift_types(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_entries_schedule_employee_date_unique
    unique (schedule_id, employee_id, work_date)
);

create table if not exists public.employee_schedule_constraints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  month date not null,
  constraint_type text not null,
  shift_type_id uuid references public.shift_types(id),
  start_date date,
  end_date date,
  specific_date date,
  notes text,
  source_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_schedule_constraints_month_start_check
    check (date_trunc('month', month)::date = month),
  constraint employee_schedule_constraints_type_check
    check (
      constraint_type in (
        'unavailable_shift',
        'vacation',
        'preferred_day_off',
        'preferred_shift',
        'avoid_shift',
        'only_shift',
        'exception_allowed_shift'
      )
    )
);

do $schedule_foreign_keys$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.shift_types'::regclass
        and conname = 'shift_types_organization_id_fkey'
    )
  then
    alter table public.shift_types
      add constraint shift_types_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;

  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.monthly_schedules'::regclass
        and conname = 'monthly_schedules_organization_id_fkey'
    )
  then
    alter table public.monthly_schedules
      add constraint monthly_schedules_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;

  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.employee_schedule_constraints'::regclass
        and conname = 'employee_schedule_constraints_organization_id_fkey'
    )
  then
    alter table public.employee_schedule_constraints
      add constraint employee_schedule_constraints_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete cascade;
  end if;

  if to_regclass('public.profiles') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.monthly_schedules'::regclass
        and conname = 'monthly_schedules_created_by_fkey'
    )
  then
    alter table public.monthly_schedules
      add constraint monthly_schedules_created_by_fkey
      foreign key (created_by)
      references public.profiles(id)
      on delete set null;
  end if;

  if to_regclass('public.profiles') is not null
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.monthly_schedules'::regclass
        and conname = 'monthly_schedules_updated_by_fkey'
    )
  then
    alter table public.monthly_schedules
      add constraint monthly_schedules_updated_by_fkey
      foreign key (updated_by)
      references public.profiles(id)
      on delete set null;
  end if;
end;
$schedule_foreign_keys$;

create unique index if not exists monthly_schedules_org_month_global_unique
  on public.monthly_schedules(organization_id, month)
  where location_id is null;

create unique index if not exists monthly_schedules_org_month_location_unique
  on public.monthly_schedules(organization_id, month, location_id)
  where location_id is not null;

create index if not exists shift_types_organization_id_idx
  on public.shift_types(organization_id);

create index if not exists shift_types_active_display_order_idx
  on public.shift_types(active, display_order);

create index if not exists monthly_schedules_organization_month_idx
  on public.monthly_schedules(organization_id, month);

create index if not exists monthly_schedules_location_id_idx
  on public.monthly_schedules(location_id);

create index if not exists monthly_schedules_status_idx
  on public.monthly_schedules(status);

create index if not exists schedule_entries_schedule_id_idx
  on public.schedule_entries(schedule_id);

create index if not exists schedule_entries_employee_id_idx
  on public.schedule_entries(employee_id);

create index if not exists schedule_entries_work_date_idx
  on public.schedule_entries(work_date);

create index if not exists schedule_entries_shift_type_id_idx
  on public.schedule_entries(shift_type_id);

create index if not exists employee_schedule_constraints_organization_month_idx
  on public.employee_schedule_constraints(organization_id, month);

create index if not exists employee_schedule_constraints_employee_id_idx
  on public.employee_schedule_constraints(employee_id);

create index if not exists employee_schedule_constraints_type_idx
  on public.employee_schedule_constraints(constraint_type);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$set_updated_at$;

drop trigger if exists monthly_schedules_set_updated_at
on public.monthly_schedules;

create trigger monthly_schedules_set_updated_at
before update on public.monthly_schedules
for each row
execute function public.set_updated_at();

drop trigger if exists schedule_entries_set_updated_at
on public.schedule_entries;

create trigger schedule_entries_set_updated_at
before update on public.schedule_entries
for each row
execute function public.set_updated_at();

drop trigger if exists employee_schedule_constraints_set_updated_at
on public.employee_schedule_constraints;

create trigger employee_schedule_constraints_set_updated_at
before update on public.employee_schedule_constraints
for each row
execute function public.set_updated_at();

alter table public.shift_types enable row level security;
alter table public.monthly_schedules enable row level security;
alter table public.schedule_entries enable row level security;
alter table public.employee_schedule_constraints enable row level security;

drop policy if exists "Organization members can read shift types"
on public.shift_types;
create policy "Organization members can read shift types"
on public.shift_types
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert shift types"
on public.shift_types;
create policy "Organization members can insert shift types"
on public.shift_types
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update shift types"
on public.shift_types;
create policy "Organization members can update shift types"
on public.shift_types
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can delete shift types"
on public.shift_types;
create policy "Organization members can delete shift types"
on public.shift_types
for delete
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can read monthly schedules"
on public.monthly_schedules;
create policy "Organization members can read monthly schedules"
on public.monthly_schedules
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert monthly schedules"
on public.monthly_schedules;
create policy "Organization members can insert monthly schedules"
on public.monthly_schedules
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and (
    location_id is null
    or exists (
      select 1
      from public.locations location
      where location.id = location_id
        and location.organization_id = public.my_organization_id()
    )
  )
);

drop policy if exists "Organization members can update monthly schedules"
on public.monthly_schedules;
create policy "Organization members can update monthly schedules"
on public.monthly_schedules
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (
  organization_id = public.my_organization_id()
  and (
    location_id is null
    or exists (
      select 1
      from public.locations location
      where location.id = location_id
        and location.organization_id = public.my_organization_id()
    )
  )
);

drop policy if exists "Organization members can delete monthly schedules"
on public.monthly_schedules;
create policy "Organization members can delete monthly schedules"
on public.monthly_schedules
for delete
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can read schedule entries"
on public.schedule_entries;
create policy "Organization members can read schedule entries"
on public.schedule_entries
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

drop policy if exists "Organization members can insert schedule entries"
on public.schedule_entries;
create policy "Organization members can insert schedule entries"
on public.schedule_entries
for insert
to authenticated
with check (
  exists (
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
  and exists (
    select 1
    from public.shift_types shift_type
    where shift_type.id = shift_type_id
      and shift_type.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization members can update schedule entries"
on public.schedule_entries;
create policy "Organization members can update schedule entries"
on public.schedule_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
)
with check (
  exists (
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
  and exists (
    select 1
    from public.shift_types shift_type
    where shift_type.id = shift_type_id
      and shift_type.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization members can delete schedule entries"
on public.schedule_entries;
create policy "Organization members can delete schedule entries"
on public.schedule_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization members can read employee schedule constraints"
on public.employee_schedule_constraints;
create policy "Organization members can read employee schedule constraints"
on public.employee_schedule_constraints
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert employee schedule constraints"
on public.employee_schedule_constraints;
create policy "Organization members can insert employee schedule constraints"
on public.employee_schedule_constraints
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

drop policy if exists "Organization members can update employee schedule constraints"
on public.employee_schedule_constraints;
create policy "Organization members can update employee schedule constraints"
on public.employee_schedule_constraints
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

drop policy if exists "Organization members can delete employee schedule constraints"
on public.employee_schedule_constraints;
create policy "Organization members can delete employee schedule constraints"
on public.employee_schedule_constraints
for delete
to authenticated
using (organization_id = public.my_organization_id());

do $seed_shift_types$
begin
  if to_regclass('public.organizations') is null then
    return;
  end if;

  insert into public.shift_types (
    organization_id,
    code,
    name,
    description,
    display_order
  )
  select
    organization_item.id,
    seed.code,
    seed.name,
    seed.description,
    seed.display_order
  from public.organizations organization_item
  cross join (
    values
      ('M', 'Manhã', 'Turno da manhã', 10),
      ('T', 'Tarde', 'Turno da tarde', 20),
      ('E', '10h-17h', 'Turno intermédio', 30),
      ('F', 'Folga', 'Dia de folga', 40),
      ('Fe', 'Férias', 'Período de férias', 50),
      ('FF', 'Folga em falta', 'Compensação feriado', 60),
      ('E*', 'Gestão enfermagem', 'Gestão enfermagem', 70)
  ) as seed(code, name, description, display_order)
  on conflict (organization_id, code) do update
  set
    name = excluded.name,
    description = excluded.description,
    display_order = excluded.display_order;
end;
$seed_shift_types$;
