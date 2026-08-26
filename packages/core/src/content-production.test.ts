import { describe, expect, it } from "vitest";
import { approveProducedAsset, prepareProviderRequest, queueApprovedAsset, type ProductionBrief } from "./content-production.js";

const brief: ProductionBrief = { brandId:"rigzip", marketCellId:"us-ne", format:"SHORT_VIDEO", objective:"Acquire qualified trailer suppliers", audience:"Nebraska commercial fleet operators", channel:"youtube", supportedClaims:["Verified trailer availability"], referenceAssetIds:["brand-guide-v1","trailer-photo-12"], constraints:["No fabricated inventory"], maximumProductionCostUsd:25 };

describe("governed content production loop", () => {
  it("builds a provider-neutral request with prompt references and execution blocked", () => {
    const request = prepareProviderRequest(brief);
    expect(request.externalExecution).toBe("BLOCKED");
    expect(request.systemPrompt).toContain("Verified trailer availability");
    expect(request.references).toEqual(["brand-guide-v1","trailer-photo-12"]);
  });

  it("approves only traceable compliant output and gates its promotion budget", () => {
    const request = prepareProviderRequest(brief);
    const asset = approveProducedAsset(brief, request, { requestId:request.id, brandId:"rigzip", format:"SHORT_VIDEO", version:1, providerId:"video-provider-a", storageRef:"library://rigzip/video-001", actualCostUsd:18, usedClaims:["Verified trailer availability"] });
    const queued = queueApprovedAsset({ asset, channel:"youtube", requestedPromotionUsd:100, authorizedPromotionUsd:250, productionMode:false });
    expect(asset.status).toBe("APPROVED");
    expect(queued.state).toBe("BLOCKED");
    expect(queued.promotionBudgetUsd).toBe(100);
  });

  it("rejects unsupported claims and promotion beyond authority", () => {
    const request = prepareProviderRequest(brief);
    expect(() => approveProducedAsset(brief, request, { requestId:request.id, brandId:"rigzip", format:"SHORT_VIDEO", version:1, providerId:"provider", storageRef:"library://draft", actualCostUsd:4, usedClaims:["Guaranteed revenue"] })).toThrow(/unsupported claim/);
  });
});
