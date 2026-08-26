import { describe, expect, it } from "vitest";
import { evaluateDistributionAuthorization } from "./policy.js";
import type { BrandId, CapitalDecision, ContentBrief, MarketCellId, WorkspaceId } from "./model.js";

const brandId = "rigzip" as BrandId;
const marketCellId = "cell" as MarketCellId;
const workspaceId = "lafwiron" as WorkspaceId;
const decision: CapitalDecision = {
  id: "decision",
  workspaceId,
  brandId,
  marketCellId,
  hypothesisId: "hypothesis",
  kind: "APPROVE",
  requestedUsd: 100,
  approvedUsd: 100,
  expectedIncrementalOutcome: 8,
  expectedMarginalValuePer100Usd: 8,
  confidence: "MEDIUM",
  evidenceIds: ["evidence"],
  policyVersion: "capital-v0",
  reasonCodes: ["SUPPORTED"],
  semanticClass: "FORECAST",
};
const brief: ContentBrief = {
  id: "brief",
  workspaceId,
  brandId,
  marketCellId,
  capitalDecisionId: decision.id,
  audience: "operators",
  message: "message",
  channel: "meta_ads",
  successMetric: "registrations",
  stopCondition: "stop",
};

describe("distribution authority", () => {
  it("authorizes only an exact production policy scope", () => {
    const result = evaluateDistributionAuthorization(brief, decision, {
      version: "distribution-v1",
      workspaceId,
      mode: "PRODUCTION",
      allowedBrands: [brandId],
      allowedChannels: [brief.channel],
      maximumSpendUsd: 50,
      expiresAt: "2026-08-27T00:00:00.000Z",
    });

    expect(result.state).toBe("AUTHORIZED");
    expect(result.maximumSpendUsd).toBe(50);
    expect(result.expiresAt).toBe("2026-08-27T00:00:00.000Z");
  });

  it("blocks a channel outside policy scope", () => {
    const result = evaluateDistributionAuthorization(brief, decision, {
      version: "distribution-v1",
      workspaceId,
      mode: "PRODUCTION",
      allowedBrands: [brandId],
      allowedChannels: ["email"],
      maximumSpendUsd: 100,
    });

    expect(result.state).toBe("BLOCKED");
    expect(result.reason).toContain("CHANNEL_NOT_ALLOWED");
  });

  it("blocks cross-workspace authority", () => {
    const result = evaluateDistributionAuthorization(brief, decision, {
      version: "distribution-v1",
      workspaceId: "external-customer",
      mode: "PRODUCTION",
      allowedBrands: [brandId],
      allowedChannels: [brief.channel],
      maximumSpendUsd: 100,
    });

    expect(result.state).toBe("BLOCKED");
    expect(result.reason).toContain("WORKSPACE_NOT_ALLOWED");
  });
});
