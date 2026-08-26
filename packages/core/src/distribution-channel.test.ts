import { describe, expect, it } from "vitest";
import { assertValidDistributionChannelRegistry, defaultDistributionChannels } from "./distribution-channel.js";

describe("distribution channel registry", () => {
  it("covers paid, organic, marketplace, social, lifecycle and local distribution", () => {
    expect(() => assertValidDistributionChannelRegistry(defaultDistributionChannels)).not.toThrow();
    expect(new Set(defaultDistributionChannels.map((channel) => channel.family))).toEqual(expect.objectContaining({ size: 10 }));
    expect(defaultDistributionChannels.map((channel) => channel.id)).toEqual(expect.arrayContaining(["seo_articles","regional_marketplace","instagram_organic","youtube_creator_integrations","micro_influencer_network","email_lifecycle","local_events"]));
  });

  it("accepts a new configured channel without changing decision logic", () => {
    expect(() => assertValidDistributionChannelRegistry([...defaultDistributionChannels, {
      id:"new_regional_network", family:"MARKETPLACE", name:"New Regional Network", costModel:"COMMISSION",
      geographicScope:"REGIONAL", contentCapabilities:["listing"], nativeMetrics:["qualified_events"], requiresProvider:true,
    }])).not.toThrow();
  });
});
