drop policy if exists "Organization members can delete locations" on public.locations;
create policy "Organization members can delete locations"
on public.locations
for delete
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can delete patients" on public.patients;
create policy "Organization members can delete patients"
on public.patients
for delete
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can delete services" on public.services;
create policy "Organization members can delete services"
on public.services
for delete
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can delete employees" on public.employees;
create policy "Organization members can delete employees"
on public.employees
for delete
to authenticated
using (organization_id = public.my_organization_id());

drop policy if exists "Organization members can delete appointments" on public.appointments;
create policy "Organization members can delete appointments"
on public.appointments
for delete
to authenticated
using (organization_id = public.my_organization_id());
