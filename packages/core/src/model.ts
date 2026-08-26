export type BrandId = string & { readonly __brand: "BrandId" };
export type MarketCellId = string & { readonly __brand: "MarketCellId" };
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };

export type SemanticClass = "FACT" | "INFERRED" | "FORECAST";
export type Confidence = "LOW" | "MEDIUM" | "HIGH";

export interface ProductSnapshot {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly sourceRepository: string;
  readonly sourceRevision: string;
  readonly capturedAt: string;
  readonly facts: readonly ProductFact[];
}

export interface ProductFact {
  readonly key: string;
  readonly value: string;
  readonly sourcePath: string;
  readonly semanticClass: "FACT";
}

export interface BrandPackage {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly productSnapshotId: string;
  readonly version: number;
  readonly problem: string;
  readonly audiences: readonly string[];
  readonly valueClaims: readonly ValueClaim[];
  readonly hardConstraints: readonly string[];
}

export interface ValueClaim {
  readonly id: string;
  readonly statement: string;
  readonly evidenceFactKeys: readonly string[];
  readonly status: "SUPPORTED" | "UNVERIFIED";
}

export interface MarketCell {
  readonly id: MarketCellId;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly countryCode: string;
  readonly geographyPath: readonly string[];
  readonly segment: string;
  readonly denominator: {
    readonly kind: string;
    readonly value: number;
    readonly observedAt: string;
    readonly semanticClass: "FACT";
  };
}

export interface MarketHypothesis {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId: MarketCellId;
  readonly brandPackageId: string;
  readonly proposition: string;
  readonly counterHypothesis: string;
  readonly successMetric: string;
  readonly minimumEffect: number;
  readonly priorConfidence: Confidence;
  readonly status: "ACTIVE" | "SUPPORTED" | "CONTRADICTED" | "INCONCLUSIVE";
}

export interface ScoutEvidence {
  readonly id: string;
  readonly hypothesisId: string;
  readonly observedAt: string;
  readonly metric: string;
  readonly value: number;
  readonly sampleSize: number;
  readonly quality: "USABLE" | "DEGRADED" | "INVALID";
  readonly semanticClass: "FACT";
  readonly sourceRef: string;
}

export type CapitalDecisionKind = "APPROVE" | "MODIFY" | "DEFER" | "REJECT";

export interface CapitalDecision {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId: MarketCellId;
  readonly hypothesisId: string;
  readonly kind: CapitalDecisionKind;
  readonly requestedUsd: number;
  readonly approvedUsd: number;
  readonly expectedIncrementalOutcome: number;
  readonly expectedMarginalValuePer100Usd: number;
  readonly confidence: Confidence;
  readonly evidenceIds: readonly string[];
  readonly policyVersion: string;
  readonly reasonCodes: readonly string[];
  readonly semanticClass: "FORECAST";
}

export interface ContentBrief {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId: MarketCellId;
  readonly capitalDecisionId: string;
  readonly audience: string;
  readonly message: string;
  readonly channel: string;
  readonly successMetric: string;
  readonly stopCondition: string;
}

export interface DistributionAuthorization {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly contentBriefId: string;
  readonly brandId: BrandId;
  readonly marketCellId: MarketCellId;
  readonly channel: string;
  readonly state: "BLOCKED" | "AUTHORIZED";
  readonly maximumSpendUsd: number;
  readonly policyVersion: string;
  readonly reason: string;
  readonly expiresAt?: string;
}

export interface DecisionPacket {
  readonly productSnapshot: ProductSnapshot;
  readonly brandPackage: BrandPackage;
  readonly marketCell: MarketCell;
  readonly hypothesis: MarketHypothesis;
  readonly evidence: readonly ScoutEvidence[];
  readonly capitalDecision: CapitalDecision;
  readonly contentBrief: ContentBrief;
  readonly distributionAuthorization: DistributionAuthorization;
}
