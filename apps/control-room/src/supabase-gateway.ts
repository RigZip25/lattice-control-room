import type { BrandProfile } from "@lattice/core";
import { readFileSync } from "node:fs";

export interface SupabaseRuntimeConfig {
  readonly url: string;
  readonly publishableKey: string;
}

interface SupabaseResponse {
  readonly status: number;
  readonly body: unknown;
}

export function supabaseRuntimeConfig(configPath?: string): SupabaseRuntimeConfig | null {
  const url = process.env.LATTICE_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.LATTICE_SUPABASE_PUBLISHABLE_KEY;
  if (url && publishableKey) return { url, publishableKey };
  if (!configPath) return null;
  try {
    const stored = JSON.parse(readFileSync(configPath, "utf8")) as Partial<SupabaseRuntimeConfig>;
    return typeof stored.url === "string" && typeof stored.publishableKey === "string"
      ? { url: stored.url.replace(/\/$/, ""), publishableKey: stored.publishableKey }
      : null;
  } catch {
    return null;
  }
}

async function request(config: SupabaseRuntimeConfig, path: string, init: RequestInit): Promise<SupabaseResponse> {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.publishableKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({ error: "Invalid Supabase response" }));
  return { status: response.status, body };
}

export async function authenticateWithPassword(
  config: SupabaseRuntimeConfig,
  mode: "SIGN_IN" | "SIGN_UP",
  email: string,
  password: string,
): Promise<SupabaseResponse> {
  const path = mode === "SIGN_IN" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
  return request(config, path, { method: "POST", body: JSON.stringify({ email, password }) });
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
