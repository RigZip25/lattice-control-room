begin;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_workspace_id uuid;
begin
  if new.id is null then
    raise exception 'Authenticated user id is required';
  end if;

  insert into public.workspace (name, mode)
  values ('Lattice workspace', 'DRY_RUN')
  returning workspace_id into new_workspace_id;

  insert into public.workspace_member (workspace_id, user_id, member_role)
  values (new_workspace_id, new.id, 'OWNER');

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;

create trigger provision_lattice_workspace
after insert on auth.users
for each row execute function private.handle_new_auth_user();

grant insert, update on public.brand, public.brand_source, public.market to authenticated;

create policy brand_member_insert on public.brand
for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)));

create policy brand_member_update on public.brand
for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

create policy brand_source_member_insert on public.brand_source
for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)));

create policy brand_source_member_update on public.brand_source
for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

create policy market_member_insert on public.market
for insert to authenticated
with check ((select private.is_workspace_member(workspace_id)));

create policy market_member_update on public.market
for update to authenticated
using ((select private.is_workspace_member(workspace_id)))
with check ((select private.is_workspace_member(workspace_id)));

commit;
