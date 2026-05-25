alter table public.schedule_generation_warnings
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

alter table public.schedule_generation_warnings
  add column if not exists resolved boolean not null default false;

alter table public.schedule_generation_warnings
  add column if not exists resolved_at timestamptz;

create index if not exists schedule_generation_warnings_employee_id_idx
  on public.schedule_generation_warnings(employee_id);

create index if not exists schedule_generation_warnings_resolved_idx
  on public.schedule_generation_warnings(resolved);
