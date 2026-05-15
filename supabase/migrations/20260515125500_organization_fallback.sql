create or replace function public.my_organization_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_organization_id uuid;
  organizations_count integer;
begin
  if to_regclass('public.profiles') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'organization_id'
    )
  then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'id'
    )
    then
      execute 'select organization_id from public.profiles where id = $1 limit 1'
        into found_organization_id
        using auth.uid();

      if found_organization_id is not null then
        return found_organization_id;
      end if;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'profiles'
        and column_name = 'user_id'
    )
    then
      execute 'select organization_id from public.profiles where user_id = $1 limit 1'
        into found_organization_id
        using auth.uid();

      if found_organization_id is not null then
        return found_organization_id;
      end if;
    end if;
  end if;

  if to_regclass('public.organization_members') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_members'
        and column_name = 'organization_id'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_members'
        and column_name = 'user_id'
    )
  then
    execute 'select organization_id from public.organization_members where user_id = $1 limit 1'
      into found_organization_id
      using auth.uid();

    if found_organization_id is not null then
      return found_organization_id;
    end if;
  end if;

  if to_regclass('public.organization_users') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_users'
        and column_name = 'organization_id'
    )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organization_users'
        and column_name = 'user_id'
    )
  then
    execute 'select organization_id from public.organization_users where user_id = $1 limit 1'
      into found_organization_id
      using auth.uid();

    if found_organization_id is not null then
      return found_organization_id;
    end if;
  end if;

  if to_regclass('public.organizations') is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'organizations'
        and column_name = 'id'
    )
  then
    execute 'select count(*) from public.organizations'
      into organizations_count;

    if organizations_count = 1 then
      execute 'select id from public.organizations limit 1'
        into found_organization_id;

      return found_organization_id;
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.my_organization_id() to authenticated;

create or replace function public.debug_auth_organization_context()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  organizations_count integer;
begin
  if to_regclass('public.organizations') is not null then
    execute 'select count(*) from public.organizations'
      into organizations_count;
  end if;

  return jsonb_build_object(
    'auth_uid', auth.uid(),
    'my_organization_id', public.my_organization_id(),
    'has_profiles', to_regclass('public.profiles') is not null,
    'has_organization_members', to_regclass('public.organization_members') is not null,
    'has_organization_users', to_regclass('public.organization_users') is not null,
    'has_organizations', to_regclass('public.organizations') is not null,
    'organizations_count', organizations_count
  );
end;
$$;

grant execute on function public.debug_auth_organization_context() to authenticated;
