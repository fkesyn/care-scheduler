update public.profiles
set role = 'admin'
where lower(trim(email)) in (
  'fabio.gomes.mota@gmail.com',
 'sfpsclaro@hotmail.com'
);

create or replace function public.current_user_role()
returns text
language plpgsql
security definer
set search_path = public
as $current_user_role$
declare
  jwt_email text;
begin
  if auth.uid() is null then
    return 'viewer';
  end if;

  jwt_email := lower(trim(coalesce(auth.jwt()->>'email', '')));

  if jwt_email in (
    'fabio.gomes.mota@gmail.com',
  'sfpsclaro@hotmail.com'
  )
  then
    return 'admin';
  end if;

  return 'viewer';
end;
$current_user_role$;

grant execute on function public.current_user_role() to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $handle_new_user_profile$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case
      when lower(trim(new.email)) in (
        'fabio.gomes.mota@gmail.com',
        'sfpsclaro@hotmail.com'
      )
      then 'admin'
      else 'viewer'
    end
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = case
      when lower(trim(excluded.email)) in (
        'fabio.gomes.mota@gmail.com',
        'sfpsclaro@hotmail.com'
      )
      then 'admin'
      else public.profiles.role
    end;

  return new;
end;
$handle_new_user_profile$;
