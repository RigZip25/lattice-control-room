import {describe,expect,it} from "vitest";
import {analyticsAgentReport,creatorAgentDraft,executorAgentReview,legalAgentAuthorizePrompt,planCreativePortfolio,seniorMarketingAllocate} from "./creative-agent-orchestration.js";

const draft=creatorAgentDraft({brandId:"rigzip",marketCellId:"us-ne",objective:"Acquire suppliers",audience:"Fleet operators",region:"Nebraska",winningAssetIds:["winner-14"],citedResearchSourceIds:[],supportedClaims:["Verified availability"],culturalContext:["Avoid stereotypes","Use regionally neutral language"],capability:"GENERATE_SHORT_VIDEO"});

describe("autonomous multi-agent creative and growth flow",()=>{
  it("requires legal-agent approval before provider dispatch and loops failed QA into rework",()=>{
    expect(()=>legalAgentAuthorizePrompt(draft,{id:"legal-block",state:"BLOCK",decidedBy:"LEGAL_POLICY_AGENT"})).toThrow(/requires Legal Policy Agent ALLOW/);
    const dispatched=legalAgentAuthorizePrompt(draft,{id:"legal-1",state:"ALLOW",decidedBy:"LEGAL_POLICY_AGENT"});
    const rework=executorAgentReview(dispatched,["Logo safe area violated"]);
    expect(rework).toMatchObject({stage:"REWORK",revision:2});
    expect(executorAgentReview(rework,[]).stage).toBe("LIBRARY_APPROVED");
  });
  it("routes capital shortfall to Venture and authority excess to the owner",()=>{
    const approved=executorAgentReview(legalAgentAuthorizePrompt(draft,{id:"legal-1",state:"ALLOW",decidedBy:"LEGAL_POLICY_AGENT"}),[]);
    expect(seniorMarketingAllocate({packet:approved,channel:"youtube",requestedBudgetUsd:700,availableBrandCapitalUsd:200,delegatedLimitUsd:1000,ventureAvailableUsd:1000}).state).toBe("VENTURE_FUNDING_REQUIRED");
    expect(seniorMarketingAllocate({packet:approved,channel:"youtube",requestedBudgetUsd:1700,availableBrandCapitalUsd:200,delegatedLimitUsd:1000,ventureAvailableUsd:1000}).state).toBe("OWNER_APPROVAL_REQUIRED");
  });
  it("aggregates engagement penetration and capital need for Command Center",()=>{
    const report=analyticsAgentReport({packet:draft,spendUsd:100,engagements:87,impressions:1000,penetrationBefore:.2,penetrationAfter:.27,recommendedNextBudgetUsd:500,availableCapitalUsd:120});
    expect(report).toMatchObject({destination:"COMMAND_CENTER",engagementRate:.087,capitalNeededUsd:380});
  });
  it("reserves exploration capital and stops fatigued or non-incremental creative",()=>{
    const plan=planCreativePortfolio({totalBudgetUsd:1000,explorationShare:.2,minimumObservationsForScale:500,killSwitch:false,creatives:[{id:"winner",observations:1200,incrementalLift:.14,frequency:2.1,fatigueThreshold:4,policyAllowed:true},{id:"fatigued",observations:1800,incrementalLift:.04,frequency:5,fatigueThreshold:4,policyAllowed:true},{id:"correlated-only",observations:80,incrementalLift:0,frequency:1,fatigueThreshold:4,policyAllowed:true}]});
    expect(plan).toMatchObject({explorationBudgetUsd:200,exploitationBudgetUsd:800,eligibleScaleCreativeIds:["winner"],stoppedCreativeIds:["fatigued","correlated-only"],autonomous:true});
  });
});
