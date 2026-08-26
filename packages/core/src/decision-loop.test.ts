import { describe, expect, it } from "vitest";
import { runDecisionLoop } from "./decision-loop.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";

const brandId = "rigzip" as BrandId;
const marketCellId = "rigzip:us:nebraska:trailers" as MarketCellId;
const workspaceId = "lafwiron" as WorkspaceId;

function fixture() {
  return {
    productSnapshot: {
      id: "snapshot_rigzip_abc123",
      workspaceId,
      brandId,
      sourceRepository: "RigZip25/rigzip",
      sourceRevision: "0123456789012345678901234567890123456789",
      capturedAt: "2026-08-26T12:00:00.000Z",
      facts: [
        {
          key: "asset_marketplace",
          value: "Commercial asset rental marketplace",
          sourcePath: "README.md",
          semanticClass: "FACT" as const,
        },
      ],
    },
    brandPackageDraft: {
      problem: "Commercial operators lose time when required equipment is unavailable.",
      audiences: ["small fleet operators"],
      claims: [
        {
          statement: "Find nearby commercial assets",
          evidenceFactKeys: ["asset_marketplace"],
        },
      ],
      hardConstraints: ["No fabricated inventory"],
    },
    marketCell: {
      id: marketCellId,
      workspaceId,
      brandId,
      countryCode: "US",
      geographyPath: ["Nebraska", "Cluster 14"],
      segment: "Trailers",
      denominator: {
        kind: "eligible_operators",
        value: 1200,
        observedAt: "2026-08-20T00:00:00.000Z",
        semanticClass: "FACT" as const,
      },
    },
    hypothesis: {
      workspaceId,
      brandId,
      marketCellId,
      proposition: "A trailer-availability message produces qualified registrations.",
      counterHypothesis: "Operators already solve availability through existing relationships.",
      successMetric: "qualified_registrations_per_usd",
      minimumEffect: 0.05,
      priorConfidence: "MEDIUM" as const,
    },
    evidence: [
      {
        observedAt: "2026-08-25T00:00:00.000Z",
        metric: "qualified_registrations_per_usd",
        value: 0.08,
        sampleSize: 80,
        quality: "USABLE" as const,
        semanticClass: "FACT" as const,
        sourceRef: "fixture://scout/nebraska/a",
      },
      {
        observedAt: "2026-08-25T00:00:00.000Z",
        metric: "qualified_registrations_per_usd",
        value: 0.06,
        sampleSize: 70,
        quality: "USABLE" as const,
        semanticClass: "FACT" as const,
        sourceRef: "fixture://scout/nebraska/b",
      },
    ],
    requestedUsd: 100,
    policyVersion: "capital-v0",
    content: {
      audience: "small fleet operators in Nebraska",
      message: "Find the trailer your next job requires without idle ownership.",
      channel: "meta_ads",
      stopCondition: "Stop if qualified registrations per USD falls below 0.05.",
    },
    distributionPolicy: {
      version: "distribution-v0",
      workspaceId,
      mode: "DRY_RUN" as const,
      allowedBrands: [brandId],
      allowedChannels: ["meta_ads"],
      maximumSpendUsd: 100,
    },
  };
}

describe("first vertical decision loop", () => {
  it("produces a deterministic approved decision while blocking distribution", () => {
    const first = runDecisionLoop(fixture());
    const second = runDecisionLoop(fixture());

    expect(second).toEqual(first);
    expect(first.brandPackage.valueClaims[0]?.status).toBe("SUPPORTED");
    expect(first.capitalDecision.kind).toBe("APPROVE");
    expect(first.capitalDecision.approvedUsd).toBe(100);
    expect(first.capitalDecision.semanticClass).toBe("FORECAST");
    expect(first.distributionAuthorization.state).toBe("BLOCKED");
    expect(first.distributionAuthorization.reason).toContain(
      "PRODUCTION_MODE_DISABLED",
    );
  });

  it("defers capital when evidence is insufficient", () => {
    const input = fixture();
    const packet = runDecisionLoop({
      ...input,
      evidence: [
        {
          ...input.evidence[0]!,
          value: 0.02,
          sampleSize: 10,
        },
      ],
    });

    expect(packet.capitalDecision.kind).toBe("DEFER");
    expect(packet.capitalDecision.approvedUsd).toBe(0);
    expect(packet.distributionAuthorization.state).toBe("BLOCKED");
    expect(packet.distributionAuthorization.reason).toContain(
      "CAPITAL_NOT_APPROVED",
    );
  });

  it("fails closed on cross-brand input", () => {
    const input = fixture();
    expect(() =>
      runDecisionLoop({
        ...input,
        marketCell: {
          ...input.marketCell,
          brandId: "evorios" as BrandId,
        },
      }),
    ).toThrow(/Brand isolation violation/);
  });

  it("fails closed on cross-workspace input", () => {
    const input = fixture();
    expect(() =>
      runDecisionLoop({
        ...input,
        marketCell: {
          ...input.marketCell,
          workspaceId: "external-customer" as WorkspaceId,
        },
      }),
    ).toThrow(/Workspace isolation violation/);
  });
});
