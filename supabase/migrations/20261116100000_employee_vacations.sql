create table if not exists public.vacation_year_settings (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  is_open boolean not null default false,
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, year),
  constraint vacation_year_settings_year_check check (year >= 2027)
);

create table if not exists public.employee_vacation_allowances (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year integer not null,
  total_days integer not null default 22,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (employee_id, year),
  constraint employee_vacation_allowances_year_check check (year >= 2027),
  constraint employee_vacation_allowances_days_check check (total_days >= 22)
);

create table if not exists public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year integer not null,
  status text not null default 'pending',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vacation_requests_year_check check (year >= 2027),
  constraint vacation_requests_status_check check (status in ('pending', 'approved', 'rejected'))
);

create table if not exists public.vacation_request_days (
  request_id uuid not null references public.vacation_requests(id) on delete cascade,
  vacation_date date not null,
  primary key (request_id, vacation_date),
  constraint vacation_request_days_weekday_check
    check (extract(isodow from vacation_date) between 1 and 5)
);

create index if not exists vacation_requests_organization_year_idx
  on public.vacation_requests(organization_id, year, status);
create index if not exists vacation_requests_employee_year_idx
  on public.vacation_requests(employee_id, year, status);
create index if not exists vacation_request_days_date_idx
  on public.vacation_request_days(vacation_date);

drop trigger if exists vacation_year_settings_set_updated_at on public.vacation_year_settings;
create trigger vacation_year_settings_set_updated_at
before update on public.vacation_year_settings
for each row execute function public.set_updated_at();

drop trigger if exists employee_vacation_allowances_set_updated_at on public.employee_vacation_allowances;
create trigger employee_vacation_allowances_set_updated_at
before update on public.employee_vacation_allowances
for each row execute function public.set_updated_at();

drop trigger if exists vacation_requests_set_updated_at on public.vacation_requests;
create trigger vacation_requests_set_updated_at
before update on public.vacation_requests
for each row execute function public.set_updated_at();

alter table public.vacation_year_settings enable row level security;
alter table public.employee_vacation_allowances enable row level security;
alter table public.vacation_requests enable row level security;
alter table public.vacation_request_days enable row level security;

drop policy if exists "Organization members can read vacation year settings"
on public.vacation_year_settings;
create policy "Organization members can read vacation year settings"
on public.vacation_year_settings for select to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization admins can manage vacation year settings"
on public.vacation_year_settings;
create policy "Organization admins can manage vacation year settings"
on public.vacation_year_settings for all to authenticated
using (organization_id = public.my_organization_id() and public.is_admin_user())
with check (organization_id = public.my_organization_id() and public.is_admin_user());

drop policy if exists "Employees can read own vacation allowance"
on public.employee_vacation_allowances;
create policy "Employees can read own vacation allowance"
on public.employee_vacation_allowances for select to authenticated
using (
  organization_id = public.my_organization_id()
  and (
    public.is_admin_user()
    or exists (
      select 1 from public.employees employee
      where employee.id = employee_id
        and employee.organization_id = public.my_organization_id()
        and lower(employee.email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
);

drop policy if exists "Organization admins can manage vacation allowances"
on public.employee_vacation_allowances;
create policy "Organization admins can manage vacation allowances"
on public.employee_vacation_allowances for all to authenticated
using (organization_id = public.my_organization_id() and public.is_admin_user())
with check (organization_id = public.my_organization_id() and public.is_admin_user());

drop policy if exists "Members can read approved vacations and admins all requests"
on public.vacation_requests;
create policy "Members can read approved vacations and admins all requests"
on public.vacation_requests for select to authenticated
using (
  organization_id = public.my_organization_id()
  and (
    status = 'approved'
    or public.is_admin_user()
    or exists (
      select 1 from public.employees employee
      where employee.id = employee_id
        and employee.organization_id = public.my_organization_id()
        and lower(employee.email) = lower(coalesce(auth.jwt()->>'email', ''))
    )
  )
);

drop policy if exists "Members can read approved vacation days and admins all days"
on public.vacation_request_days;
create policy "Members can read approved vacation days and admins all days"
on public.vacation_request_days for select to authenticated
using (
  exists (
    select 1 from public.vacation_requests request
    where request.id = request_id
      and request.organization_id = public.my_organization_id()
      and (
        request.status = 'approved'
        or public.is_admin_user()
        or exists (
          select 1 from public.employees employee
          where employee.id = request.employee_id
            and employee.organization_id = public.my_organization_id()
            and lower(employee.email) = lower(coalesce(auth.jwt()->>'email', ''))
        )
      )
  )
);

drop policy if exists "Organization admins can update vacation requests"
on public.vacation_requests;
create policy "Organization admins can update vacation requests"
on public.vacation_requests for update to authenticated
using (organization_id = public.my_organization_id() and public.is_admin_user())
with check (organization_id = public.my_organization_id() and public.is_admin_user());

create or replace function public.request_vacation(p_dates date[])
returns uuid
language plpgsql
security definer
set search_path = public
as $request_vacation$
declare
  current_organization_id uuid;
  current_employee_id uuid;
  requested_year integer;
  allowance integer;
  already_committed integer;
  requested_count integer;
  created_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  current_organization_id := public.my_organization_id();
  if current_organization_id is null then
    raise exception 'Organization not found';
  end if;

  select employee.id into current_employee_id
  from public.employees employee
  where employee.organization_id = current_organization_id
    and coalesce(employee.active, true) = true
    and lower(employee.email) = lower(coalesce(auth.jwt()->>'email', ''))
  order by employee.name
  limit 1;

  if current_employee_id is null then
    raise exception 'Employee not found for user';
  end if;

  if p_dates is null or cardinality(p_dates) = 0 then
    raise exception 'Select at least one vacation day';
  end if;

  select count(distinct selected_date), min(extract(year from selected_date)::integer)
  into requested_count, requested_year
  from unnest(p_dates) selected_date;

  if requested_count <> cardinality(p_dates) then
    raise exception 'Duplicate vacation dates are not allowed';
  end if;

  if requested_year < 2027
    or exists (
      select 1 from unnest(p_dates) selected_date
      where extract(year from selected_date)::integer <> requested_year
         or extract(isodow from selected_date) not between 1 and 5
         or selected_date < current_date
    )
  then
    raise exception 'Vacation dates must be weekdays in the same year from 2027 onward';
  end if;

  if not exists (
    select 1 from public.vacation_year_settings setting
    where setting.organization_id = current_organization_id
      and setting.year = requested_year
      and setting.is_open = true
  ) and not (
    requested_year = 2027
    and not exists (
      select 1 from public.vacation_year_settings setting
      where setting.organization_id = current_organization_id
        and setting.year = requested_year
    )
  ) then
    raise exception 'Vacation year is locked';
  end if;

  if exists (
    select 1
    from public.vacation_request_days request_day
    join public.vacation_requests request on request.id = request_day.request_id
    where request.organization_id = current_organization_id
      and request.status = 'approved'
      and request_day.vacation_date = any(p_dates)
  ) then
    raise exception 'One or more selected days are unavailable';
  end if;

  if exists (
    select 1
    from public.vacation_request_days request_day
    join public.vacation_requests request on request.id = request_day.request_id
    where request.employee_id = current_employee_id
      and request.status in ('pending', 'approved')
      and request_day.vacation_date = any(p_dates)
  ) then
    raise exception 'One or more selected days are already in your requests';
  end if;

  select coalesce(custom_allowance.total_days, 22)
  into allowance
  from (select 1) seed
  left join public.employee_vacation_allowances custom_allowance
    on custom_allowance.employee_id = current_employee_id
   and custom_allowance.year = requested_year;

  select count(*) into already_committed
  from public.vacation_request_days request_day
  join public.vacation_requests request on request.id = request_day.request_id
  where request.employee_id = current_employee_id
    and request.year = requested_year
    and request.status in ('pending', 'approved');

  if already_committed + requested_count > allowance then
    raise exception 'Vacation allowance exceeded';
  end if;

  insert into public.vacation_requests (
    organization_id, employee_id, year, requested_by
  ) values (
    current_organization_id, current_employee_id, requested_year, auth.uid()
  ) returning id into created_request_id;

  insert into public.vacation_request_days (request_id, vacation_date)
  select created_request_id, selected_date
  from unnest(p_dates) selected_date;

  return created_request_id;
end;
$request_vacation$;

grant execute on function public.request_vacation(date[]) to authenticated;

create or replace function public.my_vacation_balance(p_year integer)
returns table (
  employee_id uuid,
  total_days integer,
  approved_days bigint,
  pending_days bigint
)
language sql
stable
security definer
set search_path = public
as $my_vacation_balance$
  with current_employee as (
    select employee.id
    from public.employees employee
    where employee.organization_id = public.my_organization_id()
      and coalesce(employee.active, true) = true
      and lower(employee.email) = lower(coalesce(auth.jwt()->>'email', ''))
    order by employee.name
    limit 1
  )
  select
    current_employee.id,
    coalesce(allowance.total_days, 22),
    count(request_day.vacation_date) filter (where request.status = 'approved'),
    count(request_day.vacation_date) filter (where request.status = 'pending')
  from current_employee
  left join public.employee_vacation_allowances allowance
    on allowance.employee_id = current_employee.id
   and allowance.year = p_year
  left join public.vacation_requests request
    on request.employee_id = current_employee.id
   and request.year = p_year
   and request.status in ('approved', 'pending')
  left join public.vacation_request_days request_day
    on request_day.request_id = request.id
  group by current_employee.id, allowance.total_days;
$my_vacation_balance$;

grant execute on function public.my_vacation_balance(integer) to authenticated;

create or replace function public.review_vacation_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $review_vacation_request$
declare
  current_organization_id uuid;
  target_request public.vacation_requests%rowtype;
  reviewer_name text;
  allowance integer;
  approved_count integer;
  request_count integer;
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid review decision';
  end if;

  current_organization_id := public.my_organization_id();

  select * into target_request
  from public.vacation_requests request
  where request.id = p_request_id
    and request.organization_id = current_organization_id
  for update;

  if not found or target_request.status <> 'pending' then
    raise exception 'Pending vacation request not found';
  end if;

  select coalesce(nullif(profile.full_name, ''), profile.email, auth.jwt()->>'email')
  into reviewer_name
  from public.profiles profile
  where profile.id = auth.uid();

  if p_decision = 'approved' then
    perform pg_advisory_xact_lock(
      hashtextextended(
        current_organization_id::text || ':' || target_request.year::text,
        0
      )
    );

    if exists (
      select 1
      from public.vacation_request_days target_day
      join public.vacation_request_days approved_day
        on approved_day.vacation_date = target_day.vacation_date
      join public.vacation_requests approved_request
        on approved_request.id = approved_day.request_id
      where target_day.request_id = p_request_id
        and approved_request.organization_id = current_organization_id
        and approved_request.status = 'approved'
    ) then
      raise exception 'One or more days were already approved for another employee';
    end if;

    select coalesce(custom_allowance.total_days, 22)
    into allowance
    from (select 1) seed
    left join public.employee_vacation_allowances custom_allowance
      on custom_allowance.employee_id = target_request.employee_id
     and custom_allowance.year = target_request.year;

    select count(*) into approved_count
    from public.vacation_request_days request_day
    join public.vacation_requests request on request.id = request_day.request_id
    where request.employee_id = target_request.employee_id
      and request.year = target_request.year
      and request.status = 'approved';

    select count(*) into request_count
    from public.vacation_request_days request_day
    where request_day.request_id = p_request_id;

    if approved_count + request_count > allowance then
      raise exception 'Vacation allowance exceeded';
    end if;
  end if;

  update public.vacation_requests
  set status = p_decision,
      reviewed_by = auth.uid(),
      reviewed_by_name = coalesce(reviewer_name, auth.jwt()->>'email', 'Admin'),
      reviewed_at = now(),
      rejection_reason = case when p_decision = 'rejected' then nullif(trim(p_rejection_reason), '') else null end
  where id = p_request_id;
end;
$review_vacation_request$;

grant execute on function public.review_vacation_request(uuid, text, text) to authenticated;

insert into public.vacation_year_settings (organization_id, year, is_open, opened_at)
select organization.id, 2027, true, now()
from public.organizations organization
on conflict (organization_id, year) do nothing;
