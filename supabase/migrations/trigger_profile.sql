create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
insert into public.profiles (id, email, full_name)
values (
           new.id,
           new.email,
           coalesce(new.raw_user_meta_data->>'full_name', new.email)
       )
    on conflict (id) do nothing;

return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
    after insert on auth.users
    for each row
    execute function public.handle_new_user_profile();


