import { describe, expect, it } from "vitest";
import { applyOperatingCommand, initialOperatingState } from "./operating-state.js";
import { registerProductSource, recordProductEvidence } from "./product-evidence.js";
import { createProductDiagnosis } from "./product-diagnosis.js";
import { createExpansionThesis } from "./expansion-thesis.js";

describe("governed local operating state", () => {
  it("records deterministic dry-run commands with monotonic versions", () => {
    const first = applyOperatingCommand(initialOperatingState(), { kind:"SET_FILTER", filter:"RIGZIP" }, "2026-08-26T12:00:00.000Z");
    const second = applyOperatingCommand(first, { kind:"RESOLVE_DECISION", outcome:"APPROVED" }, "2026-08-26T12:01:00.000Z");
    expect(second.mode).toBe("DRY_RUN");
    expect(second.version).toBe(2);
    expect(second.openDecisions).toBe(2);
    expect(second.events.map((event) => event.version)).toEqual([1, 2]);
  });

  it("admits a country only once and only in discovery mode", () => {
    const command = { kind:"ADD_DISCOVERY_MARKET", market:{ countryCode:"DE", worldCode:"DEU", countryName:"Германия", slug:"germaniya", brand:"Evorios", activity:"neighbor marketplace", status:"DISCOVERY" } } as const;
    const state = applyOperatingCommand(initialOperatingState(), command, "2026-08-26T12:00:00.000Z");
    expect(state.discoveryMarkets).toHaveLength(1);
    expect(state.discoveryMarkets[0]?.worldCode).toBe("DEU");
    expect(() => applyOperatingCommand(state, command, "2026-08-26T12:01:00.000Z")).toThrow(/already exists/);
  });

  it("rejects malformed commands at the runtime boundary", () => {
    expect(() => applyOperatingCommand(initialOperatingState(), { kind:"SET_FILTER", filter:"UNKNOWN" } as never, "2026-08-26T12:00:00.000Z")).toThrow(/Filter command/);
    expect(() => applyOperatingCommand(initialOperatingState(), { kind:"SPEND_FUNDS" } as never, "2026-08-26T12:00:00.000Z")).toThrow(/kind/);
  });

  it("adds a governed administrative area without executing market activity", () => {
    const command = { kind:"ADD_EXPANSION_AREA", area:{ countryCode:"US", adminUnitId:"31", name:"Nebraska", unitType:"state", route:"/markets/nebraska", brand:"RigZip", status:"DISCOVERY" } } as const;
    const state = applyOperatingCommand(initialOperatingState(), command, "2026-08-26T12:00:00.000Z");
    expect(state.expansionAreas).toEqual([command.area]);
    expect(state.mode).toBe("DRY_RUN");
    expect(() => applyOperatingCommand(state, command, "2026-08-26T12:01:00.000Z")).toThrow(/already exists/);
  });

  it("registers a brand with the minimum context required by the factory", () => {
    const command = { kind:"ADD_BRAND_PROFILE", brand:{ id:"neighborhood-tools", name:"Neighborhood Tools", archetype:"INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE", offering:"Rental of household tools", audience:"Neighbors and local owners", businessModel:"Transaction commission", objectives:["Validate local liquidity"], primaryValueEvent:"completed_rental", targetGeographies:["US"], languages:["en"], constraints:["No regulated equipment"], status:"DISCOVERY" } } as const;
    const state = applyOperatingCommand(initialOperatingState(), command, "2026-08-26T12:00:00.000Z");
    expect(state.brandProfiles[0]?.primaryValueEvent).toBe("completed_rental");
    expect(state.brandProfiles[0]?.status).toBe("DISCOVERY");
    expect(() => applyOperatingCommand(state, command, "2026-08-26T12:01:00.000Z")).toThrow(/already exists/);
  });

  it("persists a completed, zero-effect RigZip execution cycle",()=>{
    const state=applyOperatingCommand(initialOperatingState(),{kind:"START_RIGZIP_DRY_RUN",cycleId:"rigzip-nebraska-002"},"2026-08-27T12:00:00.000Z");
    expect(state.executionCycles).toHaveLength(1);
    expect(state.executionCycles[0]?.jobs).toHaveLength(13);
    expect(state.executionCycles[0]?.artifacts.externalEffects).toBe(0);
    expect(state.executionCycles[0]?.artifacts.distribution.state).toBe("BLOCKED");
    expect(()=>applyOperatingCommand(state,{kind:"START_RIGZIP_DRY_RUN",cycleId:"rigzip-nebraska-002"},"2026-08-27T12:01:00.000Z")).toThrow(/already exists/);
  });

  it("registers product sources before accepting cited evidence", () => {
    const sourceState = applyOperatingCommand(initialOperatingState(), { kind:"REGISTER_PRODUCT_SOURCE", source:{ brandId:"rigzip", kind:"WEBSITE", title:"RigZip website", locator:"https://rigzip.com", capturedAt:"2026-08-27T13:00:00.000Z" } }, "2026-08-27T13:00:00.000Z");
    const source = sourceState.productSources[0]!;
    const evidenceState = applyOperatingCommand(sourceState, { kind:"RECORD_PRODUCT_EVIDENCE", evidence:{ brandId:"rigzip", sourceId:source.id, statement:"RigZip serves commercial transport rental demand", classification:"FACT", confidence:.9, recordedAt:"2026-08-27T13:01:00.000Z" } }, "2026-08-27T13:01:00.000Z");
    expect(evidenceState.productEvidence).toHaveLength(1);
    expect(evidenceState.productEvidence[0]?.sourceId).toBe(source.id);
  });

  it("blocks a generic brand cycle until the evidence and strategy gates are complete",()=>{
    const brand={id:"neighborhood-tools",name:"Neighborhood Tools",archetype:"INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE",offering:"Rental of household tools",audience:"Neighbors and local owners",businessModel:"Transaction commission",objectives:["Validate local liquidity"],primaryValueEvent:"completed_rental",targetGeographies:["US"],languages:["en"],constraints:["No regulated equipment"],status:"DISCOVERY"} as const;
    const state={...initialOperatingState(),brandProfiles:[brand]};
    expect(()=>applyOperatingCommand(state,{kind:"START_BRAND_DRY_RUN",brandId:brand.id,cycleId:"tools-cycle-001"},"2026-08-27T14:00:00.000Z")).toThrow(/evidence gate is blocked/);
  });

  it("runs a generic brand only from registered evidence, diagnosis and expansion thesis",()=>{
    const now="2026-08-27T14:00:00.000Z";
    const brand={id:"neighborhood-tools",name:"Neighborhood Tools",archetype:"INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE",offering:"Rental of household tools",audience:"Neighbors and local owners",businessModel:"Transaction commission",objectives:["Validate local liquidity"],primaryValueEvent:"completed_rental",targetGeographies:["US"],languages:["en"],constraints:["No regulated equipment"],status:"DISCOVERY"} as const;
    const website=registerProductSource({brandId:brand.id,kind:"WEBSITE",title:"Product website",locator:"https://example.test",capturedAt:now});
    const interview=registerProductSource({brandId:brand.id,kind:"INTERVIEW",title:"Owner interview",locator:"interview://owner",capturedAt:now});
    const evidence=[
      recordProductEvidence({brandId:brand.id,sourceId:website.id,statement:"The service rents household tools between local neighbors.",classification:"FACT",confidence:.9,recordedAt:now},website),
      recordProductEvidence({brandId:brand.id,sourceId:website.id,statement:"The declared model charges a transaction commission.",classification:"FACT",confidence:.9,recordedAt:now},website),
      recordProductEvidence({brandId:brand.id,sourceId:interview.id,statement:"The first declared validation market is the United States.",classification:"FACT",confidence:.9,recordedAt:now},interview),
      recordProductEvidence({brandId:brand.id,sourceId:interview.id,statement:"Incremental acquisition efficiency is not yet known.",classification:"UNKNOWN",confidence:.5,recordedAt:now},interview),
    ];
    const diagnosis=createProductDiagnosis({brandId:brand.id,valueThesis:"Help neighbors access tools without buying rarely used equipment.",priorityAudiences:[brand.audience],customerProblems:["High ownership cost"],adoptionBarriers:["Trust and liquidity"],competitiveAlternatives:["Retail purchase"],materialRisks:["Low local supply"],unresolvedQuestions:["Which channel creates completed rentals"],evidenceIds:evidence.slice(0,3).map((item)=>item.id),createdAt:now},[website,interview],evidence);
    const thesis=createExpansionThesis({brandId:brand.id,diagnosisId:diagnosis.id,createdAt:now,candidates:[
      {countryCode:"US",geographyName:"Illinois",administrativeLevel:"STATE",demandScore:50,supplyScore:50,accessibilityScore:50,regulatoryScore:50,rationale:"Initial bounded validation geography for the marketplace concept.",assumptions:["Demand can be measured"],validationQuestions:["Does local liquidity emerge"]},
      {countryCode:"US",geographyName:"Wisconsin",administrativeLevel:"STATE",demandScore:45,supplyScore:45,accessibilityScore:50,regulatoryScore:50,rationale:"Comparable validation geography for transfer and control analysis.",assumptions:["Market structure is comparable"],validationQuestions:["Does the result transfer"]},
    ]},diagnosis);
    const state={...initialOperatingState(),brandProfiles:[brand],productSources:[website,interview],productEvidence:evidence,productDiagnoses:[diagnosis],expansionTheses:[thesis]};
    const result=applyOperatingCommand(state,{kind:"START_BRAND_DRY_RUN",brandId:brand.id,cycleId:"tools-cycle-001"},now);
    expect(result.executionCycles[0]).toMatchObject({brandId:brand.id,mode:"DRY_RUN",status:"COMPLETED"});
    expect(result.executionCycles[0]?.jobs).toHaveLength(13);
    expect(result.executionCycles[0]?.artifacts.sources.map((item)=>item.id)).toEqual([website.id,interview.id]);
    expect(result.executionCycles[0]?.artifacts.distribution.state).toBe("BLOCKED");
  });
});
