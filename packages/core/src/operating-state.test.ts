import { describe, expect, it } from "vitest";
import { applyOperatingCommand, initialOperatingState } from "./operating-state.js";

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

  it("registers product sources before accepting cited evidence", () => {
    const sourceState = applyOperatingCommand(initialOperatingState(), { kind:"REGISTER_PRODUCT_SOURCE", source:{ brandId:"rigzip", kind:"WEBSITE", title:"RigZip website", locator:"https://rigzip.com", capturedAt:"2026-08-27T13:00:00.000Z" } }, "2026-08-27T13:00:00.000Z");
    const source = sourceState.productSources[0]!;
    const evidenceState = applyOperatingCommand(sourceState, { kind:"RECORD_PRODUCT_EVIDENCE", evidence:{ brandId:"rigzip", sourceId:source.id, statement:"RigZip serves commercial transport rental demand", classification:"FACT", confidence:.9, recordedAt:"2026-08-27T13:01:00.000Z" } }, "2026-08-27T13:01:00.000Z");
    expect(evidenceState.productEvidence).toHaveLength(1);
    expect(evidenceState.productEvidence[0]?.sourceId).toBe(source.id);
  });
});
