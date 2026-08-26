import { describe, expect, it } from "vitest";
import { planDailyProduction, registerCreativeAsset } from "./asset-library.js";
import type { ProducedAsset } from "./content-production.js";

const asset:ProducedAsset = { id:"asset-1",requestId:"request-1",brandId:"rigzip",format:"IMAGE",version:1,providerId:"image-provider",storageRef:"staging://asset-1",actualCostUsd:2,usedClaims:["verified"],status:"APPROVED" };

describe("cloud-neutral creative library and autonomous throughput",()=>{
  it("records immutable storage, rights and production lineage",()=>{
    const record=registerCreativeAsset({asset,briefId:"brief-1",objectKey:"rigzip/2026/08/asset-1.webp",contentHash:"a".repeat(64),mimeType:"image/webp",bytes:1024,locale:"en-US",territories:["US-NE"],rightsOwner:"RigZip",allowedUsage:["paid_social","website"]});
    expect(record.lineage.providerId).toBe("image-provider");
    expect(record.rights.usage).toContain("paid_social");
  });
  it("admits hundreds of daily jobs only when budget capacity and automated QA are sufficient",()=>{
    const plan=planDailyProduction({date:"2026-08-26",requestedUnits:500,unitCostUsd:3,dailyBudgetUsd:1800,providerCapacity:700,reviewAutomationCoverage:.995,failureRate:.02});
    expect(plan.admittedUnits).toBe(500);
    expect(plan.autonomous).toBe(true);
    expect(planDailyProduction({...plan,unitCostUsd:3,dailyBudgetUsd:300,providerCapacity:700,reviewAutomationCoverage:.9,failureRate:.02})).toMatchObject({admittedUnits:100,autonomous:false});
  });
});
