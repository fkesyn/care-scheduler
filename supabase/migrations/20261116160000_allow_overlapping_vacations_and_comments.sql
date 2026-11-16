alter table public.vacation_requests
drop constraint if exists vacation_requests_status_check;

alter table public.vacation_requests
add constraint vacation_requests_status_check
check (status in ('pending', 'approved', 'rejected', 'canceled'));

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

drop function if exists public.delete_approved_vacation_request(uuid);

create or replace function public.delete_approved_vacation_request(
  p_request_id uuid,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $delete_approved_vacation_request$
begin
  if auth.uid() is null or not public.is_admin_user() then
    raise exception 'Admin access required';
  end if;

  update public.vacation_requests request
  set status = 'canceled',
      reviewed_by = auth.uid(),
      reviewed_by_name = coalesce(
        (select coalesce(nullif(profile.full_name, ''), profile.email)
         from public.profiles profile where profile.id = auth.uid()),
        auth.jwt()->>'email',
        'Admin'
      ),
      reviewed_at = now(),
      rejection_reason = nullif(trim(p_comment), '')
  where request.id = p_request_id
    and request.organization_id = public.my_organization_id()
    and request.status = 'approved';

  if not found then
    raise exception 'Approved vacation request not found';
  end if;
end;
$delete_approved_vacation_request$;

grant execute on function public.delete_approved_vacation_request(uuid, text)
to authenticated;
