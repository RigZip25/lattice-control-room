import { deterministicId } from "./identity.js";

export type CapabilityFamily =
  | "RESEARCH"
  | "IMAGE_GENERATION"
  | "VIDEO_GENERATION"
  | "AUDIO_GENERATION"
  | "EDITORIAL"
  | "SEO"
  | "PAID_DISTRIBUTION"
  | "ORGANIC_PUBLISHING"
  | "LIFECYCLE_MESSAGING"
  | "COMMUNITY"
  | "PARTNERSHIP"
  | "ANALYTICS";

export interface CapabilityDefinition {
  readonly id: string;
  readonly family: CapabilityFamily;
  readonly operation: string;
  readonly version: number;
  readonly requiredInputs: readonly string[];
  readonly producedOutputs: readonly string[];
  readonly supportsIdempotency: boolean;
  readonly supportsReconciliation: boolean;
  readonly externalSideEffect: boolean;
}

export interface ProviderCapability {
  readonly providerId: string;
  readonly capabilityId: string;
  readonly status: "AVAILABLE" | "DEGRADED" | "DISABLED";
  readonly qualityScore: number;
  readonly estimatedCostUsd: number;
  readonly estimatedLatencySeconds: number;
  readonly policyTags: readonly string[];
}

export function defineCapability(
  draft: Omit<CapabilityDefinition, "id">,
): CapabilityDefinition {
  if (draft.version < 1 || !Number.isInteger(draft.version)) {
    throw new Error("Capability version must be a positive integer");
  }
  if (draft.operation.trim().length === 0 || draft.producedOutputs.length === 0) {
    throw new Error("Capability must define an operation and output");
  }
  const payload = {
    ...draft,
    requiredInputs: [...draft.requiredInputs],
    producedOutputs: [...draft.producedOutputs],
  };
  return { id: deterministicId("capability", payload), ...payload };
}

export function rankProviders(
  capability: CapabilityDefinition,
  providers: readonly ProviderCapability[],
): readonly ProviderCapability[] {
  return providers
    .filter(
      (provider) =>
        provider.capabilityId === capability.id && provider.status !== "DISABLED",
    )
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === "AVAILABLE" ? -1 : 1;
      const leftUtility = left.qualityScore / Math.max(left.estimatedCostUsd, 0.01);
      const rightUtility = right.qualityScore / Math.max(right.estimatedCostUsd, 0.01);
      return rightUtility - leftUtility;
    });
}

