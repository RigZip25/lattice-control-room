create or replace function public.reserve_ai_generation(
  p_generation_id text,
  p_workspace_id uuid,
  p_brand_id text,
  p_purpose text,
  p_prompt_version text,
  p_model text,
  p_input_refs jsonb,
  p_estimated_cost_usd numeric,
  p_cycle_limit_usd numeric default 0.25,
  p_monthly_limit_usd numeric default 20
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monthly_reserved numeric;
begin
  if p_estimated_cost_usd < 0 or p_estimated_cost_usd > p_cycle_limit_usd then
    raise exception 'AI_CYCLE_BUDGET_EXCEEDED';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_workspace_id::text || ':ai-budget'));
  select coalesce(sum(estimated_cost_usd), 0) into v_monthly_reserved
  from public.ai_generation
  where workspace_id = p_workspace_id
    and created_at >= date_trunc('month', now())
    and status in ('STARTED','COMPLETED');
  if v_monthly_reserved + p_estimated_cost_usd > p_monthly_limit_usd then
    raise exception 'AI_MONTHLY_BUDGET_EXCEEDED';
  end if;
  insert into public.ai_generation(generation_id, workspace_id, brand_id, purpose, prompt_version, model, status, input_refs, estimated_cost_usd)
  values (p_generation_id, p_workspace_id, p_brand_id, p_purpose, p_prompt_version, p_model, 'STARTED', coalesce(p_input_refs, '[]'::jsonb), p_estimated_cost_usd);
  return jsonb_build_object('reserved', true, 'monthly_reserved_usd', v_monthly_reserved + p_estimated_cost_usd, 'monthly_limit_usd', p_monthly_limit_usd);
end;
$$;

revoke all on function public.reserve_ai_generation(text,uuid,text,text,text,text,jsonb,numeric,numeric,numeric) from public, anon, authenticated;
comment on function public.reserve_ai_generation is 'Atomically enforces per-cycle and monthly AI budgets before an external model call.';
