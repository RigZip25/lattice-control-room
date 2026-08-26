begin;

create index brand_source_brand_fk_idx on public.brand_source (workspace_id, brand_id);
create index compliance_decision_brand_fk_idx on public.compliance_decision (workspace_id, brand_id);
create index compliance_decision_job_fk_idx on public.compliance_decision (workspace_id, job_id);
create index creative_asset_job_fk_idx on public.creative_asset (workspace_id, job_id);
create index distribution_queue_asset_fk_idx on public.distribution_queue_item (workspace_id, asset_id);
create index distribution_queue_brand_fk_idx on public.distribution_queue_item (workspace_id, brand_id);
create index distribution_queue_compliance_fk_idx on public.distribution_queue_item (workspace_id, compliance_decision_id);
create index influencer_engagement_influencer_fk_idx on public.influencer_engagement (workspace_id, influencer_id);
create index market_brand_fk_idx on public.market (workspace_id, brand_id);
create index metric_observation_market_fk_idx on public.metric_observation (workspace_id, market_id);
create index production_job_brand_fk_idx on public.production_job (workspace_id, brand_id);
create index production_job_market_fk_idx on public.production_job (workspace_id, market_id);
create index workspace_member_user_fk_idx on public.workspace_member (user_id);

commit;
