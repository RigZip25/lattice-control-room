import { describe, expect, it } from "vitest";
import { runRigZipDryRun } from "./rigzip-scenario.js";

describe("Control Room vertical", () => {
  it("builds a safe RigZip dashboard from the governed decision packet", () => {
    const scenario = runRigZipDryRun();
    expect(scenario.readModel.workspace.mode).toBe("DRY_RUN");
    expect(scenario.readModel.activeDecision.decision).toBe("APPROVE");
    expect(scenario.readModel.activeDecision.distributionState).toBe("BLOCKED");
    expect(scenario.readModel.wallet.availableUsd).toBe(4700);
    expect(scenario.readModel.approvals).toHaveLength(1);
  });
});
