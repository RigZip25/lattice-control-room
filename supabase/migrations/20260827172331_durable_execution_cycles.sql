create table public.execution_cycle (
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  cycle_id text not null check (cycle_id ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  brand_id text not null check (brand_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  mode text not null default 'DRY_RUN' check (mode = 'DRY_RUN'),
  status text not null check (status in ('PENDING','RUNNING','COMPLETED','FAILED')),
  external_effects integer not null default 0 check (external_effects = 0),
  artifacts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, cycle_id),
  check ((status = 'COMPLETED' and completed_at is not null) or status <> 'COMPLETED')
);

create table public.execution_job (
  workspace_id uuid not null,
  cycle_id text not null,
  job_id text not null,
  brand_id text not null check (brand_id ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  kind text not null check (kind in (
    'PRODUCT_INTELLIGENCE','PRODUCT_DIAGNOSIS','EXPANSION_THESIS','EXPERIMENT_PLAN',
    'CREATIVE_PROMPT','LEGAL_REVIEW','PROVIDER_EXECUTION','QA_REVIEW','LIBRARY_INGEST',
    'DISTRIBUTION_PLAN','METRIC_INGEST','LEARNING_EVALUATION','CAPITAL_RECOMMENDATION'
  )),
  mode text not null default 'DRY_RUN' check (mode = 'DRY_RUN'),
  state text not null check (state in ('PENDING','LEASED','RETRY_WAIT','SUCCEEDED','DEAD_LETTER')),
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  maximum_attempts integer not null default 3 check (maximum_attempts between 1 and 20),
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_token text,
  lease_expires_at timestamptz,
  last_error jsonb,
  result_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, job_id),
  unique (workspace_id, idempotency_key),
  foreign key (workspace_id, cycle_id) references public.execution_cycle(workspace_id, cycle_id) on delete cascade,
  check (
    (state = 'LEASED' and lease_owner is not null and lease_token is not null and lease_expires_at is not null)
    or
    (state <> 'LEASED' and lease_owner is null and lease_token is null and lease_expires_at is null)
  )
);

create index execution_cycle_workspace_created_idx on public.execution_cycle (workspace_id, created_at desc);
create index execution_job_runnable_idx on public.execution_job (workspace_id, state, available_at) where state in ('PENDING','RETRY_WAIT');
create index execution_job_cycle_idx on public.execution_job (workspace_id, cycle_id, created_at);

alter table public.execution_cycle enable row level security;
alter table public.execution_job enable row level security;

revoke all on table public.execution_cycle from anon, authenticated;
revoke all on table public.execution_job from anon, authenticated;
grant select on table public.execution_cycle to authenticated;
grant select on table public.execution_job to authenticated;
grant select, insert, update, delete on table public.execution_cycle to service_role;
grant select, insert, update, delete on table public.execution_job to service_role;

create policy execution_cycle_member_select on public.execution_cycle for select to authenticated
  using ((select private.is_workspace_member(execution_cycle.workspace_id)));
create policy execution_job_member_select on public.execution_job for select to authenticated
  using ((select private.is_workspace_member(execution_job.workspace_id)));

