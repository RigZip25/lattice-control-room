import { describe, expect, it } from "vitest";
import { assertValidScreenRegistry, productScreens, screenByRoute } from "./screen-registry.js";

describe("Figma product screen registry", () => {
  it("contains exactly 22 unique, connected product screens", () => {
    expect(() => assertValidScreenRegistry(productScreens)).not.toThrow();
    expect(productScreens).toHaveLength(22);
    expect(productScreens.some((screen) => screen.title.includes("Reference"))).toBe(false);
  });

  it("resolves stable application routes", () => {
    expect(screenByRoute("/capital-allocator")?.figmaNodeId).toBe("82:4");
    expect(screenByRoute("/markets/nebraska")?.key).toBe("nebraska");
  });
});
