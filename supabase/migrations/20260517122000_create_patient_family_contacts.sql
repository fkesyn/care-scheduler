create table if not exists public.patient_family_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  relationship text not null,
  contact text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patient_family_contacts_name_check check (length(trim(name)) > 0),
  constraint patient_family_contacts_relationship_check check (length(trim(relationship)) > 0),
  constraint patient_family_contacts_contact_check check (length(trim(contact)) > 0)
);

do $$
begin
  if to_regclass('public.organizations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'patient_family_contacts_organization_id_fkey'
    )
  then
    alter table public.patient_family_contacts
    add constraint patient_family_contacts_organization_id_fkey
    foreign key (organization_id)
    references public.organizations(id)
    on delete cascade;
  end if;
end;
$$;

alter table public.patient_family_contacts enable row level security;

create index if not exists patient_family_contacts_organization_id_idx
  on public.patient_family_contacts(organization_id);

create index if not exists patient_family_contacts_patient_id_idx
  on public.patient_family_contacts(patient_id);

drop trigger if exists patient_family_contacts_set_updated_at
on public.patient_family_contacts;

create trigger patient_family_contacts_set_updated_at
before update on public.patient_family_contacts
for each row
execute function public.set_updated_at();

drop policy if exists "Organization members can read patient family contacts"
on public.patient_family_contacts;
create policy "Organization members can read patient family contacts"
on public.patient_family_contacts
for select
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can insert patient family contacts"
on public.patient_family_contacts;
create policy "Organization members can insert patient family contacts"
on public.patient_family_contacts
for insert
to authenticated
with check (
  organization_id = public.my_organization_id()
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_id
      and patient.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization members can update patient family contacts"
on public.patient_family_contacts;
create policy "Organization members can update patient family contacts"
on public.patient_family_contacts
for update
to authenticated
using (organization_id = public.my_organization_id())
with check (
  organization_id = public.my_organization_id()
  and exists (
    select 1
    from public.patients patient
    where patient.id = patient_id
      and patient.organization_id = public.my_organization_id()
  )
);

drop policy if exists "Organization members can delete patient family contacts"
on public.patient_family_contacts;
create policy "Organization members can delete patient family contacts"
on public.patient_family_contacts
for delete
to authenticated
using (organization_id = public.my_organization_id());
