import { deterministicId } from "./identity.js";

export type ContentFormat = "ARTICLE" | "SEO_PAGE" | "IMAGE" | "SHORT_VIDEO" | "LONG_VIDEO" | "EMAIL" | "SOCIAL_POST";

export interface ProductionBrief {
  readonly brandId: string;
  readonly marketCellId: string;
  readonly format: ContentFormat;
  readonly objective: string;
  readonly audience: string;
  readonly channel: string;
  readonly supportedClaims: readonly string[];
  readonly referenceAssetIds: readonly string[];
  readonly constraints: readonly string[];
  readonly maximumProductionCostUsd: number;
}

export interface ProviderProductionRequest {
  readonly id: string;
  readonly providerCapability: string;
  readonly systemPrompt: string;
  readonly references: readonly string[];
  readonly maximumCostUsd: number;
  readonly externalExecution: "BLOCKED" | "AUTHORIZED";
}

export interface ProducedAsset {
  readonly id: string;
  readonly requestId: string;
  readonly brandId: string;
  readonly format: ContentFormat;
  readonly version: number;
  readonly providerId: string;
  readonly storageRef: string;
  readonly actualCostUsd: number;
  readonly usedClaims: readonly string[];
  readonly status: "GENERATED" | "APPROVED";
}

export interface DistributionQueueItem {
  readonly id: string;
  readonly assetId: string;
  readonly brandId: string;
  readonly channel: string;
  readonly promotionBudgetUsd: number;
  readonly state: "BLOCKED" | "QUEUED";
  readonly reason: string;
}

export function prepareProviderRequest(brief: ProductionBrief, executionAuthorized = false): ProviderProductionRequest {
  if (!brief.objective.trim() || !brief.audience.trim() || !brief.channel.trim()) throw new Error("Content brief requires objective, audience and channel");
  if (brief.supportedClaims.length === 0 || brief.referenceAssetIds.length === 0) throw new Error("Content production requires supported claims and reference assets");
  if (brief.maximumProductionCostUsd <= 0) throw new Error("Production cost limit must be positive");
  const systemPrompt = [
    `Create ${brief.format} for brand ${brief.brandId}.`,
    `Objective: ${brief.objective}. Audience: ${brief.audience}. Channel: ${brief.channel}.`,
    `Use only supported claims: ${brief.supportedClaims.join(" | ")}.`,
    `Respect constraints: ${brief.constraints.join(" | ") || "none supplied"}.`,
    "Return production metadata and do not publish the result.",
  ].join("\n");
  const payload = { brief, systemPrompt, executionAuthorized };
  return {
    id: deterministicId("production_request", payload),
    providerCapability: `GENERATE_${brief.format}`,
    systemPrompt,
    references: [...brief.referenceAssetIds],
    maximumCostUsd: brief.maximumProductionCostUsd,
    externalExecution: executionAuthorized ? "AUTHORIZED" : "BLOCKED",
  };
}

export function approveProducedAsset(brief: ProductionBrief, request: ProviderProductionRequest, draft: Omit<ProducedAsset, "id" | "status">): ProducedAsset {
  if (draft.requestId !== request.id || draft.brandId !== brief.brandId) throw new Error("Produced asset provenance does not match the brief");
  if (draft.actualCostUsd > request.maximumCostUsd) throw new Error("Produced asset exceeded its cost authority");
  if (draft.usedClaims.some((claim) => !brief.supportedClaims.includes(claim))) throw new Error("Produced asset contains an unsupported claim");
  if (!draft.storageRef.trim() || !draft.providerId.trim()) throw new Error("Produced asset must retain storage and provider provenance");
  return { id: deterministicId("brand_asset", draft), ...draft, status:"APPROVED" };
}

export function queueApprovedAsset(input: { readonly asset: ProducedAsset; readonly channel: string; readonly requestedPromotionUsd: number; readonly authorizedPromotionUsd: number; readonly compliance: { readonly state:"ALLOW"|"BLOCK"|"REQUIRE_REVIEW"; readonly decidedBy:"LEGAL_POLICY_AGENT"; readonly executionAuthority:"AUTONOMOUS"|"WITHHELD" }; readonly productionMode: boolean }): DistributionQueueItem {
  if (input.asset.status !== "APPROVED") throw new Error("Only approved assets may enter distribution");
  if (input.requestedPromotionUsd < 0 || input.requestedPromotionUsd > input.authorizedPromotionUsd) throw new Error("Promotion budget exceeds authority");
  const legallyAuthorized = input.compliance.state === "ALLOW" && input.compliance.decidedBy === "LEGAL_POLICY_AGENT" && input.compliance.executionAuthority === "AUTONOMOUS";
  const state = input.productionMode && legallyAuthorized ? "QUEUED" : "BLOCKED";
  return {
    id: deterministicId("distribution_queue_item", input),
    assetId: input.asset.id,
    brandId: input.asset.brandId,
    channel: input.channel,
    promotionBudgetUsd: input.requestedPromotionUsd,
    state,
    reason: !legallyAuthorized ? "LEGAL_AGENT_DID_NOT_AUTHORIZE" : state === "BLOCKED" ? "DRY_RUN_PREVENTS_EXTERNAL_DISTRIBUTION" : "WITHIN_AUTHORIZED_ENVELOPE",
  };
}
