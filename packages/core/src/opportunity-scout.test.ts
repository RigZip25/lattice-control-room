import { describe, expect, it } from "vitest";
import { proposeOpportunity, type OpportunitySignal } from "./opportunity-scout.js";
import type { BrandId, WorkspaceId } from "./model.js";

const workspaceId = "lafwiron" as WorkspaceId;
const brandId = "evorios" as BrandId;
const signal: OpportunitySignal = {
  id: "signal-1",
  workspaceId,
  brandId,
  sourceId: "public-search-demand",
  observedAt: "2026-08-26T00:00:00.000Z",
  kind: "LOCAL_RECOMMERCE_INTENT",
  value: 0.8,
  confidence: 0.75,
  provenanceRef: "fixture://signals/intent",
};

describe("opportunity scout", () => {
  it("requests more research when a required signal is missing", () => {
    const proposal = proposeOpportunity({
      workspaceId,
      brandId,
      proposition: "A sell-first entry can establish neighborhood liquidity.",
      counterHypothesis: "Intent exists but local trust prevents transactions.",
      signals: [signal],
      requiredSignalKinds: ["LOCAL_RECOMMERCE_INTENT", "TRUST_READINESS"],
      maximumResearchCostUsd: 25,
    });

    expect(proposal.recommendedNextStep).toBe("RESEARCH");
    expect(proposal.missingEvidence).toEqual(["TRUST_READINESS"]);
  });

  it("rejects cross-workspace signals", () => {
    expect(() =>
      proposeOpportunity({
        workspaceId,
        brandId,
        proposition: "proposition",
        counterHypothesis: "counter",
        signals: [{ ...signal, workspaceId: "customer-b" as WorkspaceId }],
        requiredSignalKinds: [],
        maximumResearchCostUsd: 10,
      }),
    ).toThrow(/scope mismatch/);
  });
});

