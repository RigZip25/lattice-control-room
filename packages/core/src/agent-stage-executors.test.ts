import {describe,expect,it} from "vitest";
import {executeEvidenceBoundAgentChain} from "./agent-stage-executors.js";
import {runGovernedRigZipCycle} from "./governed-cycle.js";
import {runRigZipDryRun} from "./rigzip-scenario.js";

describe("evidence-bound stage agents",()=>{
  it("produces provenance-rich intelligence, diagnosis and expansion artifacts",()=>{
    const artifacts=runGovernedRigZipCycle(runRigZipDryRun().packet);
    const result=executeEvidenceBoundAgentChain({cycleId:"rigzip-agent-chain",artifacts,createdAt:"2026-08-27T12:00:00.000Z"});
    expect(result.intelligence.payload.readiness.state).toBe("READY_FOR_DIAGNOSIS");
    expect(result.intelligence.facts.length).toBeGreaterThanOrEqual(3);
    expect(result.intelligence.unknowns).toContain("The strongest acquisition channel remains to be validated.");
    expect(result.diagnosis.evidenceRefs).toHaveLength(3);
    expect(result.diagnosis.unknowns.length).toBeGreaterThan(0);
    expect(result.expansion.payload.ranking).toHaveLength(2);
    expect(result.expansion.payload.recommendedCandidate).toBe("Nebraska");
    for(const artifact of Object.values(result)) {
      expect(artifact.mode).toBe("DRY_RUN");
      expect(artifact.externalEffects).toBe(0);
      expect(artifact.agent.implementation).toBe("LOCAL_EVIDENCE_BOUND");
    }
  });
});
