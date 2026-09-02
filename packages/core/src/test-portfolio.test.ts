import {describe,expect,it} from "vitest";
import {createTestPortfolio} from "./test-portfolio.js";

const input={brandId:"evorios",expansionThesisId:"thesis-1",geographyName:"Prague",objective:"Learn whether local trust content creates qualified demand",durationDays:14,proposedBudgetUsd:300,authorityRequired:true,createdAt:"2026-09-02T12:00:00.000Z",assumptions:["Audience can be reached through local communities"],channels:[{channel:"SEO content",role:"Capture high-intent discovery",hypothesis:"A narrow guide will attract relevant owners",allocationUsd:100,primaryMetric:"qualified visits",successThreshold:"20 qualified visits",stopCondition:"No qualified visits after 10 days",legalCheck:"Verify claims and image rights"},{channel:"Community partnerships",role:"Validate language and trust",hypothesis:"Local groups will surface the strongest objection",allocationUsd:200,primaryMetric:"qualified responses",successThreshold:"5 relevant responses",stopCondition:"No relevant response after three placements",legalCheck:"Obtain moderator approval before any future publication"}]};

describe("test portfolio",()=>{
  it("creates a governed dry-run planning artifact",()=>{expect(createTestPortfolio(input)).toMatchObject({brandId:"evorios",status:"DRAFT",mode:"DRY_RUN",proposedBudgetUsd:300});});
  it("rejects allocations that do not match the proposed limit",()=>{expect(()=>createTestPortfolio({...input,proposedBudgetUsd:301})).toThrow(/allocation/);});
});

