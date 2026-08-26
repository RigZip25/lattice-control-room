import { deterministicId } from "./identity.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";

export interface CapitalRequest {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId: MarketCellId;
  readonly hypothesisId: string;
  readonly requestedUsd: number;
  readonly forecastOutcome: number;
  readonly confidence: "LOW" | "MEDIUM" | "HIGH";
  readonly competingOpportunityId?: string;
}

export interface VentureDecision {
  readonly id: string;
  readonly requestId: string;
  readonly workspaceId: WorkspaceId;
  readonly kind: "APPROVE" | "MODIFY" | "DEFER" | "REJECT";
  readonly approvedUsd: number;
  readonly policyVersion: string;
  readonly reasonCodes: readonly string[];
}

export interface TreasuryEnvelope {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly authorizedUsd: number;
  readonly reservedUsd: number;
  readonly settledSpendUsd: number;
  readonly currency: "USD";
  readonly policyVersion: string;
}

export interface TreasuryReservation {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly envelopeId: string;
  readonly ventureDecisionId: string;
  readonly amountUsd: number;
  readonly state: "RESERVED" | "RELEASED" | "SETTLED";
}

export interface AllocationTicket {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly reservationId: string;
  readonly brandId: BrandId;
  readonly marketCellId: MarketCellId;
  readonly maximumSpendUsd: number;
  readonly state: "ISSUED" | "CLAIMED" | "SETTLED" | "EXPIRED";
}

export function reserveApprovedCapital(
  request: CapitalRequest,
  decision: VentureDecision,
  envelope: TreasuryEnvelope,
): { reservation: TreasuryReservation; ticket: AllocationTicket } {
  if (
    request.workspaceId !== decision.workspaceId ||
    request.workspaceId !== envelope.workspaceId
  ) {
    throw new Error("Cross-workspace capital flow is forbidden");
  }
  if (request.brandId !== envelope.brandId) {
    throw new Error("Treasury envelope belongs to another brand");
  }
  if (decision.requestId !== request.id) {
    throw new Error("Venture decision does not reference request");
  }
  if (decision.kind !== "APPROVE" && decision.kind !== "MODIFY") {
    throw new Error("Capital cannot be reserved without an approval");
  }
  const available =
    envelope.authorizedUsd - envelope.reservedUsd - envelope.settledSpendUsd;
  if (decision.approvedUsd <= 0 || decision.approvedUsd > available) {
    throw new Error("Insufficient authorized Treasury capital");
  }

  const reservationPayload = {
    workspaceId: request.workspaceId,
    envelopeId: envelope.id,
    ventureDecisionId: decision.id,
    amountUsd: decision.approvedUsd,
    state: "RESERVED" as const,
  };
  const reservation: TreasuryReservation = {
    id: deterministicId("reservation", reservationPayload),
    ...reservationPayload,
  };
  const ticketPayload = {
    workspaceId: request.workspaceId,
    reservationId: reservation.id,
    brandId: request.brandId,
    marketCellId: request.marketCellId,
    maximumSpendUsd: decision.approvedUsd,
    state: "ISSUED" as const,
  };
  return {
    reservation,
    ticket: { id: deterministicId("allocation_ticket", ticketPayload), ...ticketPayload },
  };
}

