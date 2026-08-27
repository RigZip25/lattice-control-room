import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  applyOperatingCommand,
  factoryCadenceAt,
  initialOperatingState,
  productScreens,
  referenceGeographies,
  runRigZipDryRun,
  type OperatingCommand,
  type OperatingState,
} from "../packages/core/dist/index.js";
import {
  bearerToken,
  fetchCloudContext,
  persistBrand,
  requestEmailOtp,
  supabaseRuntimeConfig,
  verifyEmailOtp,
} from "../apps/control-room/src/supabase-gateway.js";

interface ApiRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(payload: unknown): void;
}

const supabase = supabaseRuntimeConfig();
const ownerPassword = process.env.LAFWIRON_OWNER_PASSWORD;
const sessionSecret = process.env.LAFWIRON_SESSION_SECRET;
const ownerAccessConfigured = Boolean(ownerPassword && sessionSecret && sessionSecret.length >= 32);
const ownerSessionSeconds = 12 * 60 * 60;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function passwordsMatch(candidate: string): boolean {
  if (!ownerPassword) return false;
  return timingSafeEqual(digest(candidate), digest(ownerPassword));
}

function signOwnerSession(now = Math.floor(Date.now() / 1000)): { access_token: string; expires_at: number; token_type: "bearer" } {
  if (!sessionSecret) throw new Error("Owner session configuration is unavailable");
  const payload = Buffer.from(JSON.stringify({ sub:"lafwiron-owner", iat:now, exp:now + ownerSessionSeconds }), "utf8").toString("base64url");
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return { access_token:`${payload}.${signature}`, expires_at:now + ownerSessionSeconds, token_type:"bearer" };
}

function validOwnerSession(token: string | undefined, now = Math.floor(Date.now() / 1000)): boolean {
  if (!token || !sessionSecret) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", sessionSecret).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return false; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    return claims.sub === "lafwiron-owner" && typeof claims.exp === "number" && claims.exp > now;
  } catch { return false; }
}

function header(request: ApiRequest, name: string): string | undefined {
  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function parseBody(body: unknown): unknown {
  if (typeof body === "string") return JSON.parse(body);
  return body ?? {};
}

function isOperatingState(value: unknown): value is OperatingState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<OperatingState>;
  return state.mode === "DRY_RUN"
    && Number.isInteger(state.version)
    && Array.isArray(state.events)
    && Array.isArray(state.discoveryMarkets)
    && Array.isArray(state.expansionAreas)
    && Array.isArray(state.brandProfiles)
    && Array.isArray(state.productSources)
    && Array.isArray(state.productEvidence);
}

function countries(): Array<{ code: string; name: string }> {
  const names = new Intl.DisplayNames(["ru"], { type: "region" });
  const codes = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");
  return codes.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export default async function handler(request: ApiRequest, response: ApiResponse): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  const pathname = new URL(request.url ?? "/", "https://lattice.invalid").pathname;
  const method = request.method ?? "GET";

  if (method === "GET" && pathname === "/api/v1/backend-status") {
    response.status(200).json({ provider:"LAFWIRON", configured:ownerAccessConfigured, authentication:"OWNER_PASSWORD", configuration:{ ownerPassword:Boolean(ownerPassword), sessionSecret:Boolean(sessionSecret), sessionSecretStrong:Boolean(sessionSecret && sessionSecret.length >= 32) }, dataProvider:supabase?"SUPABASE":"LOCAL", mode:"DRY_RUN", runtime:"VERCEL_STATELESS" });
    return;
  }
  if (method === "POST" && pathname === "/api/v1/auth/owner-login") {
    if (!ownerAccessConfigured) { response.status(503).json({ error:"Owner access is not configured" }); return; }
    try {
      const body = parseBody(request.body) as { password?: unknown };
      const password = typeof body.password === "string" ? body.password : "";
      if (!passwordsMatch(password)) { response.status(401).json({ error:"Invalid owner credentials" }); return; }
      response.status(200).json(signOwnerSession());
    } catch { response.status(400).json({ error:"Invalid authentication request" }); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/auth/owner-session") {
    const token = bearerToken(header(request, "authorization"));
    if (!validOwnerSession(token)) { response.status(401).json({ error:"Owner session is invalid or expired" }); return; }
    response.status(200).json({ workspace:{ name:"LAFWIRON", mode:"DRY_RUN" }, membership:{ member_role:"OWNER" }, authentication:"OWNER_PASSWORD" });
    return;
  }
  if (method === "POST" && (pathname === "/api/v1/auth/request-otp" || pathname === "/api/v1/auth/verify-otp")) {
    if (!supabase) { response.status(503).json({ error:"Supabase runtime configuration is not available" }); return; }
    try {
      const body = parseBody(request.body) as { email?: unknown; token?: unknown };
      const email = typeof body.email === "string" ? body.email.trim() : "";
      const token = typeof body.token === "string" ? body.token.trim() : "";
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Valid email is required");
      if (pathname.endsWith("verify-otp") && !/^\d{6}$/.test(token)) throw new Error("A six-digit code is required");
      const result = pathname.endsWith("verify-otp") ? await verifyEmailOtp(supabase, email, token) : await requestEmailOtp(supabase, email);
      response.status(result.status).json(result.body);
    } catch (error) { response.status(400).json({ error:error instanceof Error ? error.message : "Invalid authentication request" }); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/cloud-context") {
    if (!supabase) { response.status(503).json({ error:"Supabase runtime configuration is not available" }); return; }
    const token = bearerToken(header(request, "authorization"));
    if (!token) { response.status(401).json({ error:"Authentication required" }); return; }
    const result = await fetchCloudContext(supabase, token);
    response.status(result.status).json(result.body);
    return;
  }
  if (method === "POST" && pathname === "/api/v1/commands") {
    if (ownerAccessConfigured && !validOwnerSession(bearerToken(header(request, "authorization")))) {
      response.status(401).json({ error:"Owner authentication required" });
      return;
    }
    try {
      const envelope = parseBody(request.body) as { command?: OperatingCommand; currentState?: unknown };
      if (!envelope.command) throw new Error("Command is required");
      const base = isOperatingState(envelope.currentState) ? envelope.currentState : initialOperatingState();
      const next = applyOperatingCommand(base, envelope.command, new Date().toISOString());
      if (supabase && envelope.command.kind === "ADD_BRAND_PROFILE") {
        const token = bearerToken(header(request, "authorization"));
        const workspaceId = header(request, "x-lattice-workspace-id");
        if (token && workspaceId) {
          const cloudResult = await persistBrand(supabase, token, workspaceId, envelope.command.brand);
          if (cloudResult.status >= 400) { response.status(cloudResult.status).json(cloudResult.body); return; }
        }
      }
      response.status(200).json(next);
    } catch (error) { response.status(400).json({ error:error instanceof Error ? error.message : "Invalid command" }); }
    return;
  }
  if (method === "GET" && pathname === "/api/v1/runtime-state") { response.status(200).json(initialOperatingState()); return; }
  if (method === "GET" && pathname === "/api/v1/control-room") { response.status(200).json(runRigZipDryRun().readModel); return; }
  if (method === "GET" && pathname === "/api/v1/screens") { response.status(200).json({ screens:productScreens }); return; }
  if (method === "GET" && pathname === "/api/v1/geographies") { response.status(200).json({ geographies:referenceGeographies.list() }); return; }
  if (method === "GET" && pathname === "/api/v1/country-catalog") { response.setHeader("Cache-Control", "public, max-age=86400"); response.status(200).json({ countries:countries() }); return; }
  if (method === "GET" && pathname === "/api/v1/factory-status") {
    const generatedAt = new Date().toISOString();
    const state = initialOperatingState();
    const readModel = runRigZipDryRun().readModel;
    response.status(200).json({ generatedAt, cadence:factoryCadenceAt(generatedAt), runtimeVersion:state.version, mode:state.mode, openDecisions:state.openDecisions, brands:readModel.portfolio.length, expansionMarkets:4, expansionAreas:0, availableCapitalUsd:readModel.wallet.availableUsd, killSwitch:readModel.authority.killSwitch, source:"VERCEL_GOVERNED_READ_MODEL" });
    return;
  }
  response.status(404).json({ error:"Not found" });
}
