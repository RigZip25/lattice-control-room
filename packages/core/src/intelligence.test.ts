import { describe, expect, it } from "vitest";
import { defineModelArtifact, evaluatePromotion, type ModelEvaluation } from "./intelligence.js";
import type { WorkspaceId } from "./model.js";

const workspaceId = "lafwiron" as WorkspaceId;

describe("governed model lifecycle", () => {
  it("promotes a challenger only after all evaluation gates pass", () => {
    const challenger = defineModelArtifact({
      workspaceId,
      kind: "RANKER",
      version: 2,
      implementationRef: "model://market-ranker/v2",
      featureSchemaVersion: "market-features-v1",
      dataFingerprint: "sha256:training-data-v2",
      evaluationMetric: "normalized_discounted_gain",
      prohibitedUses: ["cross_workspace_scoring"],
      status: "CHALLENGER",
    });
    const evaluation: ModelEvaluation = {
      id: "evaluation-1",
      modelArtifactId: challenger.id,
      evaluatedAt: "2026-08-26T00:00:00.000Z",
      datasetFingerprint: "sha256:holdout-v1",
      metric: "normalized_discounted_gain",
      score: 0.82,
      calibrationError: 0.04,
      leakageChecksPassed: true,
      policyChecksPassed: true,
      segmentScores: { rigzip: 0.8, evorios: 0.84 },
    };

    expect(evaluatePromotion(challenger, undefined, evaluation, 0.75, 0.1).decision).toBe(
      "PROMOTE",
    );
  });

  it("rejects a model with data leakage even when its score is high", () => {
    const challenger = defineModelArtifact({
      workspaceId,
      kind: "FORECAST",
      version: 1,
      implementationRef: "model://forecast/v1",
      featureSchemaVersion: "features-v1",
      dataFingerprint: "sha256:data",
      evaluationMetric: "accuracy",
      prohibitedUses: [],
      status: "CHALLENGER",
    });
    const evaluation: ModelEvaluation = {
      id: "evaluation-2",
      modelArtifactId: challenger.id,
      evaluatedAt: "2026-08-26T00:00:00.000Z",
      datasetFingerprint: "sha256:holdout",
      metric: "accuracy",
      score: 0.99,
      calibrationError: 0.01,
      leakageChecksPassed: false,
      policyChecksPassed: true,
      segmentScores: {},
    };

    const decision = evaluatePromotion(challenger, undefined, evaluation, 0.8, 0.1);
    expect(decision.decision).toBe("REJECT");
    expect(decision.reasonCodes).toContain("LEAKAGE_CHECK_FAILED");
  });
});

