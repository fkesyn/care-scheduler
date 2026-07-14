update public.services
set measurement_type = 'blood_pressure'
where measurement_type is null
  and (
    lower(trim(name)) = 'ta'
    or lower(name) like '%tensão arterial%'
    or lower(name) like '%tensao arterial%'
    or lower(name) like '%pressão arterial%'
    or lower(name) like '%pressao arterial%'
  );

update public.services
set measurement_type = 'glucose'
where measurement_type is null
  and (
    lower(name) like '%glicémia%'
    or lower(name) like '%glicemia%'
    or lower(name) like '%glucose%'
  );

update public.services
set measurement_type = 'wound_care'
where measurement_type is null
  and lower(name) like '%ferida%';
