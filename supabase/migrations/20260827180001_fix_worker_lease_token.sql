create or replace function public.claim_execution_job(
  p_workspace_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 30
)
returns setof public.execution_job
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  claimed public.execution_job%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) < 3 or p_lease_seconds not between 5 and 300 then
    raise exception 'invalid worker lease request';
  end if;

  select job.* into claimed
  from public.execution_job job
  where job.workspace_id = p_workspace_id
    and (
      (job.state in ('PENDING','RETRY_WAIT') and job.available_at <= clock_timestamp())
      or (job.state = 'LEASED' and job.lease_expires_at <= clock_timestamp())
    )
    and not exists (
      select 1 from public.execution_job predecessor
      where predecessor.workspace_id = job.workspace_id
        and predecessor.cycle_id = job.cycle_id
        and predecessor.stage_order < job.stage_order
        and predecessor.state <> 'SUCCEEDED'
    )
  order by job.created_at, job.stage_order
  for update skip locked
  limit 1;

  if claimed.job_id is null then return; end if;

  update public.execution_job
  set state = 'LEASED', attempts = attempts + 1,
      lease_owner = trim(p_worker_id),
      lease_token = replace(gen_random_uuid()::text, '-', ''),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = clock_timestamp()
  where workspace_id = claimed.workspace_id and job_id = claimed.job_id
  returning * into claimed;

  return next claimed;
end;
$$;

revoke execute on function public.claim_execution_job(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.claim_execution_job(uuid,text,integer) to service_role;
