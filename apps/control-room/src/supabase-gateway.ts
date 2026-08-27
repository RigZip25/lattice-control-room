import type { BrandProfile, DryRunCycleRecord } from "@lattice/core";
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

export function cloudExecutionConfigured(config:SupabaseRuntimeConfig|null):boolean {
  return Boolean(config?.secretKey);
}

export async function persistDryRunCycle(config:SupabaseRuntimeConfig,workspaceId:string,cycle:DryRunCycleRecord):Promise<SupabaseResponse> {
  if (!config.secretKey) return {status:503,body:{error:"Supabase secret key is not configured"}};
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId) || cycle.mode!=="DRY_RUN" || cycle.artifacts.externalEffects!==0) return {status:400,body:{error:"Invalid governed cycle persistence request"}};
  const authorization={Authorization:`Bearer ${config.secretKey}`};
  const running=await request(config,"/rest/v1/execution_cycle?on_conflict=workspace_id,cycle_id",{method:"POST",headers:{...authorization,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({workspace_id:workspaceId,cycle_id:cycle.cycleId,brand_id:cycle.brandId,mode:"DRY_RUN",status:"RUNNING",external_effects:0,artifacts:{},created_at:cycle.createdAt,completed_at:null,updated_at:cycle.createdAt})},config.secretKey);
  if (running.status>=400) return running;
  const jobs=await request(config,"/rest/v1/execution_job?on_conflict=workspace_id,job_id",{method:"POST",headers:{...authorization,Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(cycle.jobs.map((job)=>({workspace_id:workspaceId,cycle_id:cycle.cycleId,job_id:job.id,brand_id:job.brandId,kind:job.kind,mode:job.mode,state:job.state,idempotency_key:job.idempotencyKey,payload:job.payload,attempts:job.attempts,maximum_attempts:job.maxAttempts,available_at:job.availableAt,lease_owner:job.lease?.owner??null,lease_token:job.lease?.token??null,lease_expires_at:job.lease?.expiresAt??null,last_error:job.lastError??null,result_ref:job.resultRef??null,created_at:job.createdAt,updated_at:job.updatedAt})))},config.secretKey);
  if (jobs.status>=400) return jobs;
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

export function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}
