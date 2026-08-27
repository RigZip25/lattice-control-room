import { afterEach, describe, expect, it, vi } from "vitest";
import { bearerToken, deleteBrandServer, executeStepwiseDryRunCycle, fetchOperatingStateServer, persistBrand, persistBrandServer, persistDryRunCycle, persistOperatingStateServer, requestEmailOtp, verifyEmailOtp, type SupabaseRuntimeConfig } from "./supabase-gateway.js";
import { applyOperatingCommand, initialOperatingState } from "@lattice/core";

const config: SupabaseRuntimeConfig = { url: "https://project.supabase.co", publishableKey: "sb_publishable_test" };

afterEach(() => vi.unstubAllGlobals());

describe("supabase gateway", () => {
  it("requests and verifies an email OTP without putting it in the URL", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", mockedFetch);
    await requestEmailOtp(config, "owner@example.com");
    await verifyEmailOtp(config, "owner@example.com", "123456");
    const [url, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/otp");
    expect(init.body).toBe(JSON.stringify({ email: "owner@example.com", create_user: true }));
    expect((init.headers as Record<string, string>).apikey).toBe("sb_publishable_test");
    const [verifyUrl, verifyInit] = mockedFetch.mock.calls[1] as [string, RequestInit];
    expect(verifyUrl).toBe("https://project.supabase.co/auth/v1/verify");
    expect(JSON.parse(String(verifyInit.body)).token).toBe("123456");
  });

  it("persists a brand using the caller token and workspace boundary", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 201 }));
    vi.stubGlobal("fetch", mockedFetch);
    await persistBrand(config, "user-token", "workspace-id", {
      id: "rigzip",
      name: "RigZip",
      archetype: "LOCAL_TWO_SIDED_MARKETPLACE",
      offering: "Commercial vehicle rental",
      audience: "Businesses",
      businessModel: "Commission",
      objectives: ["Validate demand"],
      primaryValueEvent: "completed_booking",
      targetGeographies: ["US"],
      languages: ["en"],
      constraints: [],
      status: "DISCOVERY",
    });
    const [, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer user-token");
    expect(JSON.parse(String(init.body)).workspace_id).toBe("workspace-id");
  });

  it("accepts only a well-formed bearer token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });

  it("persists and restores governed state with the server-only key",async()=>{
    const secured={...config,secretKey:"sb_secret_server_only"};
    const state=initialOperatingState();
    const mockedFetch=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{state}]),{status:201}))
      .mockResolvedValueOnce(new Response(JSON.stringify([{state,version:0}]),{status:200}));
    vi.stubGlobal("fetch",mockedFetch);
    await persistBrandServer(secured,"e49996a3-5c2e-4093-90bf-f7afd9460adf",{id:"rigzip",name:"RigZip",archetype:"LOCAL_TWO_SIDED_MARKETPLACE",offering:"Commercial vehicle rental",audience:"Businesses",businessModel:"Commission",objectives:["Validate demand"],primaryValueEvent:"completed_booking",targetGeographies:["US"],languages:["en"],constraints:[],status:"DISCOVERY"});
    const brandRequest=mockedFetch.mock.calls[0] as [string,RequestInit];
    expect((brandRequest[1].headers as Record<string,string>).Authorization).toBe("Bearer sb_secret_server_only");
    mockedFetch.mockReset();
    mockedFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([{state}]),{status:201}))
      .mockResolvedValueOnce(new Response(JSON.stringify([{state,version:0}]),{status:200}));
    const saved=await persistOperatingStateServer(secured,"e49996a3-5c2e-4093-90bf-f7afd9460adf",state);
    const loaded=await fetchOperatingStateServer(secured,"e49996a3-5c2e-4093-90bf-f7afd9460adf");
    expect(saved.status).toBe(201);
    expect(loaded.body).toEqual([{state,version:0}]);
    const [saveUrl,saveInit]=mockedFetch.mock.calls[0] as [string,RequestInit];
    expect(saveUrl).toContain("workspace_state?on_conflict=workspace_id");
    expect(JSON.parse(String(saveInit.body))).toMatchObject({version:0,state:{mode:"DRY_RUN"}});
  });

  it("deletes a user-created brand with the server-only key",async()=>{
    const secured={...config,secretKey:"sb_secret_server_only"};
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify([{brand_id:"test-brand"}]),{status:200}));
    vi.stubGlobal("fetch",mockedFetch);
    const result=await deleteBrandServer(secured,"e49996a3-5c2e-4093-90bf-f7afd9460adf","test-brand");
    expect(result.status).toBe(200);
    const [url,init]=mockedFetch.mock.calls[0] as [string,RequestInit];
    expect(url).toContain("brand_id=eq.test-brand");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toMatchObject({status:"PAUSED"});
  });

  it("persists a governed cycle and its jobs with a server-only key",async()=>{
    const secured={...config,secretKey:"sb_secret_server_only"};
    const mockedFetch=vi.fn().mockResolvedValue(new Response(JSON.stringify([]),{status:201}));
    vi.stubGlobal("fetch",mockedFetch);
    const state=applyOperatingCommand(initialOperatingState(),{kind:"START_RIGZIP_DRY_RUN",cycleId:"rigzip-cloud-test"},"2026-08-27T12:00:00.000Z");
    const result=await persistDryRunCycle(secured,"e49996a3-5c2e-4093-90bf-f7afd9460adf",state.executionCycles[0]!);
    expect(result.status).toBe(201);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    const [,jobInit]=mockedFetch.mock.calls[1] as [string,RequestInit];
    expect((jobInit.headers as Record<string,string>).apikey).toBe("sb_secret_server_only");
    expect(JSON.parse(String(jobInit.body))).toHaveLength(13);
    const [finalUrl,finalInit]=mockedFetch.mock.calls[2] as [string,RequestInit];
    expect(finalUrl).toContain("execution_cycle?workspace_id=eq.");
    expect(JSON.parse(String(finalInit.body))).toMatchObject({status:"COMPLETED",external_effects:0});
  });

  it("executes all thirteen stages as separately claimed cloud transactions",async()=>{
    const secured={...config,secretKey:"sb_secret_server_only"};
    const state=applyOperatingCommand(initialOperatingState(),{kind:"START_RIGZIP_DRY_RUN",cycleId:"rigzip-stepwise-test"},"2026-08-27T12:00:00.000Z");
    const cycle=state.executionCycles[0]!;
    let claimIndex=0;
    const mockedFetch=vi.fn(async(input:string|URL|Request,init?:RequestInit)=>{
      const url=String(input);
      if(url.includes("/rpc/claim_execution_job")) {
        const job=cycle.jobs[claimIndex++];
        return new Response(JSON.stringify(job?[{job_id:job.id,kind:job.kind,stage_order:claimIndex,lease_token:`lease-${claimIndex}`}]:[]),{status:200});
      }
      if(url.includes("/rpc/complete_execution_job")) return new Response(JSON.stringify({state:"SUCCEEDED"}),{status:200});
      if(url.includes("execution_job?")&&init?.method==="GET") return new Response(JSON.stringify(cycle.jobs.map(()=>({state:"SUCCEEDED"}))),{status:200});
      if(url.includes("execution_cycle?")&&init?.method==="PATCH") return new Response(JSON.stringify([{status:"COMPLETED"}]),{status:200});
      return new Response(JSON.stringify([]),{status:201});
    });
    vi.stubGlobal("fetch",mockedFetch);
    const result=await executeStepwiseDryRunCycle(secured,"e49996a3-5c2e-4093-90bf-f7afd9460adf",cycle);
    expect(result.status).toBe(200);
    expect(claimIndex).toBe(13);
    expect(mockedFetch.mock.calls.filter(([url])=>String(url).includes("/rpc/complete_execution_job"))).toHaveLength(13);
    const firstCompletion=mockedFetch.mock.calls.find(([url])=>String(url).includes("/rpc/complete_execution_job"));
    const firstPayload=JSON.parse(String((firstCompletion?.[1] as RequestInit).body));
    expect(firstPayload).toMatchObject({p_lease_token:"lease-1",p_result_payload:{stage:"PRODUCT_INTELLIGENCE",mode:"DRY_RUN",externalEffects:0}});
    expect(firstPayload.p_result_payload.agent).toMatchObject({implementation:"LOCAL_EVIDENCE_BOUND",version:1});
    expect(firstPayload.p_result_payload.evidenceRefs.length).toBeGreaterThan(0);
    const completions=mockedFetch.mock.calls.filter(([url])=>String(url).includes("/rpc/complete_execution_job"));
    expect(JSON.parse(String((completions[1]?.[1] as RequestInit).body)).p_result_payload.stage).toBe("PRODUCT_DIAGNOSIS");
    expect(JSON.parse(String((completions[2]?.[1] as RequestInit).body)).p_result_payload.stage).toBe("EXPANSION_THESIS");
    const experiment=JSON.parse(String((completions[3]?.[1] as RequestInit).body)).p_result_payload;
    const creative=JSON.parse(String((completions[4]?.[1] as RequestInit).body)).p_result_payload;
    const legal=JSON.parse(String((completions[5]?.[1] as RequestInit).body)).p_result_payload;
    expect(experiment).toMatchObject({stage:"EXPERIMENT_PLAN",mode:"DRY_RUN",externalEffects:0,payload:{geography:"Nebraska",realSpendAuthorized:false}});
    expect(creative).toMatchObject({stage:"CREATIVE_PROMPT",payload:{providerDispatchAuthorized:false}});
    expect(legal).toMatchObject({stage:"LEGAL_REVIEW",payload:{decision:{state:"ALLOW",decidedBy:"LEGAL_POLICY_AGENT"},gate:{contentAuthorized:true,providerDispatchAuthorized:false}}});
    const provider=JSON.parse(String((completions[6]?.[1] as RequestInit).body)).p_result_payload;
    const qa=JSON.parse(String((completions[7]?.[1] as RequestInit).body)).p_result_payload;
    const library=JSON.parse(String((completions[8]?.[1] as RequestInit).body)).p_result_payload;
    expect(provider).toMatchObject({stage:"PROVIDER_EXECUTION",payload:{execution:{mode:"SIMULATED",externalCallMade:false,binaryGenerated:false,actualCostUsd:0}}});
    expect(qa).toMatchObject({stage:"QA_REVIEW",payload:{disposition:"PASS",reworkRequired:false}});
    expect(library).toMatchObject({stage:"LIBRARY_INGEST",payload:{storage:{metadataPersisted:true,binaryUploaded:false},rightsGate:{usageAuthorized:true}}});
  });
});
