import { buildControlRoomReadModel } from "./control-room.js";
import { runDecisionLoop } from "./decision-loop.js";
import { defineFinancialAuthorityPolicy } from "./financial-authority.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";
import { defineGrowthContract } from "./product-line.js";
import type { TreasuryWallet } from "./wallet.js";

export function runRigZipDryRun() {
  const brandId = "rigzip" as BrandId;
  const marketCellId = "rigzip:us:nebraska:trailers" as MarketCellId;
  const workspaceId = "lafwiron" as WorkspaceId;
  const packet = runDecisionLoop({
    productSnapshot: { id: "snapshot_rigzip_demo", workspaceId, brandId, sourceRepository: "RigZip25/rigzip", sourceRevision: "0123456789012345678901234567890123456789", capturedAt: "2026-08-26T12:00:00.000Z", facts: [{ key: "asset_marketplace", value: "Commercial asset rental marketplace", sourcePath: "README.md", semanticClass: "FACT" }] },
    growthContract: defineGrowthContract({ workspaceId, brandId, version: 1, archetype: "LOCAL_TWO_SIDED_MARKETPLACE", valueEvent: "completed_asset_match", marketCellDimensions: ["geography", "asset_vertical"], lifecycleStages: ["SCOUT", "PROVE", "SCALE", "MAINTAIN"], constraintMetrics: ["qualified_supply", "qualified_demand"], outcomeMetrics: ["qualified_registrations_per_usd", "completed_asset_matches"], eligiblePlaybooks: ["SUPPLY_FIRST", "DEMAND_FIRST"] }),
    brandPackageDraft: { problem: "Operators lose time when required equipment is unavailable.", audiences: ["small fleet operators"], claims: [{ statement: "Find nearby commercial assets", evidenceFactKeys: ["asset_marketplace"] }], hardConstraints: ["No fabricated inventory"] },
    marketCell: { id: marketCellId, workspaceId, brandId, countryCode: "US", geographyPath: ["Nebraska", "Cluster 14"], segment: "Trailers", denominator: { kind: "eligible_operators", value: 1200, observedAt: "2026-08-20T00:00:00.000Z", semanticClass: "FACT" } },
    hypothesis: { workspaceId, brandId, marketCellId, proposition: "Trailer availability messaging produces qualified registrations.", counterHypothesis: "Existing relationships already solve availability.", successMetric: "qualified_registrations_per_usd", minimumEffect: 0.05, priorConfidence: "MEDIUM" },
    evidence: [
      { observedAt: "2026-08-25T00:00:00.000Z", metric: "qualified_registrations_per_usd", value: 0.08, sampleSize: 80, quality: "USABLE", semanticClass: "FACT", sourceRef: "fixture://scout/nebraska/a" },
      { observedAt: "2026-08-25T00:00:00.000Z", metric: "qualified_registrations_per_usd", value: 0.06, sampleSize: 70, quality: "USABLE", semanticClass: "FACT", sourceRef: "fixture://scout/nebraska/b" },
    ],
    requestedUsd: 100, policyVersion: "capital-v0",
    content: { audience: "small fleet operators in Nebraska", message: "Find the trailer your next job requires without idle ownership.", channel: "meta_ads", stopCondition: "Stop below 0.05 qualified registrations per USD." },
    distributionPolicy: { version: "distribution-v0", workspaceId, mode: "DRY_RUN", allowedBrands: [brandId], allowedChannels: ["meta_ads"], maximumSpendUsd: 100 },
  });
  const wallet: TreasuryWallet = { id: "wallet_lafwiron_usd", workspaceId, currency: "USD", settledUsd: 5000, pendingUsd: 0, reservedUsd: 300 };
  const authorityPolicy = defineFinancialAuthorityPolicy({ workspaceId, version: 1, effectiveAt: "2026-08-26T00:00:00.000Z", currency: "USD", maximumAutonomousDecisionUsd: 250, maximumAutonomousDailyUsd: 1000, maximumReservedExposureUsd: 2000, brandLimitsUsd: { rigzip: 500 }, killSwitch: false });
  return { packet, wallet, authorityPolicy, readModel: buildControlRoomReadModel({ generatedAt: "2026-08-26T12:00:00.000Z", packet, wallet, authorityPolicy }) };
}
