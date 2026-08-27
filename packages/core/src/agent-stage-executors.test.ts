import {describe,expect,it} from "vitest";
import {executeEvidenceBoundAgentChain,executeLegalReviewAgent} from "./agent-stage-executors.js";
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
    expect(result.experimentPlan.payload).toMatchObject({geography:"Nebraska",simulatedBudgetUsd:100,realSpendAuthorized:false});
    expect(result.experimentPlan.payload.channelCandidates).toContain("seo_local_landing");
    expect(result.creativeBrief.payload.providerDispatchAuthorized).toBe(false);
    expect(result.creativeBrief.payload.constraints).toContain("Do not publish");
    expect(result.legalReview.payload.decision.state).toBe("ALLOW");
    expect(result.legalReview.payload.gate).toEqual({contentAuthorized:true,providerDispatchAuthorized:false,reason:"DRY_RUN_EXTERNAL_EFFECTS_DISABLED"});
    for(const artifact of Object.values(result)) {
      expect(artifact.mode).toBe("DRY_RUN");
      expect(artifact.externalEffects).toBe(0);
      expect(artifact.agent.implementation).toBe("LOCAL_EVIDENCE_BOUND");
    }
  });

  it("withholds execution when the autonomous legal agent does not allow the creative",()=>{
    const artifacts=runGovernedRigZipCycle(runRigZipDryRun().packet);
    const result=executeEvidenceBoundAgentChain({cycleId:"rigzip-legal-gate",artifacts,createdAt:"2026-08-27T12:00:00.000Z"});
    const blockedArtifacts={...artifacts,legalDecision:{...artifacts.legalDecision,state:"BLOCK" as const,executionAuthority:"WITHHELD" as const,reasonCodes:["PROHIBITED_CLAIM"]}};
    expect(()=>executeLegalReviewAgent({cycleId:"rigzip-legal-block",artifacts:blockedArtifacts,creative:result.creativeBrief,createdAt:"2026-08-27T12:00:00.000Z"})).toThrow(/Legal gate withheld provider execution: PROHIBITED_CLAIM/);
  });
});
