import { deterministicId } from "./identity.js";
import type { BrandId, WorkspaceId } from "./model.js";

export type ModelKind =
  | "LLM_REASONER"
  | "FORECAST"
  | "RANKER"
  | "CLASSIFIER"
  | "ANOMALY_DETECTOR"
  | "RULE_POLICY";

export type ModelStatus = "DRAFT" | "CHALLENGER" | "CHAMPION" | "RETIRED" | "BLOCKED";

export interface ModelArtifact {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId?: BrandId;
  readonly kind: ModelKind;
  readonly version: number;
  readonly implementationRef: string;
  readonly featureSchemaVersion: string;
  readonly dataFingerprint: string;
  readonly evaluationMetric: string;
  readonly prohibitedUses: readonly string[];
  readonly status: ModelStatus;
}

export interface ModelEvaluation {
  readonly id: string;
  readonly modelArtifactId: string;
  readonly evaluatedAt: string;
  readonly datasetFingerprint: string;
  readonly metric: string;
  readonly score: number;
  readonly calibrationError: number;
  readonly leakageChecksPassed: boolean;
  readonly policyChecksPassed: boolean;
  readonly segmentScores: Readonly<Record<string, number>>;
}

export interface PromotionDecision {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly challengerId: string;
  readonly incumbentId?: string;
  readonly evaluationId: string;
  readonly decision: "PROMOTE" | "REJECT" | "DEFER";
  readonly reasonCodes: readonly string[];
}

export function defineModelArtifact(
  draft: Omit<ModelArtifact, "id">,
): ModelArtifact {
  if (!Number.isInteger(draft.version) || draft.version < 1) {
    throw new Error("Model artifact version must be a positive integer");
  }
  if (draft.implementationRef.trim() === "" || draft.dataFingerprint.trim() === "") {
    throw new Error("Model implementation and data fingerprint are required");
  }
  const payload = {
    ...draft,
    prohibitedUses: [...draft.prohibitedUses],
  };
  return { id: deterministicId("model", payload), ...payload };
}

export function evaluatePromotion(
  challenger: ModelArtifact,
  incumbent: ModelArtifact | undefined,
  evaluation: ModelEvaluation,
  minimumScore: number,
  maximumCalibrationError: number,
): PromotionDecision {
  if (challenger.status !== "CHALLENGER") {
    throw new Error("Only a challenger can be evaluated for promotion");
  }
  if (evaluation.modelArtifactId !== challenger.id) {
    throw new Error("Evaluation does not belong to challenger");
  }
  if (incumbent !== undefined && incumbent.workspaceId !== challenger.workspaceId) {
    throw new Error("Cross-workspace model promotion is forbidden");
  }

  const reasons: string[] = [];
  if (!evaluation.leakageChecksPassed) reasons.push("LEAKAGE_CHECK_FAILED");
  if (!evaluation.policyChecksPassed) reasons.push("POLICY_CHECK_FAILED");
  if (evaluation.score < minimumScore) reasons.push("SCORE_BELOW_THRESHOLD");
  if (evaluation.calibrationError > maximumCalibrationError) {
    reasons.push("CALIBRATION_ERROR_TOO_HIGH");
  }
  const decision = reasons.length === 0 ? "PROMOTE" : "REJECT";
  const payload = {
    workspaceId: challenger.workspaceId,
    challengerId: challenger.id,
    ...(incumbent === undefined ? {} : { incumbentId: incumbent.id }),
    evaluationId: evaluation.id,
    decision: decision as PromotionDecision["decision"],
    reasonCodes: reasons.length === 0 ? ["EVALUATION_GATE_PASSED"] : reasons,
  };
  return { id: deterministicId("promotion", payload), ...payload };
}

