import {
  runDecisionLoop,
  type BrandId,
  type MarketCellId,
  type WorkspaceId,
} from "@lattice/core";

const brandId = "rigzip" as BrandId;
const marketCellId = "rigzip:us:nebraska:trailers" as MarketCellId;
const workspaceId = "lafwiron" as WorkspaceId;

const packet = runDecisionLoop({
  productSnapshot: {
    id: "snapshot_rigzip_demo",
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
        semanticClass: "FACT",
      },
    ],
  },
  brandPackageDraft: {
    problem: "Operators lose time when required equipment is unavailable.",
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
      semanticClass: "FACT",
    },
  },
  hypothesis: {
    workspaceId,
    brandId,
    marketCellId,
    proposition: "Trailer availability messaging produces qualified registrations.",
    counterHypothesis: "Existing relationships already solve availability.",
    successMetric: "qualified_registrations_per_usd",
    minimumEffect: 0.05,
    priorConfidence: "MEDIUM",
  },
  evidence: [
    {
      observedAt: "2026-08-25T00:00:00.000Z",
      metric: "qualified_registrations_per_usd",
      value: 0.08,
      sampleSize: 80,
      quality: "USABLE",
      semanticClass: "FACT",
      sourceRef: "fixture://scout/nebraska/a",
    },
    {
      observedAt: "2026-08-25T00:00:00.000Z",
      metric: "qualified_registrations_per_usd",
      value: 0.06,
      sampleSize: 70,
      quality: "USABLE",
      semanticClass: "FACT",
      sourceRef: "fixture://scout/nebraska/b",
    },
  ],
  requestedUsd: 100,
  policyVersion: "capital-v0",
  content: {
    audience: "small fleet operators in Nebraska",
    message: "Find the trailer your next job requires without idle ownership.",
    channel: "meta_ads",
    stopCondition: "Stop below 0.05 qualified registrations per USD.",
  },
  distributionPolicy: {
    version: "distribution-v0",
    workspaceId,
    mode: "DRY_RUN",
    allowedBrands: [brandId],
    allowedChannels: ["meta_ads"],
    maximumSpendUsd: 100,
  },
});

process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
