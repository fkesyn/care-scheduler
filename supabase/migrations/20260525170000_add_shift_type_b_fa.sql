do $seed_additional_shift_types$
begin
  if to_regclass('public.organizations') is null then
    return;
  end if;

  insert into public.shift_types (
    organization_id,
    code,
    name,
    description,
    display_order
  )
  select
    organization_item.id,
    seed.code,
    seed.name,
    seed.description,
    seed.display_order
  from public.organizations organization_item
  cross join (
    values
      ('B', 'Baixa', 'Baixa / Licença de Maternidade', 80),
      ('FA', 'Folga Aniversário', 'Folga Aniversário', 90)
  ) as seed(code, name, description, display_order)
  on conflict (organization_id, code) do update
  set
    name = excluded.name,
    description = excluded.description,
    display_order = excluded.display_order;
end;
$seed_additional_shift_types$;
