import { describe, expect, it } from "vitest";
import type { BrandId, WorkspaceId } from "./model.js";
import { authorizeProjectBudget, recordSettledDeposit, type FundingConnection, type TreasuryWallet } from "./wallet.js";

const workspaceId = "lafwiron" as WorkspaceId;
const wallet: TreasuryWallet = { id: "wallet-1", workspaceId, currency: "USD", settledUsd: 0, pendingUsd: 0, reservedUsd: 0 };
const connection: FundingConnection = { id: "funding-1", workspaceId, rail: "PAYPAL", providerReference: "vault-token-not-secret", state: "ACTIVE", capabilities: ["DEPOSIT"] };

describe("Treasury wallet funding", () => {
  it("credits only a settled provider event and allocates a bounded project budget", () => {
    const funded = recordSettledDeposit({ connection, wallet, externalEventId: "paypal-event-1", amountUsd: 1000, occurredAt: "2026-08-26T12:00:00.000Z" });
    const budget = authorizeProjectBudget({ wallet: funded.wallet, brandId: "rigzip" as BrandId, amountUsd: 300, policyVersion: 1 });
    expect(funded.wallet.settledUsd).toBe(1000);
    expect(funded.entry.kind).toBe("DEPOSIT_SETTLED");
    expect(budget.authorizedUsd).toBe(300);
  });

  it("never treats pending money as spendable", () => {
    expect(() => authorizeProjectBudget({ wallet: { ...wallet, pendingUsd: 1000 }, brandId: "rigzip" as BrandId, amountUsd: 1, policyVersion: 1 })).toThrow(/settled/);
  });
});
