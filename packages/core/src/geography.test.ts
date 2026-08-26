import { describe, expect, it } from "vitest";
import { GeographyRegistry, evaluateDrillDown, marketDrillDownRoute, referenceGeographies, type AdminUnit } from "./geography.js";

describe("extensible geography registry", () => {
  it("treats Figma countries as reference configurations", () => {
    expect(referenceGeographies.list()).toHaveLength(4);
    expect(referenceGeographies.get("US")?.administrativeLevels).toContain("county");
    expect(marketDrillDownRoute("IT", "lombardy")).toBe("/markets/italy/lombardy");
  });

  it("accepts a new country without changing domain code", () => {
    const registry = new GeographyRegistry();
    registry.register({ countryCode: "DE", countryName: "Germany", slug: "germany", administrativeLevels: ["state", "district"], supportedActivityDimensions: ["category"], status: "DISCOVERY" });
    expect(registry.get("DE")?.countryName).toBe("Germany");
  });

  it("expands only when depth and privacy-safe evidence allow it", () => {
    const unit: AdminUnit = { id: "US-NE", datasetId: "boundaries-us-v1", countryCode: "US", level: 1, unitType: "state", displayName: "Nebraska", localName: "Nebraska", geometryRef: "tiles://US-NE" };
    const policy = { minimumObservations: 50, maximumLevel: 2, privacyThreshold: 25 };
    expect(evaluateDrillDown({ unit, childCount: 93, observations: 120, policy }).state).toBe("EXPAND");
    expect(evaluateDrillDown({ unit, childCount: 93, observations: 12, policy }).state).toBe("AGGREGATE");
  });
});
