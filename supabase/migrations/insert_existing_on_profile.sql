insert into public.profiles (id, email, full_name)
select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data->>'full_name', u.email)
from auth.users u
         left join public.profiles p on p.id = u.id
where p.id is null;