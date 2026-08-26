import { describe, expect, it } from "vitest";
import { InMemoryDecisionPacketStore } from "./decision-packet-store.js";
import type { DecisionPacket, WorkspaceId } from "./model.js";

function packet(workspace: string, decisionId: string): DecisionPacket {
  const workspaceId = workspace as WorkspaceId;
  return {
    productSnapshot: {
      id: `snapshot-${workspace}`,
      workspaceId,
      brandId: "brand" as DecisionPacket["productSnapshot"]["brandId"],
      sourceRepository: "owner/repo",
      sourceRevision: "0123456789012345678901234567890123456789",
      capturedAt: "2026-08-26T00:00:00.000Z",
      facts: [],
    },
    brandPackage: {
      id: "package",
      workspaceId,
      brandId: "brand" as DecisionPacket["brandPackage"]["brandId"],
      productSnapshotId: `snapshot-${workspace}`,
      version: 1,
      problem: "problem",
      audiences: ["audience"],
      valueClaims: [],
      hardConstraints: [],
    },
    marketCell: {
      id: "cell" as DecisionPacket["marketCell"]["id"],
      workspaceId,
      brandId: "brand" as DecisionPacket["marketCell"]["brandId"],
      countryCode: "US",
      geographyPath: ["US"],
      segment: "segment",
      denominator: {
        kind: "entities",
        value: 1,
        observedAt: "2026-08-26T00:00:00.000Z",
        semanticClass: "FACT",
      },
    },
    hypothesis: {
      id: "hypothesis",
      workspaceId,
      brandId: "brand" as DecisionPacket["hypothesis"]["brandId"],
      marketCellId: "cell" as DecisionPacket["hypothesis"]["marketCellId"],
      brandPackageId: "package",
      proposition: "proposition",
      counterHypothesis: "counter",
      successMetric: "metric",
      minimumEffect: 1,
      priorConfidence: "LOW",
      status: "ACTIVE",
    },
    evidence: [],
    capitalDecision: {
      id: decisionId,
      workspaceId,
      brandId: "brand" as DecisionPacket["capitalDecision"]["brandId"],
      marketCellId: "cell" as DecisionPacket["capitalDecision"]["marketCellId"],
      hypothesisId: "hypothesis",
      kind: "DEFER",
      requestedUsd: 100,
      approvedUsd: 0,
      expectedIncrementalOutcome: 0,
      expectedMarginalValuePer100Usd: 0,
      confidence: "LOW",
      evidenceIds: [],
      policyVersion: "v0",
      reasonCodes: ["INSUFFICIENT_EVIDENCE"],
      semanticClass: "FORECAST",
    },
    contentBrief: {
      id: "brief",
      workspaceId,
      brandId: "brand" as DecisionPacket["contentBrief"]["brandId"],
      marketCellId: "cell" as DecisionPacket["contentBrief"]["marketCellId"],
      capitalDecisionId: decisionId,
      audience: "audience",
      message: "message",
      channel: "channel",
      successMetric: "metric",
      stopCondition: "stop",
    },
    distributionAuthorization: {
      id: "auth",
      workspaceId,
      brandId: "brand" as DecisionPacket["distributionAuthorization"]["brandId"],
      marketCellId: "cell" as DecisionPacket["distributionAuthorization"]["marketCellId"],
      contentBriefId: "brief",
      channel: "channel",
      state: "BLOCKED",
      maximumSpendUsd: 0,
      policyVersion: "v0",
      reason: "BLOCKED",
    },
  };
}

describe("decision packet store", () => {
  it("is replay-safe and workspace-isolated", async () => {
    const store = new InMemoryDecisionPacketStore();
    const lafwiron = packet("lafwiron", "decision-1");
    const external = packet("external", "decision-1");

    await expect(store.append(lafwiron)).resolves.toBe("INSERTED");
    await expect(store.append(lafwiron)).resolves.toBe("IDEMPOTENT_REPLAY");
    await expect(store.append(external)).resolves.toBe("INSERTED");

    await expect(store.list("lafwiron" as WorkspaceId)).resolves.toHaveLength(1);
    await expect(store.list("external" as WorkspaceId)).resolves.toHaveLength(1);
    await expect(store.get("missing" as WorkspaceId, "decision-1")).resolves.toBeUndefined();
  });

  it("rejects a conflicting payload under the same identity", async () => {
    const store = new InMemoryDecisionPacketStore();
    const original = packet("lafwiron", "decision-1");
    await store.append(original);
    const conflict = {
      ...original,
      capitalDecision: { ...original.capitalDecision, requestedUsd: 999 },
    };

    await expect(store.append(conflict)).rejects.toThrow(/Conflicting/);
  });
});

