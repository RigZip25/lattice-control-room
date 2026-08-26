import { deterministicId } from "./identity.js";
import type { BrandId, MarketCellId, SemanticClass, WorkspaceId } from "./model.js";

export type MetricAggregation = "COUNT" | "SUM" | "RATE" | "AVERAGE" | "PERCENTILE";

export interface MetricDefinition {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly key: string;
  readonly version: number;
  readonly description: string;
  readonly unit: string;
  readonly aggregation: MetricAggregation;
  readonly valueEvent: boolean;
  readonly allowedSemanticClasses: readonly SemanticClass[];
}

export interface CanonicalEvent {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly marketCellId?: MarketCellId;
  readonly metricDefinitionId: string;
  readonly occurredAt: string;
  readonly ingestedAt: string;
  readonly value: number;
  readonly semanticClass: SemanticClass;
  readonly sourceProvider: string;
  readonly sourceEventId: string;
  readonly quality: "USABLE" | "DEGRADED" | "INVALID" | "CONFOUNDED";
  readonly attributionMethod: "DIRECT" | "LAST_TOUCH" | "MODELLED" | "UNATTRIBUTED";
  readonly consentClass: "PUBLIC" | "ANONYMOUS_AGGREGATE" | "CONSENTED_FIRST_PARTY";
}

export function defineMetric(
  draft: Omit<MetricDefinition, "id">,
): MetricDefinition {
  if (!Number.isInteger(draft.version) || draft.version < 1) {
    throw new Error("Metric version must be a positive integer");
  }
  if (draft.key.trim() === "" || draft.allowedSemanticClasses.length === 0) {
    throw new Error("Metric key and semantic classes are required");
  }
  const payload = { ...draft, allowedSemanticClasses: [...draft.allowedSemanticClasses] };
  return { id: deterministicId("metric", payload), ...payload };
}

export function ingestCanonicalEvent(
  metric: MetricDefinition,
  draft: Omit<CanonicalEvent, "id" | "metricDefinitionId">,
): CanonicalEvent {
  if (metric.workspaceId !== draft.workspaceId || metric.brandId !== draft.brandId) {
    throw new Error("Metric scope does not match event scope");
  }
  if (!metric.allowedSemanticClasses.includes(draft.semanticClass)) {
    throw new Error("Event semantic class is not allowed by metric definition");
  }
  if (!Number.isFinite(draft.value)) throw new Error("Event value must be finite");
  const payload = { ...draft, metricDefinitionId: metric.id };
  return { id: deterministicId("event", payload), ...payload };
}

