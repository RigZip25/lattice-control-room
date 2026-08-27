import { executeEvidenceBoundAgentChain, type BrandProfile, type DryRunCycleRecord, type OperatingState } from "@lattice/core";
import { readFileSync } from "node:fs";

export interface SupabaseRuntimeConfig {
  readonly url: string;
  readonly publishableKey: string;
  readonly secretKey?: string;
}

interface SupabaseResponse {
  readonly status: number;
  readonly body: unknown;
}

export function supabaseRuntimeConfig(configPath?: string): SupabaseRuntimeConfig | null {
  const url = process.env.LATTICE_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.LATTICE_SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.LATTICE_SUPABASE_SECRET_KEY;
  if (url && publishableKey) return { url, publishableKey, ...(secretKey ? { secretKey } : {}) };
  if (!configPath) return null;
  try {
    const stored = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SupabaseRuntimeConfig>;
    return typeof stored.url === "string" && typeof stored.publishableKey === "string"
      ? { url: stored.url.replace(/\/$/, ""), publishableKey: stored.publishableKey, ...(typeof stored.secretKey === "string" ? { secretKey: stored.secretKey } : {}) }
      : null;
  } catch {
    return null;
  }
}

async function request(config: SupabaseRuntimeConfig, path: string, init: RequestInit, apiKey = config.publishableKey): Promise<SupabaseResponse> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({ error: "Invalid Supabase response" }));
  return { status: response.status, body };
}

interface CloudExecutionJob {
  readonly job_id: string;
  readonly kind: string;
  readonly lease_token: string;
  readonly stage_order: number;
}

export function cloudExecutionConfigured(config:SupabaseRuntimeConfig|null):boolean {
  return Boolean(config?.secretKey);
}

const executionStageOrder = [
  "PRODUCT_INTELLIGENCE","PRODUCT_DIAGNOSIS","EXPANSION_THESIS","EXPERIMENT_PLAN",
  "CREATIVE_PROMPT","LEGAL_REVIEW","PROVIDER_EXECUTION","QA_REVIEW","LIBRARY_INGEST",
  "DISTRIBUTION_PLAN","METRIC_INGEST","LEARNING_EVALUATION","CAPITAL_RECOMMENDATION",
] as const;

export async function persistDryRunCycle(config:SupabaseRuntimeConfig,workspaceId:string,cycle:DryRunCycleRecord):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || cycle.mode!=="DRY_RUN" || cycle.artifacts.externalEffects!==0) return {status:400,body:{error:"Invalid governed cycle persistence request"}};
  const authorization={Authorization:`Bearer ${config.secretKey}`};
  const running=await request(config,"/rest/v1/execution_cycle?on_conflict=workspace_id,cycle_id",{method:"POST",headers:{...authorization,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({workspace_id:workspaceId,cycle_id:cycle.cycleId,brand_id:cycle.brandId,mode:"DRY_RUN",status:"RUNNING",external_effects:0,artifacts:{},created_at:cycle.createdAt,completed_at:null,updated_at:cycle.createdAt})},config.secretKey);
  if (running.status>=400) return running;
  const jobs=await request(config,"/rest/v1/execution_job?on_conflict=workspace_id,job_id",{method:"POST",headers:{...authorization,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(cycle.jobs.map((job)=>({workspace_id:workspaceId,cycle_id:cycle.cycleId,job_id:job.id,brand_id:job.brandId,kind:job.kind,stage_order:executionStageOrder.indexOf(job.kind)+1,mode:job.mode,state:job.state,idempotency_key:job.idempotencyKey,payload:job.payload,attempts:job.attempts,maximum_attempts:job.maxAttempts,available_at:job.availableAt,lease_owner:job.lease?.owner??null,lease_token:job.lease?.token??null,lease_expires_at:job.lease?.expiresAt??null,last_error:job.lastError??null,result_ref:job.resultRef??null,created_at:job.createdAt,updated_at:job.updatedAt})))},config.secretKey);
  if (jobs.status>=400) return jobs;
  return request(config,`/rest/v1/execution_cycle?workspace_id=eq.${encodeURIComponent(workspaceId)}&cycle_id=eq.${encodeURIComponent(cycle.cycleId)}`,{method:"PATCH",headers:{...authorization,Prefer:"return=representation"},body:JSON.stringify({status:"COMPLETED",external_effects:0,artifacts:cycle.artifacts,completed_at:cycle.completedAt,updated_at:cycle.completedAt})},config.secretKey);
}

/**
 * Executes the deterministic DRY RUN through separate database transactions.
 * Every claim and completion is independently durable, so a later invocation
 * can resume after the last SUCCEEDED stage without replaying it.
 */
export async function executeStepwiseDryRunCycle(config:SupabaseRuntimeConfig,workspaceId:string,cycle:DryRunCycleRecord):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || cycle.mode!=="DRY_RUN" || cycle.artifacts.externalEffects!==0) return {status:400,body:{error:"Invalid governed cycle request"}};
  const authorization={Authorization:`Bearer ${config.secretKey}`};
  const cycleSeed=await request(config,"/rest/v1/execution_cycle?on_conflict=workspace_id,cycle_id",{method:"POST",headers:{...authorization,Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({workspace_id:workspaceId,cycle_id:cycle.cycleId,brand_id:cycle.brandId,mode:"DRY_RUN",status:"RUNNING",external_effects:0,artifacts:{},created_at:cycle.createdAt,completed_at:null,updated_at:cycle.createdAt})},config.secretKey);
  if (cycleSeed.status>=400) return cycleSeed;
  const jobSeeds=cycle.jobs.map((job)=>({workspace_id:workspaceId,cycle_id:cycle.cycleId,job_id:job.id,brand_id:job.brandId,kind:job.kind,stage_order:executionStageOrder.indexOf(job.kind)+1,mode:"DRY_RUN",state:"PENDING",idempotency_key:job.idempotencyKey,payload:job.payload,attempts:0,maximum_attempts:job.maxAttempts,available_at:job.availableAt,lease_owner:null,lease_token:null,lease_expires_at:null,last_error:null,result_ref:null,created_at:job.createdAt,updated_at:job.createdAt}));
  const jobsSeed=await request(config,"/rest/v1/execution_job?on_conflict=workspace_id,job_id",{method:"POST",headers:{...authorization,Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(jobSeeds)},config.secretKey);
  if (jobsSeed.status>=400) return jobsSeed;

  const workerId=`vercel:${cycle.cycleId}`;
  const agentArtifacts=executeEvidenceBoundAgentChain({cycleId:cycle.cycleId,artifacts:cycle.artifacts,createdAt:cycle.createdAt});
  const governedResults:Partial<Record<(typeof executionStageOrder)[number],unknown>>={
    PRODUCT_INTELLIGENCE:agentArtifacts.intelligence,
    PRODUCT_DIAGNOSIS:agentArtifacts.diagnosis,
    EXPANSION_THESIS:agentArtifacts.expansion,
    EXPERIMENT_PLAN:agentArtifacts.experimentPlan,
    CREATIVE_PROMPT:agentArtifacts.creativeBrief,
    LEGAL_REVIEW:agentArtifacts.legalReview,
    PROVIDER_EXECUTION:agentArtifacts.providerExecution,
    QA_REVIEW:agentArtifacts.qaReview,
    LIBRARY_INGEST:agentArtifacts.libraryIngest,
    DISTRIBUTION_PLAN:agentArtifacts.distributionPlan,
    METRIC_INGEST:agentArtifacts.metricIngest,
    LEARNING_EVALUATION:agentArtifacts.learningEvaluation,
    CAPITAL_RECOMMENDATION:agentArtifacts.capitalRecommendation,
  };
  let completed=0;
  for (let stage=0;stage<cycle.jobs.length;stage+=1) {
    const claim=await request(config,"/rest/v1/rpc/claim_execution_job",{method:"POST",headers:authorization,body:JSON.stringify({p_workspace_id:workspaceId,p_worker_id:workerId,p_lease_seconds:60})},config.secretKey);
    if (claim.status>=400) return claim;
    const leased=(claim.body as CloudExecutionJob[])[0];
    if (!leased) break;
    const template=cycle.jobs.find((job)=>job.id===leased.job_id && job.kind===leased.kind);
    if (!template?.resultRef) {
      await request(config,"/rest/v1/rpc/fail_execution_job",{method:"POST",headers:authorization,body:JSON.stringify({p_workspace_id:workspaceId,p_job_id:leased.job_id,p_lease_token:leased.lease_token,p_error:{message:"Deterministic stage result is unavailable"},p_retry_seconds:5})},config.secretKey);
      return {status:500,body:{error:`Stage ${leased.stage_order} result is unavailable`}};
    }
    const resultPayload=governedResults[template.kind]??{stage:template.kind,resultRef:template.resultRef,mode:"DRY_RUN",externalEffects:0};
    const completion=await request(config,"/rest/v1/rpc/complete_execution_job",{method:"POST",headers:authorization,body:JSON.stringify({p_workspace_id:workspaceId,p_job_id:leased.job_id,p_lease_token:leased.lease_token,p_result_ref:template.resultRef,p_result_payload:resultPayload})},config.secretKey);
    if (completion.status>=400) return completion;
    completed+=1;
  }
  const status=await request(config,`/rest/v1/execution_job?workspace_id=eq.${encodeURIComponent(workspaceId)}&cycle_id=eq.${encodeURIComponent(cycle.cycleId)}&select=state`,{method:"GET",headers:authorization},config.secretKey);
  if (status.status>=400) return status;
  const states=(status.body as Array<{state:string}>).map((row)=>row.state);
  if (states.length!==cycle.jobs.length || states.some((state)=>state!=="SUCCEEDED")) return {status:202,body:{cycleId:cycle.cycleId,status:"RUNNING",completed,remaining:cycle.jobs.length-states.filter((state)=>state==="SUCCEEDED").length,externalEffects:0}};
  return request(config,`/rest/v1/execution_cycle?workspace_id=eq.${encodeURIComponent(workspaceId)}&cycle_id=eq.${encodeURIComponent(cycle.cycleId)}`,{method:"PATCH",headers:{...authorization,Prefer:"return=representation"},body:JSON.stringify({status:"COMPLETED",external_effects:0,artifacts:cycle.artifacts,completed_at:cycle.completedAt,updated_at:cycle.completedAt})},config.secretKey);
}

export async function requestEmailOtp(
  config: SupabaseRuntimeConfig,
  email: string,
): Promise<SupabaseResponse> {
  return request(config, "/auth/v1/otp", { method: "POST", body: JSON.stringify({ email, create_user: true }) });
}

export async function verifyEmailOtp(
  config: SupabaseRuntimeConfig,
  email: string,
  token: string,
): Promise<SupabaseResponse> {
  return request(config, "/auth/v1/verify", { method: "POST", body: JSON.stringify({ email, token, type: "email" }) });
}

export async function fetchCloudContext(config: SupabaseRuntimeConfig, accessToken: string): Promise<SupabaseResponse> {
  const membership = await request(config, "/rest/v1/workspace_member?select=workspace_id,member_role&limit=1", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (membership.status >= 400) return membership;
  const rows = membership.body as Array<{ workspace_id: string; member_role: string }>;
  if (!rows[0]) return { status: 404, body: { error: "Workspace membership not found" } };
  const workspaceId = rows[0].workspace_id;
  const [workspace, brands] = await Promise.all([
    request(config, `/rest/v1/workspace?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=workspace_id,name,mode&limit=1`, {
      method: "GET", headers: { Authorization: `Bearer ${accessToken}` },
    }),
    request(config, `/rest/v1/brand?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=brand_id,name,archetype,profile,status&order=created_at.asc`, {
      method: "GET", headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);
  if (workspace.status >= 400) return workspace;
  if (brands.status >= 400) return brands;
  return { status: 200, body: { membership: rows[0], workspace: (workspace.body as unknown[])[0], brands: brands.body } };
}

export async function persistBrand(
  config: SupabaseRuntimeConfig,
  accessToken: string,
  workspaceId: string,
  brand: BrandProfile,
): Promise<SupabaseResponse> {
  return request(config, "/rest/v1/brand?on_conflict=workspace_id,brand_id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      brand_id: brand.id,
      name: brand.name,
      archetype: brand.archetype,
      profile: brand,
      status: brand.status,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function persistBrandServer(config:SupabaseRuntimeConfig,workspaceId:string,brand:BrandProfile):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  return request(config,"/rest/v1/brand?on_conflict=workspace_id,brand_id",{
    method:"POST",
    headers:{Authorization:`Bearer ${config.secretKey}`,Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify({workspace_id:workspaceId,brand_id:brand.id,name:brand.name,archetype:brand.archetype,profile:brand,status:brand.status,updated_at:new Date().toISOString()}),
  },config.secretKey);
}

export async function deleteBrandServer(config:SupabaseRuntimeConfig,workspaceId:string,brandId:string):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  return request(config,`/rest/v1/brand?workspace_id=eq.${encodeURIComponent(workspaceId)}&brand_id=eq.${encodeURIComponent(brandId)}`,{
    method:"PATCH",headers:{Authorization:`Bearer ${config.secretKey}`,Prefer:"return=representation"},body:JSON.stringify({status:"PAUSED",updated_at:new Date().toISOString()}),
  },config.secretKey);
}

export async function persistOperatingStateServer(config:SupabaseRuntimeConfig,workspaceId:string,state:OperatingState):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || state.mode!=="DRY_RUN") return {status:400,body:{error:"Invalid governed operating state"}};
  return request(config,"/rest/v1/workspace_state?on_conflict=workspace_id",{
    method:"POST",
    headers:{Authorization:`Bearer ${config.secretKey}`,Prefer:"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify({workspace_id:workspaceId,version:state.version,state,updated_at:new Date().toISOString()}),
  },config.secretKey);
}

export async function fetchOperatingStateServer(config:SupabaseRuntimeConfig,workspaceId:string):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  return request(config,`/rest/v1/workspace_state?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=state,version&limit=1`,{
    method:"GET",headers:{Authorization:`Bearer ${config.secretKey}`},
  },config.secretKey);
}

export function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}
