import { describe, expect, it } from "vitest";
import { reserveApprovedCapital, type CapitalRequest, type TreasuryEnvelope, type VentureDecision } from "./capital.js";
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

describe("Finance and Venture boundary", () => {
  it("turns an approved Venture decision into a Treasury reservation and ticket", () => {
    const result = reserveApprovedCapital(request, decision, envelope);
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
      ),
    ).toThrow(/Insufficient authorized/);
  });

  it("rejects a deferred Venture decision", () => {
    expect(() =>
      reserveApprovedCapital(request, { ...decision, kind: "DEFER", approvedUsd: 0 }, envelope),
    ).toThrow(/without an approval/);
  });
});

