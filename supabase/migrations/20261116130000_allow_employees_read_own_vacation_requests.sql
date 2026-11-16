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
