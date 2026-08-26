import { deterministicId } from "./identity.js";
import type { BrandId, WorkspaceId } from "./model.js";

export type FundingRail = "BANK_ACH" | "PAYPAL";

export interface FundingConnection {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly rail: FundingRail;
  readonly providerReference: string;
  readonly state: "PENDING_OWNER_CONSENT" | "ACTIVE" | "SUSPENDED" | "REVOKED";
  readonly capabilities: readonly ("DEPOSIT" | "WITHDRAW")[];
}

export interface TreasuryWallet {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly currency: "USD";
  readonly settledUsd: number;
  readonly pendingUsd: number;
  readonly reservedUsd: number;
}

export interface WalletLedgerEntry {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly walletId: string;
  readonly externalEventId: string;
  readonly kind: "DEPOSIT_PENDING" | "DEPOSIT_SETTLED" | "DEPOSIT_REVERSED";
  readonly amountUsd: number;
  readonly occurredAt: string;
}

export interface ProjectBudgetEnvelope {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly walletId: string;
  readonly brandId: BrandId;
  readonly authorizedUsd: number;
  readonly reservedUsd: number;
  readonly spentUsd: number;
  readonly policyVersion: number;
}

export function availableWalletBalance(wallet: TreasuryWallet): number {
  return wallet.settledUsd - wallet.reservedUsd;
}

export function recordSettledDeposit(input: {
  readonly connection: FundingConnection;
  readonly wallet: TreasuryWallet;
  readonly externalEventId: string;
  readonly amountUsd: number;
  readonly occurredAt: string;
}): { wallet: TreasuryWallet; entry: WalletLedgerEntry } {
  if (input.connection.workspaceId !== input.wallet.workspaceId) {
    throw new Error("Funding connection belongs to another workspace");
  }
  if (input.connection.state !== "ACTIVE" || !input.connection.capabilities.includes("DEPOSIT")) {
    throw new Error("Funding connection cannot accept deposits");
  }
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    throw new Error("Deposit must be a positive finite amount");
  }
  const payload = {
    workspaceId: input.wallet.workspaceId,
    walletId: input.wallet.id,
    externalEventId: input.externalEventId,
    kind: "DEPOSIT_SETTLED" as const,
    amountUsd: input.amountUsd,
    occurredAt: input.occurredAt,
  };
  return {
    wallet: { ...input.wallet, settledUsd: input.wallet.settledUsd + input.amountUsd },
    entry: { id: deterministicId("wallet_entry", payload), ...payload },
  };
}

export function authorizeProjectBudget(input: {
  readonly wallet: TreasuryWallet;
  readonly brandId: BrandId;
  readonly amountUsd: number;
  readonly policyVersion: number;
}): ProjectBudgetEnvelope {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd <= 0) {
    throw new Error("Project budget must be a positive finite amount");
  }
  if (input.amountUsd > availableWalletBalance(input.wallet)) {
    throw new Error("Project budget exceeds settled unreserved wallet balance");
  }
  const payload = {
    workspaceId: input.wallet.workspaceId,
    walletId: input.wallet.id,
    brandId: input.brandId,
    authorizedUsd: input.amountUsd,
    reservedUsd: 0,
    spentUsd: 0,
    policyVersion: input.policyVersion,
  };
  return { id: deterministicId("project_budget", payload), ...payload };
}
