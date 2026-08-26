import { describe, expect, it } from "vitest";
import { reserveApprovedCapital, type CapitalRequest, type TreasuryEnvelope, type VentureDecision } from "./capital.js";
import type { FinancialAuthorityEvaluation } from "./financial-authority.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";

const workspaceId = "lafwiron" as WorkspaceId;
const brandId = "rigzip" as BrandId;
const request: CapitalRequest = {
  id: "request-1",
  workspaceId,
  brandId,
  marketCellId: "cell-1" as MarketCellId,
  hypothesisId: "hypothesis-1",
  requestedUsd: 100,
  forecastOutcome: 8,
  confidence: "MEDIUM",
};
const decision: VentureDecision = {
  id: "decision-1",
  requestId: request.id,
  workspaceId,
  kind: "APPROVE",
  approvedUsd: 100,
  policyVersion: "venture-v1",
  reasonCodes: ["MARGINAL_VALUE_ABOVE_HURDLE"],
};
const envelope: TreasuryEnvelope = {
  id: "envelope-1",
  workspaceId,
  brandId,
  authorizedUsd: 1000,
  reservedUsd: 200,
  settledSpendUsd: 300,
  currency: "USD",
  policyVersion: "treasury-v1",
};
const authority: FinancialAuthorityEvaluation = {
  id: "authority-1",
  workspaceId,
  policyId: "authority-policy-1",
  ventureDecisionId: decision.id,
  result: "AUTONOMOUSLY_AUTHORIZED",
  reasonCodes: ["WITHIN_DELEGATED_AUTHORITY"],
  evaluatedAmountUsd: 100,
};

describe("Finance and Venture boundary", () => {
  it("turns an approved Venture decision into a Treasury reservation and ticket", () => {
    const result = reserveApprovedCapital(request, decision, envelope, authority);
    expect(result.reservation.amountUsd).toBe(100);
    expect(result.reservation.state).toBe("RESERVED");
    expect(result.ticket.maximumSpendUsd).toBe(100);
    expect(result.ticket.state).toBe("ISSUED");
  });

  it("rejects a decision that exceeds available authorized capital", () => {
    expect(() =>
      reserveApprovedCapital(
        request,
        { ...decision, approvedUsd: 600 },
        envelope,
        { ...authority, evaluatedAmountUsd: 600 },
      ),
    ).toThrow(/Insufficient authorized/);
  });

  it("rejects a deferred Venture decision", () => {
    expect(() =>
      reserveApprovedCapital(
        request,
        { ...decision, kind: "DEFER", approvedUsd: 0 },
        envelope,
        authority,
      ),
    ).toThrow(/without an approval/);
  });

  it("rejects an autonomous authority evaluation requiring human approval", () => {
    expect(() =>
      reserveApprovedCapital(request, decision, envelope, {
        ...authority,
        result: "HUMAN_APPROVAL_REQUIRED",
        reasonCodes: ["PER_DECISION_LIMIT_EXCEEDED"],
      }),
    ).toThrow(/authority is insufficient/);
  });
});
