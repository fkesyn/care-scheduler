alter table public.locations
    add column if not exists color text not null default '#0f766e';

alter table public.locations
drop constraint if exists locations_color_hex_check;

alter table public.locations
    add constraint locations_color_hex_check
        check (color ~ '^#[0-9A-Fa-f]{6}$');
