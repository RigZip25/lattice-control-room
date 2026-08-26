import { describe, expect, it } from "vitest";
import { defineCapability, rankProviders } from "./capabilities.js";

describe("capability registry", () => {
  it("keeps capability stable while providers remain replaceable", () => {
    const capability = defineCapability({
      family: "VIDEO_GENERATION",
      operation: "generate_short_form_video",
      version: 1,
      requiredInputs: ["approved_brief", "brand_package"],
      producedOutputs: ["video_asset", "production_metadata"],
      supportsIdempotency: true,
      supportsReconciliation: true,
      externalSideEffect: false,
    });
    const ranked = rankProviders(capability, [
      {
        providerId: "provider-a",
        capabilityId: capability.id,
        status: "DEGRADED",
        qualityScore: 0.95,
        estimatedCostUsd: 5,
        estimatedLatencySeconds: 90,
        policyTags: [],
      },
      {
        providerId: "provider-b",
        capabilityId: capability.id,
        status: "AVAILABLE",
        qualityScore: 0.8,
        estimatedCostUsd: 8,
        estimatedLatencySeconds: 60,
        policyTags: [],
      },
      {
        providerId: "provider-c",
        capabilityId: capability.id,
        status: "DISABLED",
        qualityScore: 1,
        estimatedCostUsd: 1,
        estimatedLatencySeconds: 1,
        policyTags: [],
      },
    ]);

    expect(ranked.map((provider) => provider.providerId)).toEqual([
      "provider-b",
      "provider-a",
    ]);
  });
});

