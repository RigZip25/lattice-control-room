import { deterministicId } from "./identity.js";
import type { BrandId, MarketCellId, WorkspaceId } from "./model.js";

export interface IntelligenceSource {
  readonly id: string;
  readonly provider: string;
  readonly dataset: string;
  readonly version: string;
  readonly termsRef: string;
  readonly freshnessSeconds: number;
  readonly estimatedQueryCostUsd: number;
  readonly allowedUses: readonly string[];
}

export interface OpportunitySignal {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId?: MarketCellId;
  readonly sourceId: string;
  readonly observedAt: string;
  readonly kind: string;
  readonly value: number;
  readonly confidence: number;
  readonly provenanceRef: string;
}

export interface OpportunityProposal {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId?: MarketCellId;
  readonly proposition: string;
  readonly counterHypothesis: string;
  readonly signalIds: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly recommendedNextStep: "RESEARCH" | "SCOUT_EXPERIMENT" | "IGNORE";
  readonly maximumResearchCostUsd: number;
}

export function proposeOpportunity(input: {
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId?: MarketCellId;
  readonly proposition: string;
  readonly counterHypothesis: string;
  readonly signals: readonly OpportunitySignal[];
  readonly requiredSignalKinds: readonly string[];
  readonly maximumResearchCostUsd: number;
}): OpportunityProposal {
  for (const signal of input.signals) {
    if (signal.workspaceId !== input.workspaceId || signal.brandId !== input.brandId) {
      throw new Error("Opportunity signal scope mismatch");
    }
  }
  const observedKinds = new Set(input.signals.map((signal) => signal.kind));
  const missingEvidence = input.requiredSignalKinds.filter((kind) => !observedKinds.has(kind));
  const usableSignals = input.signals.filter((signal) => signal.confidence >= 0.5);
  const recommendedNextStep =
    usableSignals.length === 0
      ? "IGNORE"
      : missingEvidence.length > 0
        ? "RESEARCH"
        : "SCOUT_EXPERIMENT";
  const payload = {
    workspaceId: input.workspaceId,
    brandId: input.brandId,
    ...(input.marketCellId === undefined ? {} : { marketCellId: input.marketCellId }),
    proposition: input.proposition,
    counterHypothesis: input.counterHypothesis,
    signalIds: usableSignals.map((signal) => signal.id).sort(),
    missingEvidence,
    recommendedNextStep: recommendedNextStep as OpportunityProposal["recommendedNextStep"],
    maximumResearchCostUsd: input.maximumResearchCostUsd,
  };
  return { id: deterministicId("opportunity", payload), ...payload };
}

