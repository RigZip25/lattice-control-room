import { describe, expect, it } from "vitest";
import { DecisionService, type Principal } from "./decision-service.js";
import { InMemoryDecisionPacketStore } from "./decision-packet-store.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";

const workspaceId = "lafwiron" as WorkspaceId;
const brandId = "rigzip" as BrandId;
const marketCellId = "rigzip:us:nebraska:trailers" as MarketCellId;

const principal: Principal = {
  subjectId: "owner-1",
  workspaceId,
  allowedBrandIds: [brandId],
  roles: ["OWNER"],
};

function input() {
  return {
    productSnapshot: {
      id: "snapshot",
      workspaceId,
      brandId,
      sourceRepository: "owner/repo",
      sourceRevision: "0123456789012345678901234567890123456789",
      capturedAt: "2026-08-26T00:00:00.000Z",
      facts: [],
    },
    brandPackageDraft: {
      problem: "problem",
      audiences: ["audience"],
      claims: [],
      hardConstraints: [],
    },
    marketCell: {
      id: marketCellId,
      workspaceId,
      brandId,
      countryCode: "US",
      geographyPath: ["Nebraska"],
      segment: "Trailers",
      denominator: {
        kind: "operators",
        value: 100,
        observedAt: "2026-08-26T00:00:00.000Z",
        semanticClass: "FACT" as const,
      },
    },
    hypothesis: {
      workspaceId,
      brandId,
      marketCellId,
      proposition: "proposition",
      counterHypothesis: "counter",
      successMetric: "value_per_usd",
      minimumEffect: 0.05,
      priorConfidence: "MEDIUM" as const,
    },
    evidence: [
      {
        observedAt: "2026-08-26T00:00:00.000Z",
        metric: "value_per_usd",
        value: 0.1,
        sampleSize: 100,
        quality: "USABLE" as const,
        semanticClass: "FACT" as const,
        sourceRef: "fixture://evidence",
      },
    ],
    requestedUsd: 100,
    policyVersion: "capital-v0",
    content: {
      audience: "audience",
      message: "message",
      channel: "channel",
      stopCondition: "stop",
    },
    distributionPolicy: {
      version: "distribution-v0",
      workspaceId,
      mode: "DRY_RUN" as const,
      allowedBrands: [brandId],
      allowedChannels: ["channel"],
      maximumSpendUsd: 100,
    },
  };
}

describe("decision application service", () => {
  it("persists and returns a brand-scoped decision summary", async () => {
    const service = new DecisionService(new InMemoryDecisionPacketStore());
    const evaluated = await service.evaluate(principal, input());
    const listed = await service.list(principal);

    expect(evaluated.result).toBe("INSERTED");
    expect(listed).toEqual([evaluated.decision]);
    expect(listed[0]?.authorizationState).toBe("BLOCKED");
  });

  it("denies evaluation to a viewer", async () => {
    const service = new DecisionService(new InMemoryDecisionPacketStore());
    await expect(
      service.evaluate({ ...principal, roles: ["VIEWER"] }, input()),
    ).rejects.toThrow(/may not evaluate/);
  });

  it("denies another workspace before executing the loop", async () => {
    const service = new DecisionService(new InMemoryDecisionPacketStore());
    await expect(
      service.evaluate(
        { ...principal, workspaceId: "external" as WorkspaceId },
        input(),
      ),
    ).rejects.toThrow(/workspace/);
  });
});

