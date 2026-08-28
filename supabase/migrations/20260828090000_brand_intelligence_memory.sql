create table if not exists public.knowledge_document (
  document_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  brand_id text,
  kind text not null check (kind in ('OWNER_BRIEF','WEBSITE','REPOSITORY','MARKET_RESEARCH','ANALYTICS','CREATIVE','LEGAL_POLICY','TEST_RESULT')),
  title text not null,
  source_url text,
  content text not null default '',
  content_hash text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUPERSEDED','ARCHIVED')),
  metadata jsonb not null default '{}'::jsonb,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, content_hash)
);

create index if not exists knowledge_document_scope_idx on public.knowledge_document(workspace_id, brand_id, kind, status);
create index if not exists knowledge_document_search_idx on public.knowledge_document using gin(search_vector);

create table if not exists public.knowledge_fact (
  fact_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  brand_id text,
  document_id uuid references public.knowledge_document(document_id) on delete set null,
  subject text not null,
  statement text not null,
  classification text not null check (classification in ('OWNER_VISION','OBSERVED','EXTERNAL_EVIDENCE','HYPOTHESIS','TEST_RESULT')),
  confidence numeric(4,3) not null default 0.5 check (confidence between 0 and 1),
  owner_status text not null default 'UNREVIEWED' check (owner_status in ('UNREVIEWED','CONFIRMED','CORRECTED','REJECTED')),
  metadata jsonb not null default '{}'::jsonb,
  superseded_by uuid references public.knowledge_fact(fact_id),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_fact_scope_idx on public.knowledge_fact(workspace_id, brand_id, classification, owner_status);

create table if not exists public.ai_generation (
  generation_id text primary key,
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  brand_id text,
  purpose text not null,
  prompt_version text not null,
  model text not null,
  status text not null check (status in ('STARTED','COMPLETED','FAILED')),
  input_refs jsonb not null default '[]'::jsonb,
  output jsonb,
  usage jsonb not null default '{}'::jsonb,
  estimated_cost_usd numeric(12,6) not null default 0,
  error jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_generation_scope_idx on public.ai_generation(workspace_id, brand_id, purpose, created_at desc);

create table if not exists public.creative_job (
  creative_job_id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspace(workspace_id) on delete cascade,
  brand_id text not null,
  hypothesis text not null,
  channel text not null,
  format text not null,
  target_market text,
  target_audience text not null,
  brief jsonb not null,
  source_fact_ids uuid[] not null default '{}',
  state text not null default 'PLANNED' check (state in ('PLANNED','PROMPT_READY','GENERATED','QA_REVIEW','LEGAL_REVIEW','LIBRARY','DISTRIBUTION_READY','PAUSED','REJECTED')),
  mode text not null default 'DRY_RUN' check (mode = 'DRY_RUN'),
  external_effects integer not null default 0 check (external_effects = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_job_queue_idx on public.creative_job(workspace_id, brand_id, state, created_at);

alter table public.knowledge_document enable row level security;
alter table public.knowledge_fact enable row level security;
alter table public.ai_generation enable row level security;
alter table public.creative_job enable row level security;

revoke all on public.knowledge_document, public.knowledge_fact, public.ai_generation, public.creative_job from anon, authenticated;

comment on table public.knowledge_document is 'Server-managed, brand-scoped source material for governed RAG.';
comment on table public.knowledge_fact is 'Versionable facts, owner vision, hypotheses and test results with explicit provenance.';
comment on table public.ai_generation is 'Audit record for every external model generation, including usage and estimated cost.';
comment on table public.creative_job is 'DRY RUN creative pipeline. Database constraints prohibit external effects.';
