begin;

create schema if not exists private;

create table public.workspace (
  workspace_id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 2),
  mode text not null default 'DRY_RUN' check (mode in ('DRY_RUN','LIVE')),
  created_at timestamptz not null default now()
);

create table public.workspace_member (
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null check (member_role in ('OWNER','ADMIN','ANALYST','VIEWER')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,user_id)
);

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_member membership
    where membership.workspace_id = target_workspace_id
      and membership.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_workspace_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;

create table public.brand (
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  brand_id text not null check (brand_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null,
  archetype text not null,
  profile jsonb not null,
  status text not null default 'DISCOVERY' check (status in ('DISCOVERY','PROVE','SCALE','MAINTAIN','PAUSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id,brand_id)
);

create table public.brand_source (
  workspace_id uuid not null,
  source_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  source_kind text not null check (source_kind in ('REPOSITORY','WEBSITE','DOCUMENT','ANALYTICS','INTERVIEW','ASSET_LIBRARY','EXTERNAL_RESEARCH')),
  source_uri text not null,
  content_hash text,
  semantic_state text not null default 'UNVERIFIED' check (semantic_state in ('UNVERIFIED','FACT','INFERENCE','REJECTED')),
  captured_at timestamptz not null default now(),
  primary key (workspace_id,source_id),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id) on delete cascade
);

create table public.market (
  workspace_id uuid not null,
  market_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  admin_unit_id text,
  display_name text not null,
  stage text not null default 'DISCOVERY' check (stage in ('DISCOVERY','PROVE','SCALE','MAINTAIN','PAUSED')),
  penetration numeric not null default 0 check (penetration between 0 and 100),
  created_at timestamptz not null default now(),
  primary key (workspace_id,market_id),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id) on delete cascade
);

create table public.production_job (
  workspace_id uuid not null,
  job_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  market_id uuid,
  idempotency_key text not null,
  capability text not null,
  stage text not null check (stage in ('EVIDENCE','PROMPT','LEGAL','EXECUTION','QA','REWORK','LIBRARY','FAILED')),
  priority integer not null default 100 check (priority between 0 and 1000),
  prompt text,
  reference_ids jsonb not null default '[]'::jsonb,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  maximum_attempts integer not null default 3 check (maximum_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id,job_id),
  unique (workspace_id,idempotency_key),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id),
  foreign key (workspace_id,market_id) references public.market(workspace_id,market_id)
);

create table public.creative_asset (
  workspace_id uuid not null,
  asset_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  job_id uuid not null,
  object_key text not null,
  content_hash text not null,
  format text not null,
  mime_type text not null,
  bytes bigint not null check (bytes > 0),
  version integer not null check (version > 0),
  locale text not null,
  territories jsonb not null default '[]'::jsonb,
  rights jsonb not null,
  lineage jsonb not null,
  state text not null check (state in ('APPROVED','ARCHIVED','BLOCKED')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,asset_id),
  unique (workspace_id,content_hash),
  unique (workspace_id,object_key),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id),
  foreign key (workspace_id,job_id) references public.production_job(workspace_id,job_id)
);

create table public.influencer_profile (
  workspace_id uuid not null,
  influencer_id uuid not null default gen_random_uuid(),
  platform text not null,
  handle text not null,
  profile jsonb not null,
  risk_flags jsonb not null default '[]'::jsonb,
  contact_state text not null check (contact_state in ('DISCOVERED','CONTACTABLE','DO_NOT_CONTACT')),
  created_at timestamptz not null default now(),
  primary key (workspace_id,influencer_id),
  unique (workspace_id,platform,handle)
);

create table public.influencer_engagement (
  workspace_id uuid not null,
  engagement_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  influencer_id uuid not null,
  stage text not null,
  compensation jsonb not null,
  deliverables jsonb not null,
  rights jsonb not null,
  disclosure_required boolean not null default true,
  owner_approval_required boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (workspace_id,engagement_id),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id),
  foreign key (workspace_id,influencer_id) references public.influencer_profile(workspace_id,influencer_id)
);

create table public.compliance_decision (
  workspace_id uuid not null,
  decision_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  job_id uuid,
  channel text not null,
  jurisdiction text not null,
  state text not null check (state in ('ALLOW','BLOCK','REQUIRE_REVIEW')),
  decided_by text not null check (decided_by = 'LEGAL_POLICY_AGENT'),
  policy_snapshot jsonb not null,
  reason_codes jsonb not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id,decision_id),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id),
  foreign key (workspace_id,job_id) references public.production_job(workspace_id,job_id)
);

create table public.distribution_queue_item (
  workspace_id uuid not null,
  queue_item_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  asset_id uuid not null,
  compliance_decision_id uuid not null,
  channel text not null,
  promotion_budget_usd numeric(18,2) not null check (promotion_budget_usd >= 0),
  state text not null check (state in ('BLOCKED','QUEUED','RUNNING','COMPLETED','FAILED')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (workspace_id,queue_item_id),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id),
  foreign key (workspace_id,asset_id) references public.creative_asset(workspace_id,asset_id),
  foreign key (workspace_id,compliance_decision_id) references public.compliance_decision(workspace_id,decision_id)
);

create table public.metric_observation (
  workspace_id uuid not null,
  observation_id uuid not null default gen_random_uuid(),
  brand_id text not null,
  market_id uuid,
  channel text not null,
  metric_key text not null,
  value numeric not null,
  observed_at timestamptz not null,
  source_ref text not null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id,observation_id),
  unique (workspace_id,source_ref,payload_hash),
  foreign key (workspace_id,brand_id) references public.brand(workspace_id,brand_id),
  foreign key (workspace_id,market_id) references public.market(workspace_id,market_id)
);

create table public.audit_event (
  workspace_id uuid not null,
  event_id uuid not null default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id text not null,
  event_kind text not null,
  actor_type text not null check (actor_type in ('USER','AGENT','SYSTEM')),
  actor_id text not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  primary key (workspace_id,event_id)
);

create index production_job_claim_idx on public.production_job (workspace_id,stage,priority,available_at) where lease_expires_at is null;
create index creative_asset_brand_created_idx on public.creative_asset (workspace_id,brand_id,created_at desc);
create index influencer_engagement_stage_idx on public.influencer_engagement (workspace_id,brand_id,stage);
create index distribution_queue_state_idx on public.distribution_queue_item (workspace_id,state,scheduled_at);
create index metric_observation_market_time_idx on public.metric_observation (workspace_id,brand_id,market_id,observed_at desc);
create index audit_event_aggregate_time_idx on public.audit_event (workspace_id,aggregate_type,aggregate_id,occurred_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['workspace','workspace_member','brand','brand_source','market','production_job','creative_asset','influencer_profile','influencer_engagement','compliance_decision','distribution_queue_item','metric_observation','audit_event'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on table public.%I from anon, authenticated',table_name);
    execute format('grant select on table public.%I to authenticated',table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_workspace_member(workspace_id)))',table_name || '_member_select',table_name);
  end loop;
end $$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('brand-creatives','brand-creatives',false,1073741824,array['image/jpeg','image/png','image/webp','video/mp4','video/webm','text/plain','text/markdown','application/pdf'])
on conflict (id) do nothing;

create policy "brand_creatives_member_select" on storage.objects for select to authenticated
using (bucket_id = 'brand-creatives' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (select private.is_workspace_member((storage.foldername(name))[1]::uuid)) else false end);
create policy "brand_creatives_member_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'brand-creatives' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (select private.is_workspace_member((storage.foldername(name))[1]::uuid)) else false end);
create policy "brand_creatives_member_update" on storage.objects for update to authenticated
using (bucket_id = 'brand-creatives' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (select private.is_workspace_member((storage.foldername(name))[1]::uuid)) else false end)
with check (bucket_id = 'brand-creatives' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (select private.is_workspace_member((storage.foldername(name))[1]::uuid)) else false end);
create policy "brand_creatives_member_delete" on storage.objects for delete to authenticated
using (bucket_id = 'brand-creatives' and case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then (select private.is_workspace_member((storage.foldername(name))[1]::uuid)) else false end);

commit;
