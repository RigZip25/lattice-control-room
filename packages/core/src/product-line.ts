import { deterministicId } from "./identity.js";
import type { BrandId, WorkspaceId } from "./model.js";

export type ProductArchetype =
  | "LOCAL_TWO_SIDED_MARKETPLACE"
  | "INTERNATIONAL_NEIGHBORHOOD_MARKETPLACE"
  | "CONTENT_IP_PORTFOLIO"
  | "TRAVEL_PLATFORM"
  | "RECURRING_UTILITY";

export interface GrowthContract {
  readonly id: string;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly version: number;
  readonly archetype: ProductArchetype;
  readonly valueEvent: string;
  readonly marketCellDimensions: readonly string[];
  readonly lifecycleStages: readonly string[];
  readonly constraintMetrics: readonly string[];
  readonly outcomeMetrics: readonly string[];
  readonly eligiblePlaybooks: readonly string[];
}

export type GrowthContractDraft = Omit<GrowthContract, "id">;

export function defineGrowthContract(draft: GrowthContractDraft): GrowthContract {
  const requiredLists: ReadonlyArray<readonly string[]> = [
    draft.marketCellDimensions,
    draft.lifecycleStages,
    draft.outcomeMetrics,
    draft.eligiblePlaybooks,
  ];
  if (draft.version < 1 || !Number.isInteger(draft.version)) {
    throw new Error("Growth Contract version must be a positive integer");
  }
  if (draft.valueEvent.trim().length === 0 || requiredLists.some((list) => list.length === 0)) {
    throw new Error("Growth Contract must define value, market, lifecycle, outcomes and playbooks");
  }
  const payload = {
    ...draft,
    marketCellDimensions: [...draft.marketCellDimensions],
    lifecycleStages: [...draft.lifecycleStages],
    constraintMetrics: [...draft.constraintMetrics],
    outcomeMetrics: [...draft.outcomeMetrics],
    eligiblePlaybooks: [...draft.eligiblePlaybooks],
  };
  return { id: deterministicId("growth_contract", payload), ...payload };
}

export function assertMetricBelongsToContract(
  contract: GrowthContract,
  metric: string,
): void {
  if (!contract.outcomeMetrics.includes(metric)) {
    throw new Error(`Metric ${metric} is not an outcome in Growth Contract ${contract.id}`);
  }
}
