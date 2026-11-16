create or replace function public.prevent_vacation_on_public_holiday()
returns trigger
language plpgsql
set search_path = public
as $prevent_vacation_on_public_holiday$
begin
  if exists (
    select 1 from public.public_holidays holiday
    where holiday.country_code = 'PT'
      and holiday.holiday_date = new.vacation_date
  ) then
    raise exception 'Vacation dates cannot be public holidays';
  end if;

  return new;
end;
$prevent_vacation_on_public_holiday$;

drop trigger if exists vacation_request_days_reject_public_holidays
on public.vacation_request_days;
create trigger vacation_request_days_reject_public_holidays
before insert or update of vacation_date on public.vacation_request_days
for each row execute function public.prevent_vacation_on_public_holiday();
