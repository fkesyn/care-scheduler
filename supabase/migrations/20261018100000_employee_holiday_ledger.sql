-- One row per day of holiday compensation. Unknown legacy dates stay NULL.
create table public.employee_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 200),
  holiday_date date,
  notes text not null default '',
  source text not null default 'manual' check (source in ('manual', 'legacy', 'schedule')),
  source_schedule_id uuid references public.monthly_schedules(id) on delete set null,
  source_date date,
  source_unit integer not null default 1 check (source_unit in (1, 2)),
  used_schedule_id uuid references public.monthly_schedules(id) on delete restrict,
  used_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((used_schedule_id is null) = (used_date is null)),
  check ((source = 'schedule') = (source_date is not null))
);
create unique index employee_holidays_worked_day_unique
  on public.employee_holidays(organization_id, employee_id, source_date, source_unit)
  where source_date is not null;
create unique index employee_holidays_used_day_unique
  on public.employee_holidays(organization_id, employee_id, used_date)
  where used_date is not null;
create index employee_holidays_organization_employee_idx
  on public.employee_holidays(organization_id, employee_id);
create trigger employee_holidays_updated_at before update on public.employee_holidays
  for each row execute function public.set_updated_at();

insert into public.employee_holidays(organization_id, employee_id, name, source)
select b.organization_id, b.employee_id, 'Feriado de origem desconhecida', 'legacy'
from public.employee_ff_balances b cross join lateral generate_series(1, b.ff_days) n;

alter table public.employee_holidays enable row level security;
create policy "Members read holiday ledger" on public.employee_holidays for select
  to authenticated using (organization_id = public.my_organization_id());
-- All mutations use RPCs so the ledger and the existing displayed balance stay atomic.
revoke insert, update, delete on public.employee_holidays from authenticated, anon;
drop policy if exists "Organization admins can insert employee FF balances" on public.employee_ff_balances;
drop policy if exists "Organization admins can update employee FF balances" on public.employee_ff_balances;
drop policy if exists "Organization admins can delete employee FF balances" on public.employee_ff_balances;

create function public.refresh_holiday_balances(p_org uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.employee_ff_balances(organization_id, employee_id, ff_days)
  select e.organization_id, e.id, count(h.id) filter (where h.used_date is null)::integer
  from public.employees e left join public.employee_holidays h on h.employee_id = e.id and h.organization_id = e.organization_id
  where e.organization_id = p_org group by e.organization_id, e.id
  on conflict (organization_id, employee_id) do update set ff_days = excluded.ff_days, updated_at = now();
$$;
revoke all on function public.refresh_holiday_balances(uuid) from public, anon, authenticated;

create function public.manage_employee_holiday(p_id uuid, p_employee uuid, p_name text, p_date date, p_notes text, p_delete boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.my_organization_id(); v_row public.employee_holidays;
begin
  if v_org is null or not public.is_admin_user() then raise exception 'Sem permissão para gerir feriados.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));
  if p_id is not null then
    select * into v_row from public.employee_holidays where id = p_id and organization_id = v_org for update;
    if not found then raise exception 'Feriado não encontrado.'; end if;
    if p_delete then
      if v_row.used_date is not null then raise exception 'Este feriado já foi usado no calendário.'; end if;
      delete from public.employee_holidays where id = p_id;
      perform public.refresh_holiday_balances(v_org);
      return;
    end if;
  end if;
  if not exists (select 1 from public.employees where id = p_employee and organization_id = v_org and role = 'nurse') then
    raise exception 'Enfermeiro inválido.';
  end if;
  if p_id is null then
    insert into public.employee_holidays(organization_id, employee_id, name, holiday_date, notes)
    values(v_org, p_employee, trim(p_name), p_date, coalesce(p_notes, ''));
  else
    if v_row.employee_id <> p_employee then raise exception 'Não é possível transferir o feriado para outro enfermeiro.'; end if;
    update public.employee_holidays set name = trim(p_name), holiday_date = p_date, notes = coalesce(p_notes, '') where id = p_id;
  end if;
  perform public.refresh_holiday_balances(v_org);
end;
$$;
revoke all on function public.manage_employee_holiday(uuid, uuid, text, date, text, boolean) from public, anon;
grant execute on function public.manage_employee_holiday(uuid, uuid, text, date, text, boolean) to authenticated;

-- Called exclusively by the explicit schedule validation action. A transaction and
-- organization lock prevent duplicate credits and concurrent spending of a day.
create function public.validate_schedule_holidays(p_schedule uuid, p_holidays jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.my_organization_id(); v_schedule public.monthly_schedules;
  v_entry record; v_credit uuid;
begin
  if v_org is null or not public.is_admin_user() then raise exception 'Sem permissão para validar feriados.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_org::text, 0));
  select * into v_schedule from public.monthly_schedules where id = p_schedule and organization_id = v_org for update;
  if not found then raise exception 'Horário inválido.'; end if;

  -- Release this schedule's earlier deductions before rebuilding them.
  update public.employee_holidays set used_date = null, used_schedule_id = null where used_schedule_id = p_schedule and organization_id = v_org;

  -- Reconcile previously credited shifts, including changes after validation.
  for v_entry in select h.* from public.employee_holidays h
    where h.organization_id = v_org and h.source_schedule_id = p_schedule and not exists (
      select 1 from public.schedule_entries e join public.shift_types s on s.id = e.shift_type_id
      join jsonb_to_recordset(p_holidays) as d(holiday_date date, name text) on d.holiday_date = e.work_date
      where e.schedule_id = p_schedule and e.employee_id = h.employee_id and e.work_date = h.source_date
        and e.work_date >= v_schedule.month and e.work_date < v_schedule.month + interval '1 month'
        and s.code not in ('F','FF','Fe','B','FA')
        and (h.source_unit = 1 or extract(isodow from e.work_date) in (6,7))
        and h.source_unit > (select count(*) from public.employee_holidays m where m.organization_id = v_org and m.employee_id = e.employee_id and m.holiday_date = e.work_date and m.source <> 'schedule')
    )
  loop
    if v_entry.used_date is not null then raise exception 'Um feriado removido deste horário já foi usado noutro mês. Corrige primeiro esse desconto.'; end if;
    delete from public.employee_holidays where id = v_entry.id;
  end loop;

  insert into public.employee_holidays(organization_id, employee_id, name, holiday_date, source, source_schedule_id, source_date, source_unit)
  select distinct v_org, e.employee_id, d.name, e.work_date, 'schedule', p_schedule, e.work_date, n.unit
  from public.schedule_entries e join public.shift_types s on s.id = e.shift_type_id
  join public.employees emp on emp.id = e.employee_id and emp.organization_id = v_org and emp.role = 'nurse'
  join jsonb_to_recordset(p_holidays) as d(holiday_date date, name text) on d.holiday_date = e.work_date
  cross join lateral generate_series(1, case when extract(isodow from e.work_date) in (6,7) then 2 else 1 end) n(unit)
  where e.schedule_id = p_schedule and s.code not in ('F','FF','Fe','B','FA')
    and e.work_date >= v_schedule.month and e.work_date < v_schedule.month + interval '1 month'
    and n.unit > (select count(*) from public.employee_holidays m where m.organization_id = v_org and m.employee_id = e.employee_id and m.holiday_date = e.work_date and m.source <> 'schedule')
  on conflict do nothing;

  for v_entry in
    select e.employee_id, e.work_date, emp.name from public.schedule_entries e
    join public.shift_types s on s.id = e.shift_type_id
    join public.employees emp on emp.id = e.employee_id and emp.organization_id = v_org and emp.role = 'nurse'
    where e.schedule_id = p_schedule and s.code = 'FF'
      and e.work_date >= v_schedule.month and e.work_date < v_schedule.month + interval '1 month'
    order by e.work_date, e.employee_id
  loop
    -- One deduction per employee/date, even across location schedules.
    if exists (select 1 from public.employee_holidays where organization_id = v_org and employee_id = v_entry.employee_id and used_date = v_entry.work_date) then continue; end if;
    select id into v_credit from public.employee_holidays
      where organization_id = v_org and employee_id = v_entry.employee_id and used_date is null
        and (holiday_date is null or holiday_date <= v_entry.work_date)
      order by holiday_date nulls first, created_at, id limit 1 for update;
    if v_credit is null then raise exception 'Saldo de feriados insuficiente para % em %.', v_entry.name, to_char(v_entry.work_date, 'DD/MM/YYYY'); end if;
    update public.employee_holidays set used_schedule_id = p_schedule, used_date = v_entry.work_date where id = v_credit;
  end loop;
  perform public.refresh_holiday_balances(v_org);
end;
$$;
revoke all on function public.validate_schedule_holidays(uuid, jsonb) from public, anon;
grant execute on function public.validate_schedule_holidays(uuid, jsonb) to authenticated;
