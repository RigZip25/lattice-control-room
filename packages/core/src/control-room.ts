import type { DecisionPacket } from "./model.js";
import type { FinancialAuthorityPolicy } from "./financial-authority.js";
import type { TreasuryWallet } from "./wallet.js";

export interface ControlRoomReadModel {
  readonly generatedAt: string;
  readonly workspace: { readonly id: string; readonly name: string; readonly mode: "DRY_RUN" | "LIVE" };
  readonly wallet: { readonly settledUsd: number; readonly availableUsd: number; readonly reservedUsd: number; readonly currency: "USD" };
  readonly authority: { readonly version: number; readonly maximumDecisionUsd: number; readonly maximumDailyUsd: number; readonly killSwitch: boolean };
  readonly portfolio: readonly { readonly brandId: string; readonly name: string; readonly stage: string; readonly status: string }[];
  readonly activeDecision: {
    readonly brandId: string;
    readonly marketCell: string;
    readonly hypothesis: string;
    readonly requestedUsd: number;
    readonly decision: string;
    readonly distributionState: string;
    readonly evidenceCount: number;
  };
  readonly approvals: readonly { readonly id: string; readonly kind: string; readonly amountUsd: number; readonly reason: string }[];
}

export function buildControlRoomReadModel(input: {
  readonly generatedAt: string;
  readonly packet: DecisionPacket;
  readonly wallet: TreasuryWallet;
  readonly authorityPolicy: FinancialAuthorityPolicy;
}): ControlRoomReadModel {
  const availableUsd = input.wallet.settledUsd - input.wallet.reservedUsd;
  if (availableUsd < 0) throw new Error("Wallet reserved balance exceeds settled balance");
  return {
    generatedAt: input.generatedAt,
    workspace: { id: input.packet.productSnapshot.workspaceId, name: "Lafwiron", mode: "DRY_RUN" },
    wallet: { settledUsd: input.wallet.settledUsd, availableUsd, reservedUsd: input.wallet.reservedUsd, currency: input.wallet.currency },
    authority: {
      version: input.authorityPolicy.version,
      maximumDecisionUsd: input.authorityPolicy.maximumAutonomousDecisionUsd,
      maximumDailyUsd: input.authorityPolicy.maximumAutonomousDailyUsd,
      killSwitch: input.authorityPolicy.killSwitch,
    },
    portfolio: [
      { brandId: "rigzip", name: "RigZip", stage: "PROVE", status: "ACTIVE" },
      { brandId: "evorios", name: "Evorios", stage: "DISCOVERY", status: "QUEUED" },
      { brandId: "books", name: "Books", stage: "DISCOVERY", status: "QUEUED" },
      { brandId: "travel", name: "Travel", stage: "DISCOVERY", status: "QUEUED" },
      { brandId: "navigator", name: "Smart Navigator", stage: "DISCOVERY", status: "QUEUED" },
    ],
    activeDecision: {
      brandId: input.packet.productSnapshot.brandId,
      marketCell: input.packet.marketCell.id,
      hypothesis: input.packet.hypothesis.proposition,
      requestedUsd: input.packet.capitalDecision.requestedUsd,
      decision: input.packet.capitalDecision.kind,
      distributionState: input.packet.distributionAuthorization.state,
      evidenceCount: input.packet.evidence.length,
    },
    approvals: input.packet.distributionAuthorization.state === "BLOCKED"
      ? [{ id: input.packet.distributionAuthorization.id, kind: "DISTRIBUTION", amountUsd: input.packet.distributionAuthorization.maximumSpendUsd, reason: input.packet.distributionAuthorization.reason }]
      : [],
  };
}
