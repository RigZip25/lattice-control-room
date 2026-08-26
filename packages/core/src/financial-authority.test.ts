import { describe, expect, it } from "vitest";
import { defineFinancialAuthorityPolicy, evaluateFinancialAuthority } from "./financial-authority.js";
import type { BrandId, WorkspaceId } from "./model.js";

const workspaceId = "lafwiron" as WorkspaceId;
const brandId = "rigzip" as BrandId;

function policy(limit: number, version = 1) {
  return defineFinancialAuthorityPolicy({
    workspaceId,
    version,
    effectiveAt: "2026-08-26T00:00:00.000Z",
    currency: "USD",
    maximumAutonomousDecisionUsd: limit,
    maximumAutonomousDailyUsd: 2000,
    maximumReservedExposureUsd: 5000,
    brandLimitsUsd: { rigzip: 1000 },
    killSwitch: false,
  });
}

function evaluate(amountUsd: number, selectedPolicy = policy(500)) {
  return evaluateFinancialAuthority({
    policy: selectedPolicy,
    workspaceId,
    brandId,
    ventureDecisionId: "decision-1",
    amountUsd,
    autonomousSpendLast24HoursUsd: 200,
    currentReservedExposureUsd: 500,
    evaluatedAt: "2026-08-26T12:00:00.000Z",
  });
}

describe("dynamic financial authority", () => {
  it("authorizes a decision inside the delegated limit", () => {
    expect(evaluate(400).result).toBe("AUTONOMOUSLY_AUTHORIZED");
  });

  it("routes a larger decision to human approval", () => {
    const result = evaluate(600);
    expect(result.result).toBe("HUMAN_APPROVAL_REQUIRED");
    expect(result.reasonCodes).toContain("PER_DECISION_LIMIT_EXCEEDED");
  });

  it("applies a changed limit through a new policy version", () => {
    const raised = policy(750, 2);
    expect(evaluate(600, raised).result).toBe("AUTONOMOUSLY_AUTHORIZED");
    expect(raised.version).toBe(2);
  });

  it("denies all new authority when the kill switch is active", () => {
    const base = policy(500);
    const stopped = defineFinancialAuthorityPolicy({
      workspaceId: base.workspaceId,
      version: 2,
      effectiveAt: base.effectiveAt,
      currency: base.currency,
      maximumAutonomousDecisionUsd: base.maximumAutonomousDecisionUsd,
      maximumAutonomousDailyUsd: base.maximumAutonomousDailyUsd,
      maximumReservedExposureUsd: base.maximumReservedExposureUsd,
      brandLimitsUsd: base.brandLimitsUsd,
      killSwitch: true,
    });
    expect(evaluate(100, stopped).result).toBe("DENIED");
  });
});
