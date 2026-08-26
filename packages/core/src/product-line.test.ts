import { describe, expect, it } from "vitest";
import { defineGrowthContract } from "./product-line.js";
import type { BrandId, WorkspaceId } from "./model.js";

describe("product-specific growth contracts", () => {
  it("keeps marketplace and content value models distinct", () => {
    const rigzip = defineGrowthContract({
      workspaceId: "lafwiron" as WorkspaceId,
      brandId: "rigzip" as BrandId,
      version: 1,
      archetype: "LOCAL_TWO_SIDED_MARKETPLACE",
      valueEvent: "completed_asset_match",
      marketCellDimensions: ["geography", "asset_vertical"],
      lifecycleStages: ["SCOUT", "PROVE", "SCALE", "MAINTAIN"],
      constraintMetrics: ["qualified_supply"],
      outcomeMetrics: ["completed_matches", "contribution_usd"],
      eligiblePlaybooks: ["SUPPLY_FIRST", "DEMAND_FIRST"],
    });
    const books = defineGrowthContract({
      workspaceId: "lafwiron" as WorkspaceId,
      brandId: "lafwiron-books" as BrandId,
      version: 1,
      archetype: "CONTENT_IP_PORTFOLIO",
      valueEvent: "verified_reader_purchase",
      marketCellDimensions: ["audience", "language", "theme"],
      lifecycleStages: ["DISCOVER", "LAUNCH", "GROW", "CATALOG"],
      constraintMetrics: [],
      outcomeMetrics: ["verified_purchases", "reader_referrals"],
      eligiblePlaybooks: ["EXCERPT_TEST", "AUTHOR_STORY", "READER_PROOF"],
    });

    expect(rigzip.id).not.toBe(books.id);
    expect(rigzip.outcomeMetrics).not.toContain("verified_purchases");
    expect(books.outcomeMetrics).not.toContain("completed_matches");
  });
});
