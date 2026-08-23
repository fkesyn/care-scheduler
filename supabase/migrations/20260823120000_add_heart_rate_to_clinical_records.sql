alter table public.appointment_clinical_records
add column if not exists heart_rate_value integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.appointment_clinical_records'::regclass
      and conname = 'appointment_clinical_records_heart_rate_check'
  ) then
    alter table public.appointment_clinical_records
    add constraint appointment_clinical_records_heart_rate_check
    check (
      heart_rate_value is null
      or (heart_rate_value > 0 and heart_rate_value <= 300)
    );
  end if;
end;
$$;

notify pgrst, 'reload schema';
