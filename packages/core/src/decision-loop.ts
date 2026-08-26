import { buildBrandPackage, type BrandPackageDraft } from "./brand-package.js";
import { deterministicId } from "./identity.js";
import type {
  CapitalDecision,
  Confidence,
  ContentBrief,
  DecisionPacket,
  MarketCell,
  MarketHypothesis,
  ProductSnapshot,
  ScoutEvidence,
} from "./model.js";
import {
  evaluateDistributionAuthorization,
  type DistributionPolicy,
} from "./policy.js";
import {
  assertMetricBelongsToContract,
  type GrowthContract,
} from "./product-line.js";

export interface DecisionLoopInput {
  readonly productSnapshot: ProductSnapshot;
  readonly growthContract: GrowthContract;
  readonly brandPackageDraft: BrandPackageDraft;
  readonly marketCell: MarketCell;
  readonly hypothesis: Omit<MarketHypothesis, "id" | "brandPackageId" | "status">;
  readonly evidence: readonly Omit<ScoutEvidence, "id" | "hypothesisId">[];
  readonly requestedUsd: number;
  readonly policyVersion: string;
  readonly content: {
    readonly audience: string;
    readonly message: string;
    readonly channel: string;
    readonly stopCondition: string;
  };
  readonly distributionPolicy: DistributionPolicy;
}

function confidenceFor(usableEvidence: readonly ScoutEvidence[]): Confidence {
  const totalSample = usableEvidence.reduce((sum, item) => sum + item.sampleSize, 0);
  if (usableEvidence.length >= 3 && totalSample >= 300) return "HIGH";
  if (usableEvidence.length >= 1 && totalSample >= 50) return "MEDIUM";
  return "LOW";
}

function makeCapitalDecision(
  hypothesis: MarketHypothesis,
  evidence: readonly ScoutEvidence[],
  requestedUsd: number,
  policyVersion: string,
): CapitalDecision {
  const usable = evidence.filter(
    (item) => item.quality === "USABLE" && item.metric === hypothesis.successMetric,
  );
  const confidence = confidenceFor(usable);
  const weightedValue = usable.reduce(
    (sum, item) => sum + item.value * item.sampleSize,
    0,
  );
  const sampleSize = usable.reduce((sum, item) => sum + item.sampleSize, 0);
  const observedRate = sampleSize === 0 ? 0 : weightedValue / sampleSize;
  const supported = observedRate >= hypothesis.minimumEffect;

  const kind: CapitalDecision["kind"] =
    supported && confidence !== "LOW" ? "APPROVE" : "DEFER";
  const approvedUsd = kind === "APPROVE" ? requestedUsd : 0;
  const expectedIncrementalOutcome = observedRate * approvedUsd;
  const payload = {
    workspaceId: hypothesis.workspaceId,
    brandId: hypothesis.brandId,
    marketCellId: hypothesis.marketCellId,
    hypothesisId: hypothesis.id,
    kind,
    requestedUsd,
    approvedUsd,
    expectedIncrementalOutcome,
    expectedMarginalValuePer100Usd: observedRate * 100,
    confidence,
    evidenceIds: usable.map((item) => item.id).sort(),
    policyVersion,
    reasonCodes: supported
      ? ["OBSERVED_EFFECT_ABOVE_THRESHOLD", `CONFIDENCE_${confidence}`]
      : ["INSUFFICIENT_OBSERVED_EFFECT", `CONFIDENCE_${confidence}`],
    semanticClass: "FORECAST" as const,
  };
  return { id: deterministicId("capital_decision", payload), ...payload };
}

export function runDecisionLoop(input: DecisionLoopInput): DecisionPacket {
  if (input.growthContract.workspaceId !== input.productSnapshot.workspaceId) {
    throw new Error("Growth Contract belongs to another workspace");
  }
  if (input.growthContract.brandId !== input.productSnapshot.brandId) {
    throw new Error("Growth Contract belongs to another brand");
  }
  if (input.productSnapshot.workspaceId !== input.marketCell.workspaceId) {
    throw new Error("Workspace isolation violation between product and MarketCell");
  }
  if (input.productSnapshot.brandId !== input.marketCell.brandId) {
    throw new Error("Brand isolation violation between product and MarketCell");
  }
  if (input.hypothesis.brandId !== input.productSnapshot.brandId) {
    throw new Error("Brand isolation violation in hypothesis");
  }
  if (input.hypothesis.marketCellId !== input.marketCell.id) {
    throw new Error("Hypothesis references a different MarketCell");
  }
  if (!Number.isFinite(input.requestedUsd) || input.requestedUsd <= 0) {
    throw new Error("Requested tranche must be a positive finite amount");
  }
  assertMetricBelongsToContract(input.growthContract, input.hypothesis.successMetric);

  const brandPackage = buildBrandPackage(
    input.productSnapshot,
    input.brandPackageDraft,
  );
  const hypothesisPayload = {
    ...input.hypothesis,
    brandPackageId: brandPackage.id,
    status: "ACTIVE" as const,
  };
  const hypothesis: MarketHypothesis = {
    id: deterministicId("hypothesis", hypothesisPayload),
    ...hypothesisPayload,
  };

  const evidence: ScoutEvidence[] = input.evidence.map((item) => {
    const payload = { ...item, hypothesisId: hypothesis.id };
    return { id: deterministicId("evidence", payload), ...payload };
  });
  const capitalDecision = makeCapitalDecision(
    hypothesis,
    evidence,
    input.requestedUsd,
    input.policyVersion,
  );
  const contentPayload = {
    workspaceId: hypothesis.workspaceId,
    brandId: hypothesis.brandId,
    marketCellId: hypothesis.marketCellId,
    capitalDecisionId: capitalDecision.id,
    audience: input.content.audience,
    message: input.content.message,
    channel: input.content.channel,
    successMetric: hypothesis.successMetric,
    stopCondition: input.content.stopCondition,
  };
  const contentBrief: ContentBrief = {
    id: deterministicId("content_brief", contentPayload),
    ...contentPayload,
  };
  const distributionAuthorization = evaluateDistributionAuthorization(
    contentBrief,
    capitalDecision,
    input.distributionPolicy,
  );

  return {
    productSnapshot: input.productSnapshot,
    brandPackage,
    marketCell: input.marketCell,
    hypothesis,
    evidence,
    capitalDecision,
    contentBrief,
    distributionAuthorization,
  };
}
