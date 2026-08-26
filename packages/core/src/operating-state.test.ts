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
    const command = { kind:"ADD_DISCOVERY_MARKET", market:{ countryCode:"DE", countryName:"Германия", slug:"germaniya", brand:"Evorios", activity:"neighbor marketplace", status:"DISCOVERY" } } as const;
    const state = applyOperatingCommand(initialOperatingState(), command, "2026-08-26T12:00:00.000Z");
    expect(state.discoveryMarkets).toHaveLength(1);
    expect(() => applyOperatingCommand(state, command, "2026-08-26T12:01:00.000Z")).toThrow(/already exists/);
  });

  it("rejects malformed commands at the runtime boundary", () => {
    expect(() => applyOperatingCommand(initialOperatingState(), { kind:"SET_FILTER", filter:"UNKNOWN" } as never, "2026-08-26T12:00:00.000Z")).toThrow(/Filter command/);
    expect(() => applyOperatingCommand(initialOperatingState(), { kind:"SPEND_FUNDS" } as never, "2026-08-26T12:00:00.000Z")).toThrow(/kind/);
  });
});
