do $remove_sao_pedro_holiday$
begin
  if to_regclass('public.public_holidays') is null then
    return;
  end if;

  delete from public.public_holidays
  where country_code = 'PT'
    and holiday_date::text like '%-06-29'
    and coalesce(region, '') = 'povoa';
end;
$remove_sao_pedro_holiday$;
