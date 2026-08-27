alter table public.execution_job
  add column stage_order smallint;

update public.execution_job
set stage_order = case kind
  when 'PRODUCT_INTELLIGENCE' then 1 when 'PRODUCT_DIAGNOSIS' then 2
  when 'EXPANSION_THESIS' then 3 when 'EXPERIMENT_PLAN' then 4
  when 'CREATIVE_PROMPT' then 5 when 'LEGAL_REVIEW' then 6
  when 'PROVIDER_EXECUTION' then 7 when 'QA_REVIEW' then 8
  when 'LIBRARY_INGEST' then 9 when 'DISTRIBUTION_PLAN' then 10
  when 'METRIC_INGEST' then 11 when 'LEARNING_EVALUATION' then 12
  when 'CAPITAL_RECOMMENDATION' then 13
end;

alter table public.execution_job
  alter column stage_order set not null,
  add constraint execution_job_stage_order_check check (stage_order between 1 and 13),
  add constraint execution_job_cycle_stage_unique unique (workspace_id, cycle_id, stage_order);

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
  set state = 'LEASED',
      attempts = attempts + 1,
      lease_owner = trim(p_worker_id),
      lease_token = replace(gen_random_uuid()::text, '-', ''),
      lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
      updated_at = clock_timestamp()
  where workspace_id = claimed.workspace_id and job_id = claimed.job_id
  returning * into claimed;

  return next claimed;
end;
$$;

create or replace function public.complete_execution_job(
  p_workspace_id uuid,
  p_job_id text,
  p_lease_token text,
  p_result_ref text
)
returns public.execution_job
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare completed public.execution_job%rowtype;
begin
  update public.execution_job
  set state = 'SUCCEEDED', result_ref = p_result_ref,
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

create or replace function public.fail_execution_job(
  p_workspace_id uuid,
  p_job_id text,
  p_lease_token text,
  p_error jsonb,
  p_retry_seconds integer default 5
)
returns public.execution_job
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare failed public.execution_job%rowtype;
begin
  update public.execution_job
  set state = case when attempts >= maximum_attempts then 'DEAD_LETTER' else 'RETRY_WAIT' end,
      available_at = case when attempts >= maximum_attempts then available_at else clock_timestamp() + make_interval(secs => greatest(1, least(p_retry_seconds, 3600))) end,
      last_error = coalesce(p_error, '{"message":"unknown worker error"}'::jsonb),
      lease_owner = null, lease_token = null, lease_expires_at = null,
      updated_at = clock_timestamp()
  where workspace_id = p_workspace_id and job_id = p_job_id
    and state = 'LEASED' and lease_token = p_lease_token
  returning * into failed;
  if failed.job_id is null then raise exception 'lease is stale or invalid'; end if;
  return failed;
end;
$$;

revoke execute on function public.claim_execution_job(uuid,text,integer) from public, anon, authenticated;
revoke execute on function public.complete_execution_job(uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.fail_execution_job(uuid,text,text,jsonb,integer) from public, anon, authenticated;
grant execute on function public.claim_execution_job(uuid,text,integer) to service_role;
grant execute on function public.complete_execution_job(uuid,text,text,text) to service_role;
grant execute on function public.fail_execution_job(uuid,text,text,jsonb,integer) to service_role;
