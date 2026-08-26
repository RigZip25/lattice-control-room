import {describe,expect,it} from "vitest";
import {evaluateMarketingAction,type MarketingActionDraft,type MarketingPolicySnapshot} from "./marketing-compliance.js";

const policy:MarketingPolicySnapshot={id:"youtube-us-v7",jurisdiction:"US",channel:"youtube",version:"7",effectiveAt:"2026-08-01T00:00:00.000Z",reviewedAt:"2026-08-20T00:00:00.000Z",maximumAgeDays:30,prohibitedCategories:["illegal_goods"],prohibitedClaimPatterns:["guaranteed income"],requiredDisclosures:["sponsored"],requiresExplicitConsent:false,maximumAutomatedActionsPerDay:100};
const action:MarketingActionDraft={brandId:"rigzip",jurisdiction:"US",channel:"youtube",category:"commercial_rental",claims:["Verified availability"],disclosures:["sponsored"],hasContentRights:true,hasAudienceConsent:true,automatedActionsToday:12,scheduledAt:"2026-08-26T12:00:00.000Z"};

describe("marketing legal and channel-policy preflight",()=>{
  it("allows a fully evidenced action",()=>expect(evaluateMarketingAction(policy,action).state).toBe("ALLOW"));
  it("blocks risky claims and automation beyond channel limits",()=>{
    const result=evaluateMarketingAction(policy,{...action,claims:["Guaranteed income"],automatedActionsToday:100});
    expect(result.state).toBe("BLOCK");
    expect(result.reasonCodes).toEqual(expect.arrayContaining(["PROHIBITED_CLAIM","CHANNEL_AUTOMATION_LIMIT_REACHED"]));
  });
  it("requires review when the policy snapshot is stale",()=>expect(evaluateMarketingAction(policy,{...action,scheduledAt:"2026-10-15T00:00:00.000Z"}).state).toBe("REQUIRE_REVIEW"));
});
