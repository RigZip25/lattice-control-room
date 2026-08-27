import { describe, expect, it } from "vitest";
import { runGovernedRigZipCycle } from "./governed-cycle.js";
import { runRigZipDryRun } from "./rigzip-scenario.js";

describe("governed RigZip cycle", () => {
  it("creates real internal artifacts while all external execution stays blocked", () => {
    const scenario = runRigZipDryRun();
    const result = runGovernedRigZipCycle(scenario.packet);
    expect(result.readiness.state).toBe("READY_FOR_DIAGNOSIS");
    expect(result.diagnosis.evidenceIds).toHaveLength(3);
    expect(result.expansionThesis.candidates).toHaveLength(2);
    expect(result.legalDecision.state).toBe("ALLOW");
    expect(result.providerRequest.externalExecution).toBe("BLOCKED");
    expect(result.qaPacket.stage).toBe("LIBRARY_APPROVED");
    expect(result.libraryAsset.state).toBe("APPROVED");
    expect(result.distribution.state).toBe("BLOCKED");
    expect(result.distribution.reason).toBe("DRY_RUN_PREVENTS_EXTERNAL_DISTRIBUTION");
    expect(result.metricEvent.semanticClass).toBe("FORECAST");
    expect(result.report.spendUsd).toBe(0);
    expect(result.externalEffects).toBe(0);
  });
});
