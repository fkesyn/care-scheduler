create table if not exists public.schedule_generation_warnings (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.monthly_schedules(id) on delete cascade,
  work_date date not null,
  shift_type_id uuid references public.shift_types(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint schedule_generation_warnings_message_check check (length(trim(message)) > 0)
);

create index if not exists schedule_generation_warnings_schedule_id_idx
  on public.schedule_generation_warnings(schedule_id);

create index if not exists schedule_generation_warnings_work_date_idx
  on public.schedule_generation_warnings(work_date);

create index if not exists schedule_generation_warnings_shift_type_id_idx
  on public.schedule_generation_warnings(shift_type_id);

alter table public.schedule_generation_warnings enable row level security;

drop policy if exists "Organization members can read schedule generation warnings"
on public.schedule_generation_warnings;
create policy "Organization members can read schedule generation warnings"
on public.schedule_generation_warnings
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

drop policy if exists "Organization members can insert schedule generation warnings"
on public.schedule_generation_warnings;
create policy "Organization members can insert schedule generation warnings"
on public.schedule_generation_warnings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.monthly_schedules schedule
    where schedule.id = schedule_id
      and schedule.organization_id = public.my_organization_id()
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

drop policy if exists "Organization members can update schedule generation warnings"
on public.schedule_generation_warnings;
create policy "Organization members can update schedule generation warnings"
on public.schedule_generation_warnings
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

drop policy if exists "Organization members can delete schedule generation warnings"
on public.schedule_generation_warnings;
create policy "Organization members can delete schedule generation warnings"
on public.schedule_generation_warnings
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
