create or replace function public.delete_approved_vacation_request(
  p_request_id uuid
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

  delete from public.vacation_requests request
  where request.id = p_request_id
    and request.organization_id = public.my_organization_id()
    and request.status = 'approved';

  if not found then
    raise exception 'Approved vacation request not found';
  end if;
end;
$delete_approved_vacation_request$;

grant execute on function public.delete_approved_vacation_request(uuid)
to authenticated;
