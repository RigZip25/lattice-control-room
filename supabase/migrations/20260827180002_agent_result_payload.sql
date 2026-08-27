alter table public.execution_job
  add column if not exists result_payload jsonb;

create or replace function public.complete_execution_job(
  p_workspace_id uuid,
  p_job_id text,
  p_lease_token text,
  p_result_ref text,
  p_result_payload jsonb
)
returns public.execution_job
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare completed public.execution_job%rowtype;
begin
  if p_result_payload is null
    or p_result_payload ->> 'mode' <> 'DRY_RUN'
    or coalesce((p_result_payload ->> 'externalEffects')::integer, -1) <> 0 then
    raise exception 'invalid governed result payload';
  end if;

  update public.execution_job
  set state = 'SUCCEEDED', result_ref = p_result_ref,
      result_payload = p_result_payload,
      lease_owner = null, lease_token = null, lease_expires_at = null,
      last_error = null, updated_at = clock_timestamp()
  where workspace_id = p_workspace_id and job_id = p_job_id
    and state = 'LEASED' and lease_token = p_lease_token
    and lease_expires_at > clock_timestamp()
  returning * into completed;
  if completed.job_id is null then raise exception 'lease is stale or invalid'; end if;
  return completed;
end;
$$;

revoke execute on function public.complete_execution_job(uuid,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.complete_execution_job(uuid,text,text,text,jsonb) to service_role;

