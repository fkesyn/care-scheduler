create or replace function public.my_organization_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  found_organization_id uuid;
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

  return null;
end;
$$;

grant execute on function public.my_organization_id() to authenticated;

drop policy if exists "Authenticated users can read locations" on public.locations;
drop policy if exists "Authenticated users can insert locations" on public.locations;
drop policy if exists "Authenticated users can update locations" on public.locations;

drop policy if exists "Organization members can read locations" on public.locations;
create policy "Organization members can read locations"
on public.locations
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert locations" on public.locations;
create policy "Organization members can insert locations"
on public.locations
for insert
to authenticated
with check (organization_id = public.my_organization_id());

drop policy if exists "Organization members can update locations" on public.locations;
create policy "Organization members can update locations"
on public.locations
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (organization_id = public.my_organization_id());
