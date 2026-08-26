import { describe, expect, it } from "vitest";
import { defineMetric, ingestCanonicalEvent } from "./metrics.js";
import type { BrandId, WorkspaceId } from "./model.js";

const workspaceId = "lafwiron" as WorkspaceId;
const brandId = "rigzip" as BrandId;

describe("metric registry", () => {
  it("preserves observed event provenance and deterministic identity", () => {
    const metric = defineMetric({
      workspaceId,
      brandId,
      key: "completed_asset_matches",
      version: 1,
      description: "Commercial asset requests completed with a verified counterparty",
      unit: "matches",
      aggregation: "COUNT",
      valueEvent: true,
      allowedSemanticClasses: ["FACT"],
    });
    const draft = {
      workspaceId,
      brandId,
      occurredAt: "2026-08-26T00:00:00.000Z",
      ingestedAt: "2026-08-26T00:01:00.000Z",
      value: 1,
      semanticClass: "FACT" as const,
      sourceProvider: "rigzip-product-events",
      sourceEventId: "event-123",
      quality: "USABLE" as const,
      attributionMethod: "DIRECT" as const,
      consentClass: "CONSENTED_FIRST_PARTY" as const,
    };

    expect(ingestCanonicalEvent(metric, draft)).toEqual(ingestCanonicalEvent(metric, draft));
  });

  it("rejects forecasts inserted into an observed-only metric", () => {
    const metric = defineMetric({
      workspaceId,
      brandId,
      key: "settled_revenue_usd",
      version: 1,
      description: "Settled product revenue",
      unit: "USD",
      aggregation: "SUM",
      valueEvent: true,
      allowedSemanticClasses: ["FACT"],
    });

    expect(() =>
      ingestCanonicalEvent(metric, {
        workspaceId,
        brandId,
        occurredAt: "2026-08-26T00:00:00.000Z",
        ingestedAt: "2026-08-26T00:01:00.000Z",
        value: 100,
        semanticClass: "FORECAST",
        sourceProvider: "forecast-model",
        sourceEventId: "forecast-1",
        quality: "USABLE",
        attributionMethod: "MODELLED",
        consentClass: "ANONYMOUS_AGGREGATE",
      }),
    ).toThrow(/semantic class/);
  });
});

